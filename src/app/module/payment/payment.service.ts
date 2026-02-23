
import { v4 as uuidv4 } from "uuid";

import { PaymentStatus, UserRole } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import { SSLService } from "../sslCommerz/sslCommerz.service.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

const initiatePayment = async (userId: string, payload: any) => {
    const { batchId } = payload;

    // 1️⃣ Check course
    const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: {
            course: true
        }
    });
    if (!batch) throw new ApiError(httpCode.NOT_ACCEPTABLE, "Batch not found");

    // 2️⃣ Check user
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) throw new ApiError(httpCode.NOT_ACCEPTABLE, "User not found");

    // 3️⃣ Prevent already enrolled
    const alreadyEnrolled = await prisma.enrollment.findUnique({
        where: {
            userId_batchId: { userId, batchId },
        },
    });
    if (alreadyEnrolled) {
        throw new ApiError(httpCode.NOT_ACCEPTABLE, "Already enrolled");
    }

    // 4️⃣ Check if there's existing pending order
    const existingPendingOrder = await prisma.order.findFirst({
        where: {
            userId,
            batchId,
            status: PaymentStatus.PENDING,
        },
    });

    if (existingPendingOrder) {
        // Reuse same transaction instead of creating new
        const response = await SSLService.sslPaymentInit({
            amount: existingPendingOrder.amount,
            transactionId: existingPendingOrder.transactionId,
            name: user.name,
            email: user.email,
            phoneNumber: user.phone,
            address: "Dhaka",
        });

        return { gatewayUrl: response.GatewayPageURL };
    }

    // 5️⃣ Create new order + payment inside transaction
    const result = await prisma.$transaction(async (tx) => {
        const transactionId = uuidv4();

        const order = await tx.order.create({
            data: {
                userId,
                batchId,
                amount: Number(batch.course.discountPrice),
                transactionId,
                status: PaymentStatus.PENDING,
            },
        });

        await tx.payment.create({
            data: {
                orderId: order.id,
                gatewayName: "SSLCommerz",
                status: PaymentStatus.PENDING,
            },
        });

        return order;
    });

    // 6️⃣ Call SSL outside DB transaction
    try {
        const response = await SSLService.sslPaymentInit({
            amount: result.amount,
            transactionId: result.transactionId,
            name: user.name,
            email: user.email,
            phoneNumber: user.phone,
            address: "Dhaka",
        });

        return { gatewayUrl: response.GatewayPageURL };
    } catch (error) {
        // 7️⃣ If SSL fails → mark order failed
        await prisma.order.update({
            where: { id: result.id },
            data: { status: PaymentStatus.FAILED },
        });

        await prisma.payment.update({
            where: { orderId: result.id },
            data: { status: PaymentStatus.FAILED },
        });

        throw new Error("Payment gateway initialization failed");
    }
};


const markPaymentFailed = async (transactionId: string) => {
    await prisma.order.update({
        where: { transactionId },
        data: { status: "FAILED" },
    });
};

const markPaymentCancelled = async (transactionId: string) => {
    await prisma.order.update({
        where: { transactionId },
        data: { status: "CANCELLED" },
    });
};

const validatePayment = async (sslPayload: any) => {
    // 1. Call SSL validation API
    const validationData = await SSLService.validatePayment(sslPayload);

    if (validationData.status !== "VALID") {
        throw new Error("Payment not valid");
    }

    // 2. Update DB safely
    await prisma.$transaction(async (tx) => {
        // 1. Find order first
        const order = await tx.order.findUnique({
            where: { transactionId: validationData.tran_id },
        });

        if (!order) {
            throw new Error("Order not found");
        }

        // 2. Prevent double processing
        if (order.status === PaymentStatus.PAID) {
            return order;
        }

        // 3. Verify amount (VERY IMPORTANT)
        if (Number(validationData.amount) !== order.amount) {
            throw new Error("Amount mismatch");
        }

        // 4. Update order status
        const updatedOrder = await tx.order.update({
            where: { id: order.id },
            data: {
                status: PaymentStatus.PAID,
            },
        });

        // 5. Update payment table
        await tx.payment.update({
            where: { orderId: order.id },
            data: {
                status: PaymentStatus.PAID,
                gatewayEventId: validationData.bank_tran_id,
                gatewayPayload: validationData,
            },
        });

        // 6. Create enrollment (safe because unique constraint exists)
        await tx.enrollment.create({
            data: {
                userId: updatedOrder.userId,
                batchId: updatedOrder.batchId,
            },
        });
        await tx.user.update({
            where: { id: updatedOrder.userId },
            data: {
                role: UserRole.STUDENT
            }
        })
        await tx.batch.update({
            where: { id: updatedOrder.batchId },
            data: { enrolledCount: { increment: 1 } }
        })

        return updatedOrder;
    });

    return validationData;
};

export const PaymentService = {
    initiatePayment,
    markPaymentFailed,
    markPaymentCancelled,
    validatePayment
};

