import { z } from "zod";


const registerSchema = z.object({
    body: z.object({
        name: z
            .string()
            .trim()
            .min(2, "Name must be at least 2 characters"),

        email: z
            .string()
            .trim()
            .toLowerCase()
            .email("Invalid email address")
            .max(255, "Email is too long"),

        password: z
            .string()
            .min(6, "Password must be at least 6 characters")
            .max(100, "Password is too long"),

        phone: z
            .string()
            .trim()
            .regex(
                /^\+?[1-9]\d{7,14}$/,
                "Phone number must be valid (8–15 digits, optional +)"
            ),
    }),
});


const loginSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(4),
    }),
});



export const authValidation = {
    registerSchema,
    loginSchema
}
