import axios from "axios";
import crypto from "crypto";
import { Request } from "express";
import prisma from "../../../lib/prisma.js";
import { getZoomAccessToken } from "../../../lib/zoom.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

export const createZoomMeeting = async (payload: {
    topic: string;
    startTime: Date | string;
    duration: number;
}) => {
    try {
        const startTime =
            payload.startTime instanceof Date
                ? payload.startTime
                : new Date(payload.startTime);

        if (Number.isNaN(startTime.getTime())) {
            throw new ApiError(httpCode.BAD_REQUEST, "Invalid startTime");
        }

        const token = await getZoomAccessToken();
        const zoomUserId = (process.env.ZOOM_USER_ID || "me")
            .split("#")[0]
            .trim();

        const response = await axios.post(
            `https://api.zoom.us/v2/users/${encodeURIComponent(zoomUserId)}/meetings`,
            {
                topic: payload.topic,
                type: 2,
                start_time: startTime.toISOString(),
                duration: payload.duration,
                timezone: "Asia/Dhaka",
                settings: {
                    waiting_room: true,
                    join_before_host: false,
                    auto_recording: "cloud",
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        return response.data;
    } catch (error: any) {
        const zoomErrorPayload = error?.response?.data;
        const zoomErrorMessage =
            zoomErrorPayload?.message ||
            (zoomErrorPayload
                ? JSON.stringify(zoomErrorPayload)
                : undefined);

        throw new ApiError(
            httpCode.BAD_REQUEST,
            zoomErrorMessage ||
            error?.message ||
            "Zoom meeting creation failed"
        );
    }
};

const ZOOM_SIGNATURE_VERSION = "v0";
const ZOOM_SIGNATURE_TTL_SECONDS = 300;

type ZoomWebhookResult = {
    statusCode: number;
    body: Record<string, unknown>;
};

const getHeaderValue = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0];
    return value;
};

const getRawRequestBody = (req: Request) => {
    const rawBody = (req as Request & { rawBody?: string | Buffer }).rawBody;

    if (typeof rawBody === "string") return rawBody;
    if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");

    return JSON.stringify(req.body ?? {});
};

const isValidSignature = (expected: string, received: string) => {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);

    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

export const processZoomWebhook = async (
    req: Request
): Promise<ZoomWebhookResult> => {
    const secretToken = process.env.ZOOM_WEBHOOK_SECRET;

    if (!secretToken) {
        throw new ApiError(
            httpCode.INTERNAL_SERVER_ERROR,
            "ZOOM_WEBHOOK_SECRET is not configured"
        );
    }

    const requestTimestamp = getHeaderValue(
        req.headers["x-zm-request-timestamp"]
    );
    const requestSignature = getHeaderValue(req.headers["x-zm-signature"]);

    if (!requestTimestamp || !requestSignature) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Missing Zoom signature headers" },
        };
    }

    const timestampNumber = Number(requestTimestamp);
    if (!Number.isFinite(timestampNumber)) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Invalid Zoom timestamp header" },
        };
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - timestampNumber) > ZOOM_SIGNATURE_TTL_SECONDS) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Stale Zoom webhook request" },
        };
    }

    const rawBody = getRawRequestBody(req);
    const message = `${ZOOM_SIGNATURE_VERSION}:${requestTimestamp}:${rawBody}`;

    const hashForVerify = crypto
        .createHmac("sha256", secretToken)
        .update(message)
        .digest("hex");

    const signature = `${ZOOM_SIGNATURE_VERSION}=${hashForVerify}`;

    if (!isValidSignature(signature, requestSignature)) {
        return {
            statusCode: httpCode.UNAUTHORIZED,
            body: { message: "Invalid Zoom signature" },
        };
    }

    const event = req.body?.event;
    const payload = req.body?.payload;

    if (event === "endpoint.url_validation") {
        const plainToken = payload?.plainToken;

        if (!plainToken || typeof plainToken !== "string") {
            return {
                statusCode: httpCode.BAD_REQUEST,
                body: { message: "Invalid Zoom plainToken" },
            };
        }

        const encryptedToken = crypto
            .createHmac("sha256", secretToken)
            .update(plainToken)
            .digest("hex");

        return {
            statusCode: httpCode.OK,
            body: { plainToken, encryptedToken },
        };
    }

    if (event === "recording.completed") {
        const meetingId = payload?.object?.id
            ? String(payload.object.id)
            : null;

        const recordingFiles = Array.isArray(payload?.object?.recording_files)
            ? payload.object.recording_files
            : [];

        const mp4File = recordingFiles.find(
            (file: any) => file.file_type === "MP4"
        );

        if (meetingId && mp4File?.play_url) {
            await prisma.batchClass.updateMany({
                where: { zoomMeetingId: meetingId },
                data: {
                    recordingUrl: mp4File.play_url,
                    status: "ENDED",
                },
            });
        }
    }

    return {
        statusCode: httpCode.OK,
        body: { received: true },
    };
};

export const zoomService = {
    createZoomMeeting,
    processZoomWebhook,
};
