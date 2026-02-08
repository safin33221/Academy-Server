import bcrypt from "bcrypt";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import prisma from "../../../lib/prisma.js";
import env from "../../config/env.config.js";
import ApiError from "../../error/ApiError.js";
import httpStatus from "../../utils/httpStatus.js";
import { ILoginPayload, IRegisterPayload } from "./auth.interface.js";

/* ---------------------------------- */
/* Token Generator */
/* ---------------------------------- */
const generateToken = (
    payload: object,
    secret: Secret,
    expiresIn: SignOptions["expiresIn"]
): string => {
    return jwt.sign(payload, secret, { expiresIn });
};

/* ---------------------------------- */
/* Register */
/* ---------------------------------- */
const register = async (payload: IRegisterPayload) => {
    const hashedPassword = await bcrypt.hash(
        payload.password,
        Number(env.BCRYPT_SALT_ROUNDS)
    );

    const user = await prisma.user.create({
        data: {
            firstName: payload.firstName,
            lastName: payload.lastName,
            email: payload.email,
            password: hashedPassword,
        },
    });

    return {
        id: user.id,
        email: user.email,
        role: user.role,
    };
};

/* ---------------------------------- */
/* Login */
/* ---------------------------------- */
const login = async (payload: ILoginPayload) => {
    const user = await prisma.user.findUnique({
        where: { email: payload.email },
    });

    if (!user) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    if (!user.isActive) {
        throw new ApiError(httpStatus.FORBIDDEN, "Account is disabled");
    }

    const isPasswordMatched = await bcrypt.compare(
        payload.password,
        user.password
    );

    if (!isPasswordMatched) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid credentials");
    }

    const accessToken = generateToken(
        { userId: user.id, role: user.role },
        env.JWT_ACCESS_SECRET as Secret,
        parseInt(env.JWT_ACCESS_EXPIRES_IN)
    );

    const refreshToken = generateToken(
        { userId: user.id },
        env.JWT_REFRESH_SECRET as Secret,
        parseInt(env.JWT_REFRESH_EXPIRES_IN)
    );

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    };
};

/* ---------------------------------- */
/* Refresh Access Token */
/* ---------------------------------- */
const refreshAccessToken = async (token: string) => {
    try {
        const decoded = jwt.verify(
            token,
            env.JWT_REFRESH_SECRET as Secret
        ) as { userId: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user || !user.isActive) {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Unauthorized");
        }

        const newAccessToken = generateToken(
            { userId: user.id, role: user.role },
            env.JWT_ACCESS_SECRET as Secret,
            parseInt(env.JWT_ACCESS_EXPIRES_IN)
        );

        return {
            accessToken: newAccessToken,
        };
    } catch {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
    }
};

export const AuthService = {
    register,
    login,
    refreshAccessToken,
};
