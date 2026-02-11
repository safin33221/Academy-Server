import { z } from "zod";

/* ---------------- ENUMS ---------------- */

const courseTypeEnum = z.enum(["ONLINE", "OFFLINE", "HYBRID"]);
const courseAccessEnum = z.enum(["FREE", "PAID"]);
const courseLevelEnum = z.enum([
    "BEGINNER",
    "INTERMEDIATE",
    "ADVANCED",
]);

/* ---------------- CREATE ---------------- */
const createCourseZodSchema = z.object({
    body: z
        .object({
            title: z
                .string()
                .min(3, "Title must be at least 3 characters"),

            description: z
                .string()
                .min(20, "Description must be at least 20 characters"),

            type: courseTypeEnum,
            access: courseAccessEnum,
            level: courseLevelEnum,


            price: z.number().nonnegative().optional(),

            isPremium: z.boolean().optional(),

            categoryId: z
                .string()
                .min(1, "Category is required").optional(),

            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional(),

            location: z.string().optional(),
            thumbnail: z.string().url("Invalid thumbnail URL").optional(),
        })
        .refine(
            (data) => {
                if (data.access === "PAID") {
                    return data.price && data.price > 0;
                }
                return true;
            },
            {
                message: "Price must be greater than 0 for paid courses",
                path: ["price"],
            }
        )
        .refine(
            (data) => {
                if (data.type === "OFFLINE") {
                    return !!data.location;
                }
                return true;
            },
            {
                message: "Location is required for offline courses",
                path: ["location"],
            }
        ),
});

/* ---------------- UPDATE ---------------- */

const updateCourseZodSchema = z.object({
    body: z.object({
        title: z.string().min(3).optional(),
        description: z.string().min(20).optional(),
        type: courseTypeEnum.optional(),
        access: courseAccessEnum.optional(),
        level: courseLevelEnum.optional(),
        price: z.number().nonnegative().optional(),
        isPremium: z.boolean().optional(),
        categoryId: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        location: z.string().optional(),
        thumbnail: z.string().url().optional(),
    }),
});

export const courseValidation = {
    createCourseZodSchema,
    updateCourseZodSchema
}
