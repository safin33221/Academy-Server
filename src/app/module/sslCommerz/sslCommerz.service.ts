/* eslint-disable @typescript-eslint/no-explicit-any */

import axios from "axios";
import qs from "qs";

import env from "../../config/env.config.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";
import { ISSLCommerz } from "./sslCommerz.interface.js";

/* ===============================
   INIT PAYMENT
================================= */
const sslPaymentInit = async (payload: ISSLCommerz) => {
    try {
        if (env.SSL.SSL_PAYMENT_API.includes("/v3/")) {
            throw new ApiError(
                httpCode.BAD_REQUEST,
                `SSLCOMMERZ endpoint is outdated. Current SSL_PAYMENT_API=${env.SSL.SSL_PAYMENT_API}. Use https://sandbox.sslcommerz.com/gwprocess/v4/api.php`
            );
        }

        const data = qs.stringify({
            store_id: env.SSL.SSL_STORE_ID,
            store_passwd: env.SSL.SSL_STORE_PASS,
            total_amount: payload.amount,
            currency: "BDT",
            tran_id: payload.transactionId,

            success_url: `${env.SSL.SSL_SUCCESS_BACKEND_URL}?transactionId=${payload.transactionId}`,
            fail_url: `${env.SSL.SSL_FAIL_BACKEND_URL}?transactionId=${payload.transactionId}`,
            cancel_url: `${env.SSL.SSL_CANCEL_BACKEND_URL}?transactionId=${payload.transactionId}`,
            ipn_url: env.SSL.SSL_IPN_URL,

            shipping_method: "N/A",
            product_name: "Course Payment",
            product_category: "Service",
            product_profile: "general",

            ship_name: payload.name,
            ship_add1: payload.address,
            ship_city: "Dhaka",
            ship_postcode: "1000",
            ship_country: "Bangladesh",

            cus_name: payload.name,
            cus_email: payload.email,
            cus_add1: payload.address,
            cus_city: "Dhaka",
            cus_postcode: "1000",
            cus_country: "Bangladesh",
            cus_phone: payload.phoneNumber,
        });

        const response = await axios.post(
            env.SSL.SSL_PAYMENT_API,
            data,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json",
                },
            }
        );

        const responseData = response.data;

        if (typeof responseData === "string" && responseData.includes("API Endpoint Update Notice")) {
            throw new ApiError(
                httpCode.BAD_REQUEST,
                `SSLCOMMERZ endpoint is outdated. Current SSL_PAYMENT_API=${env.SSL.SSL_PAYMENT_API}. Use https://sandbox.sslcommerz.com/gwprocess/v4/api.php`
            );
        }

        if (typeof responseData === "string") {
            const isHtml = responseData.includes("<html") || responseData.includes("<!DOCTYPE html");
            if (isHtml) {
                throw new ApiError(
                    httpCode.BAD_REQUEST,
                    `SSLCOMMERZ returned HTML instead of JSON. SSL_PAYMENT_API=${env.SSL.SSL_PAYMENT_API}`
                );
            }
        }

        if (!responseData?.GatewayPageURL) {
            console.error("SSLCOMMERZ init unexpected response:", responseData);
            const status = responseData?.status;
            const reason =
                responseData?.failedreason ||
                responseData?.failed_reason ||
                responseData?.message ||
                responseData?.error;

            throw new ApiError(
                httpCode.BAD_REQUEST,
                `Invalid payment gateway response${status ? ` (status: ${status})` : ""}${reason ? ` - ${reason}` : ""}`
            );
        }

        return responseData;
    } catch (error: any) {
        console.error("SSL Payment Init Error:", error.response?.data || error);
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(httpCode.BAD_REQUEST, "Payment initialization failed");
    }
};

/* ===============================
   VALIDATE PAYMENT
================================= */
const validatePayment = async (payload: any) => {
    try {
        const storeId = payload.store_id || env.SSL.SSL_STORE_ID;

        const response = await axios.get(env.SSL.SSL_VALIDATION_API, {
            params: {
                val_id: payload.val_id,
                store_id: storeId,
                store_passwd: env.SSL.SSL_STORE_PASS,
                v: "1",
                format: "json",
            },
            headers: {
                Accept: "application/json",
            },
        });

        const validationData = response.data;

        if (validationData.status !== "VALID") {
            const reason =
                validationData?.failedreason ||
                validationData?.failed_reason ||
                validationData?.error ||
                validationData?.status;
            throw new ApiError(
                httpCode.BAD_REQUEST,
                `Payment not valid${reason ? ` - ${reason}` : ""}`
            );
        }

        return validationData;
    } catch (error: any) {
        console.error("SSL Validation Error:", error.response?.data || error);
        if (error instanceof ApiError) {
            throw error;
        }

        if (error?.response?.status === 500 && payload?.tran_id) {
            try {
                const transactionValidationApi = env.SSL.SSL_VALIDATION_API.replace(
                    "validationserverAPI.php",
                    "merchantTransIDvalidationAPI.php"
                );

                const fallbackResponse = await axios.get(transactionValidationApi, {
                    params: {
                        tran_id: payload.tran_id,
                        store_id: payload.store_id || env.SSL.SSL_STORE_ID,
                        store_passwd: env.SSL.SSL_STORE_PASS,
                        v: "1",
                        format: "json",
                    },
                    headers: {
                        Accept: "application/json",
                    },
                });

                const fallbackData = fallbackResponse.data;
                const firstElement = Array.isArray(fallbackData?.element) ? fallbackData.element[0] : undefined;
                const status = firstElement?.status;

                if (status === "VALID" || status === "VALIDATED") {
                    return firstElement;
                }

                const reason = fallbackData?.failedreason || fallbackData?.APIConnect || status;
                throw new ApiError(
                    httpCode.BAD_REQUEST,
                    `Payment validation failed${reason ? ` - ${reason}` : ""}`
                );
            } catch (fallbackError: any) {
                console.error("SSL Validation Fallback Error:", fallbackError.response?.data || fallbackError);
                if (fallbackError instanceof ApiError) {
                    throw fallbackError;
                }
            }
        }

        if (error?.response) {
            throw new ApiError(
                httpCode.BAD_REQUEST,
                `Payment validation failed with gateway status ${error.response.status}`
            );
        }
        throw new ApiError(
            httpCode.BAD_REQUEST,
            "Payment validation failed"
        );
    }
};

export const SSLService = {
    sslPaymentInit,
    validatePayment,
};
