import { z } from "zod";
import { UserRole } from "@prisma/client";

const objectId = z.string().uuid("Invalid user id");

const booleanString = z.union([
    z.boolean(),
    z.enum(["true", "false"]).transform(v => v === "true"),
]);


export const getAllUsersZodSchema = z.object({
    query: z.object({
        searchTerm: z.string().optional(),

        role: z.nativeEnum(UserRole).optional(),
        isActive: booleanString.optional(),
        isVerified: booleanString.optional(),

        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().positive().optional(),

        sortBy: z.enum([
            "createdAt",
            "updatedAt",
            "firstName",
            "lastName",
            "email",
        ]).optional(),

        sortOrder: z.enum(["asc", "desc"]).optional(),
    }),
});


export const createUserZodSchema = z.object({
    body: z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Invalid email"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        role: z.nativeEnum(UserRole).optional(),
        isActive: z.boolean().optional(),
    }),
});


export const updateUserZodSchema = z.object({
    params: z.object({
        id: objectId,
    }),
    body: z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        role: z.nativeEnum(UserRole).optional(),
        isActive: z.boolean().optional(),
        isVerified: z.boolean().optional(),
    }).refine(data => Object.keys(data).length > 0, {
        message: "At least one field must be updated",
    }),
});


export const getSingleUserZodSchema = z.object({
    params: z.object({
        id: objectId,
    }),
});


export const deleteUserZodSchema = z.object({
    params: z.object({
        id: objectId,
    }),
});
