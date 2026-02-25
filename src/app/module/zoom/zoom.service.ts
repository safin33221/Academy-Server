import axios from "axios";
import crypto from "crypto";
import prisma from "../../../lib/prisma.js";
import { getZoomAccessToken } from "../../../lib/zoom.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";


// 🔹 Create Meeting
export const createZoomMeeting = async (payload: {
    topic: string;
    startTime: Date;
    duration: number;
}) => {
    try {
        const token = await getZoomAccessToken();

        const response = await axios.post(
            `https://api.zoom.us/v2/users/me/meetings`,
            {
                topic: payload.topic,
                type: 2,
                start_time: payload.startTime.toISOString(),
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
        throw new ApiError(
            httpCode.BAD_REQUEST,
            error?.response?.data?.message || "Zoom meeting creation failed"
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