import axios from "axios";
import crypto from "crypto";
import prisma from "../../../lib/prisma.js";
import { getZoomAccessToken } from "../../../lib/zoom.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";


// 🔹 Create Meeting
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


// 🔹 Webhook Business Logic Only
export const processZoomWebhook = async (body: any) => {

    // URL validation
    if (body.event === "endpoint.url_validation") {

        const plainToken = body.payload.plainToken;

        const encryptedToken = crypto
            .createHmac("sha256", process.env.ZOOM_WEBHOOK_SECRET!)
            .update(plainToken)
            .digest("hex");

        return {
            type: "validation",
            data: { plainToken, encryptedToken },
        };
    }

    // Recording completed
    if (body.event === "recording.completed") {

        const meetingId = body.payload.object.id;

        const recordingFile =
            body.payload.object.recording_files?.find(
                (file: any) => file.file_type === "MP4"
            );

        if (recordingFile) {
            await prisma.batchClass.update({
                where: { zoomMeetingId: meetingId.toString() },
                data: { recordingUrl: recordingFile.play_url },
            });
        }

        return { type: "recording_saved" };
    }

    return { type: "ignored" };
};


export const zoomService = {
    createZoomMeeting,
    processZoomWebhook,
};
