import { NextFunction, Request, Response } from "express";
import { CourseService } from "./course.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import pick from "../../utils/pick.js";
import { userFilterableField, userSearchableField } from "../user/user.constant.js";
import { courseFilterableFields } from "./course.constant.js";

const createCourse = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {

        const instructorId = req?.user?.id as string;

        const result = await CourseService.createCourse(
            req.body,
            instructorId
        );

        sendResponse(res, {
            status: httpCode.CREATED,
            success: true,
            message: "Course created successfully",
            data: result,
        });
    }
);

const getAllCourses = catchAsync(

    async (req: Request, res: Response, _next: NextFunction) => {
        const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder'])
        const filter = pick(req.query, courseFilterableFields)
        const result = await CourseService.getAllCourses(options, filter);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Courses retrieved successfully",
            meta: result.meta,
            data: result.data,
        });
    }
);

const getSingleCourse = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const result = await CourseService.getSingleCourse(
            req.params.id as string
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Course retrieved successfully",
            data: result,
        });
    }
);

const updateCourse = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const result = await CourseService.updateCourse(
            req.params.id as string,
            req.body
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Course updated successfully",
            data: result,
        });
    }
);

const deleteCourse = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        await CourseService.deleteCourse(req.params.id as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Course deleted successfully",
        });
    }
);

const approveCourse = catchAsync(
    async (req: Request, res: Response, _next: NextFunction) => {
        const result = await CourseService.approveCourse(
            req.params.id as string
        );

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Course approved successfully",
            data: result,
        });
    }
);

export const CourseController = {
    createCourse,
    getAllCourses,
    getSingleCourse,
    updateCourse,
    deleteCourse,
    approveCourse,
};
