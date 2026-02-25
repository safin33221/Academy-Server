import prisma from "../../../lib/prisma.js";
import { zoomService } from "../zoom/zoom.service.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";

const calculateStatus = (startTime: Date, duration: number) => {
    const now = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (now < startTime) return "UPCOMING";
    if (now >= startTime && now <= endTime) return "ONGOING";
    return "ENDED";
};

const createClass = async (user: any, payload: any) => {
    if (!payload?.title || typeof payload.title !== "string") {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid title");
    }

    const duration = Number(payload.duration);

    if (!Number.isFinite(duration) || duration <= 0) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid duration");
    }

    const startTime = new Date(payload.startTime);

    if (Number.isNaN(startTime.getTime())) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid startTime");
    }

    const zoomMeeting = await zoomService.createZoomMeeting({
        topic: payload.title,
        startTime,
        duration,
    });

    const classData = await prisma.batchClass.create({
        data: {
            batchId: payload.batchId,
            instructorId: user.id,
            title: payload.title,
            startTime,
            duration,
            zoomMeetingId: String(zoomMeeting.id),
            zoomJoinUrl: zoomMeeting.join_url,
            zoomStartUrl: zoomMeeting.start_url,
        },
    });

    return classData;
};

const getStudentClasses = async (userId: string) => {

    const classes = await prisma.batchClass.findMany({
        where: {
            batch: {
                enrollments: {
                    some: {
                        userId: userId
                    }
                }
            }
        },
        orderBy: { startTime: 'asc' }
    });


    const formatted = classes.map(cls => ({
        ...cls,
        status: calculateStatus(cls.startTime, cls.duration)
    }));

    return formatted;
};


export const batchClassService = {
    createClass,
    getStudentClasses
}
