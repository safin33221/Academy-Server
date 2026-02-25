import prisma from "../../../lib/prisma.js";
import { zoomService } from "../zoom/zoom.service.js";


const calculateStatus = (startTime: Date, duration: number) => {
    const now = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    if (now < startTime) return "UPCOMING";
    if (now >= startTime && now <= endTime) return "ONGOING";
    return "ENDED";
};


const createClass = async (user: any, payload: any) => {

    // 1️⃣ Create Zoom meeting
    const zoomMeeting = await zoomService.createZoomMeeting({
        topic: payload.title,
        startTime: payload.startTime,
        duration: payload.duration,

    });

    // 2️⃣ Save class in DB
    const classData = await prisma.batchClass.create({
        data: {
            batchId: payload.batchId,
            instructorId: user.id,
            title: payload.title,
            startTime: payload.startTime,
            duration: payload.duration,
            zoomMeetingId: zoomMeeting.id,
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