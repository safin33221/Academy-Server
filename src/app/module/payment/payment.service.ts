
import { v4 as uuidv4 } from "uuid";

import { PaymentStatus, UserRole } from "@prisma/client";
import prisma from "../../../lib/prisma.js";
import { SSLService } from "../sslCommerz/sslCommerz.service.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";
import { tuple } from "zod";

const initiatePayment = async (userId: string, payload: { batchId: string }) => {
    const { batchId } = payload;

    if (!batchId) {
        throw new ApiError(httpCode.BAD_REQUEST, "Batch ID is required.");
    }

    // 1️⃣ Fetch user & batch in parallel
    const [user, batch] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.batch.findUnique({
            where: { id: batchId },
            include: { course: true },
        }),
    ]);

    if (!user) {
        throw new ApiError(httpCode.NOT_FOUND, "User account not found.");
    }

    if (!batch) {
        throw new ApiError(httpCode.NOT_FOUND, "Selected batch does not exist.");
    }

    const price = Number(batch.course?.discountPrice ?? batch.course?.price);

    if (!price || price <= 0) {
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Invalid course pricing configuration."
        );
    }

    // 2️⃣ Prevent duplicate enrollment
    const alreadyEnrolled = await prisma.enrollment.findUnique({
        where: {
            userId_batchId: { userId, batchId },
        },
    });

    if (alreadyEnrolled) {
        throw new ApiError(
            httpCode.CONFLICT,
            "You are already enrolled in this course."
        );
    }

    // 3️⃣ Reuse existing pending order
    const existingPendingOrder = await prisma.order.findFirst({
        where: {
            userId,
            batchId,
            status: PaymentStatus.PENDING,
        },
    });

    if (existingPendingOrder) {
        const response = await SSLService.sslPaymentInit({
            amount: existingPendingOrder.amount,
            transactionId: existingPendingOrder.transactionId,
            name: user.name,
            email: user.email,
            phoneNumber: user.phone,
            address: "N/A",
        });

        return { gatewayUrl: response.GatewayPageURL };
    }

    // 4️⃣ Create order + payment atomically
    const order = await prisma.$transaction(async (tx) => {
        const transactionId = uuidv4();

        const createdOrder = await tx.order.create({
            data: {
                userId,
                batchId,
                amount: price,
                transactionId,
                status: PaymentStatus.PENDING,
            },
        });

        await tx.payment.create({
            data: {
                orderId: createdOrder.id,
                gatewayName: "SSLCommerz",
                status: PaymentStatus.PENDING,
            },
        });

        return createdOrder;
    });

    // 5️⃣ Call Payment Gateway outside transaction
    try {
        const response = await SSLService.sslPaymentInit({
            amount: order.amount,
            transactionId: order.transactionId,
            name: user.name,
            email: user.email,
            phoneNumber: user.phone,
            address: "N/A",
        });

        if (!response?.GatewayPageURL) {
            throw new Error("Invalid gateway response.");
        }

        return { gatewayUrl: response.GatewayPageURL };

    } catch (error) {

        // Mark order + payment failed safely
        await prisma.$transaction([
            prisma.order.update({
                where: { id: order.id },
                data: { status: PaymentStatus.FAILED },
            }),
            prisma.payment.updateMany({
                where: { orderId: order.id },
                data: { status: PaymentStatus.FAILED },
            }),
        ]);

        throw new ApiError(
            httpCode.BAD_GATEWAY,
            "Failed to initialize payment gateway. Please try again."
        );
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


const getMyPaymentHistory = async (id: string) => {
    const result = await prisma.order.findMany({
        where: { userId: id },
        include: {
            payment: true,
            batch: {
                include: {
                    course: true
                }
            }
        }

    })
    return result
}

export const PaymentService = {
    initiatePayment,
    markPaymentFailed,
    markPaymentCancelled,
    validatePayment,
    getMyPaymentHistory
};

