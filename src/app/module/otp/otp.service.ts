import bcrypt from "bcrypt";

import { ISendOtpPayload, IVerifyOtpPayload } from "./otp.interface.js";
import prisma from "../../../lib/prisma.js";
import ApiError from "../../error/ApiError.js";
import httpCode from "../../utils/httpStatus.js";
import { redisClient } from "../../config/redis.config.js";
import { sendEmail } from "../../utils/sendEmail.js";


const OTP_TTL_SECONDS = 300;
const OTP_PREFIX = "otp:";

const generateOtp = () =>
    Math.floor(100000 + Math.random() * 900000).toString();

/* ---------------------------------- */
/* Send OTP */
/* ---------------------------------- */
const sendOtp = async ({ email }: ISendOtpPayload) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        throw new ApiError(httpCode.NOT_FOUND, "User not found");
    }

    if (user.isVerified) {
        throw new ApiError(httpCode.BAD_REQUEST, "User already verified");
    }
    const name = `${user.firstName} ${user.lastName}`

    const otp = generateOtp();
    const hash = await bcrypt.hash(otp, 10);

    const redisKey = `${OTP_PREFIX}${email}`;

    // overwrite existing OTP
    await redisClient.set(redisKey, hash, {
        "EX": OTP_TTL_SECONDS
    });

    await sendEmail({
        to: user.email,
        subject: "Your OTP Code | Future Programmer Innovators Club",
        templateName: "otp",
        templateData: { name, otp },
    });

    return true;
};

/* ---------------------------------- */
/* Verify OTP */
/* ---------------------------------- */
const verifyOtp = async ({ email, otp }: IVerifyOtpPayload) => {
    const redisKey = `${OTP_PREFIX}${email} `;

    const storedHash = await redisClient.get(redisKey);

    if (!storedHash) {
        throw new ApiError(httpCode.BAD_REQUEST, "OTP expired or not found");
    }

    const isMatched = await bcrypt.compare(otp, storedHash);

    if (!isMatched) {
        throw new ApiError(httpCode.BAD_REQUEST, "Invalid OTP");
    }

    await prisma.user.update({
        where: { email },
        data: { isVerified: true },
    });

    await redisClient.del(redisKey);

    return true;
};

export const OtpService = {
    sendOtp,
    verifyOtp,
};
