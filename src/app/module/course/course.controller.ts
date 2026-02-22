import { CourseService } from "./course.service.js";
import catchAsync from "../../shared/catchAsync.js";
import sendResponse from "../../shared/sendResponse.js";
import httpCode from "../../utils/httpStatus.js";
import pick from "../../utils/pick.js";
import { courseFilterableFields } from "./course.constant.js";

const createCourse = catchAsync(
    async (req, res) => {


        const result = await CourseService.createCourse(
            req,

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

    async (req, res) => {
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
    async (req, res) => {
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
    async (req, res) => {
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
    async (req, res) => {
        await CourseService.deleteCourse(req.params.id as string);

        sendResponse(res, {
            status: httpCode.OK,
            success: true,
            message: "Course deleted successfully",
        });
    }
);

const approveCourse = catchAsync(
    async (req, res) => {
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
