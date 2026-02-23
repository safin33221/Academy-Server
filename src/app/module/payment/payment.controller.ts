import { NextFunction, Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import env from "../../config/env.config.js";
import { PaymentService } from "./payment.service.js";
import { SSLService } from "../sslCommerz/sslCommerz.service.js";

const getSslPayload = (req: Request) => {
    if (Object.keys(req.body || {}).length) {
        return req.body;
    }
    return req.query;
};

/* ===============================
   INITIATE PAYMENT
================================= */
const initiatePayment = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const userId = req.user?.id;

        const result = await PaymentService.initiatePayment(
            userId as string,
            req.body
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Payment initiated successfully",
            data: result,
        });
    }
);

/* ===============================
   PAYMENT SUCCESS (SSL Callback)
================================= */
const paymentSuccess = catchAsync(
    async (req: Request, res: Response) => {
        const payload = getSslPayload(req);


        const validationData = await PaymentService.validatePayment(payload);

        res.redirect(
            `${env.SSL.SSL_SUCCESS_FRONTEND_URL}?transactionId=${validationData.tran_id}`
        );
    }
);

/* ===============================
   PAYMENT FAIL
================================= */
const paymentFail = catchAsync(
    async (req: Request, res: Response) => {
        const payload = getSslPayload(req);
        await PaymentService.markPaymentFailed(payload.tran_id as string);

        res.redirect(
            `${env.SSL.SSL_FAIL_FRONTEND_URL}?transactionId=${payload.tran_id as string}`
        );
    }
);

/* ===============================
   PAYMENT CANCEL
================================= */
const paymentCancel = catchAsync(
    async (req: Request, res: Response) => {
        const payload = getSslPayload(req);
        await PaymentService.markPaymentCancelled(payload.tran_id as string);

        res.redirect(
            `${env.SSL.SSL_CANCEL_FRONTEND_URL}?transactionId=${payload.tran_id as string}`
        );
    }
);

/* ===============================
   IPN (Recommended for production)
================================= */
const paymentIPN = catchAsync(
    async (req: Request, res: Response) => {
        const payload = getSslPayload(req);
        await SSLService.validatePayment(payload);

        res.status(200).json({ received: true });
    }
);


const getMyPaymentHistory = catchAsync(
    async (req: Request, res: Response) => {
        const userId = req?.user?.id
        const result = await PaymentService.getMyPaymentHistory(userId as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Payment History retrieve successfully",
            data: result,
        });
    }
);

export const PaymentController = {
    initiatePayment,
    paymentSuccess,
    paymentFail,
    paymentCancel,
    paymentIPN,
    getMyPaymentHistory

};
