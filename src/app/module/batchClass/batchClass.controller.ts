import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import { batchClassService } from "./batchClass.service.js";

/* =====================================================
   Instructor: Create Class
===================================================== */

const createClass = catchAsync(async (req: Request, res: Response) => {
    const result = await batchClassService.createClass(
        req.user,
        req.body
    );

    sendResponse(res, {
        status: httpCode.OK,
        success: true,
        message: "Class created successfully",
        data: result,
    });
});

/* =====================================================
   Instructor: Get All Own Classes (Manage Page)
===================================================== */

const getInstructorClasses = catchAsync(
    async (req: Request, res: Response) => {
        const result =
            await batchClassService.getInstructorClasses(

                req?.params.id
            );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Instructor classes retrieved successfully",
            data: result,
        });
    }
);

/* =====================================================
   Instructor: Get Single Class
===================================================== */

const getInstructorSingleClass = catchAsync(
    async (req: Request, res: Response) => {
        const result =
            await batchClassService.getInstructorSingleClass(
                req?.user?.id as string,
                req.params.id
            );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Class retrieved successfully",
            data: result,
        });
    }
);

/* =====================================================
   Instructor: Update Class
===================================================== */

const updateClass = catchAsync(
    async (req: Request, res: Response) => {
        const result = await batchClassService.updateClass(
            req?.user?.id as string,
            req.params.id,
            req.body
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Class updated successfully",
            data: result,
        });
    }
);

/* =====================================================
   Instructor: Delete Class
===================================================== */

const deleteClass = catchAsync(
    async (req: Request, res: Response) => {
        const result = await batchClassService.deleteClass(
            req?.user?.id as string,
            req.params.id
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Class deleted successfully",
            data: result,
        });
    }
);

/* =====================================================
   Student: Get Enrolled Classes
===================================================== */

const getStudentClasses = catchAsync(
    async (req: Request, res: Response) => {
        const result =
            await batchClassService.getStudentClasses(
                req?.user?.id as string,
                req.params.slug
            );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Student classes retrieved successfully",
            data: result,
        });
    }
);

/* =====================================================
   Export Controller
===================================================== */

export const BatchClassController = {
    // Instructor
    createClass,
    getInstructorClasses,
    getInstructorSingleClass,
    updateClass,
    deleteClass,

    // Student
    getStudentClasses,
};