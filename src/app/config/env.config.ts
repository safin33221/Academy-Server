import dotenv from "dotenv";
import path from "path";

/* =======================
   Load .env
======================= */
dotenv.config({
    path: path.join(process.cwd(), ".env"),
});

/* =======================
   Helpers
======================= */
const required = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`❌ Missing required env variable: ${key}`);
    }
    return value;
};

const optional = (key: string): string | undefined => {
    return process.env[key];
};

const toNumber = (key: string, fallback?: number): number => {
    const value = process.env[key];
    if (!value && fallback !== undefined) return fallback;

    const num = Number(value);
    if (isNaN(num)) {
        throw new Error(`❌ Env variable ${key} must be a number`);
    }
    return num;
};

/* =======================
   Environment Config
======================= */
const env = {
    /* App */
    NODE_ENV: optional("NODE_ENV") || "development",
    PORT: toNumber("PORT", 5000),

    /* Database */
    DATABASE_URL: required("DATABASE_URL"),

    /* Security */
    JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),

    JWT_ACCESS_EXPIRES_IN: optional("JWT_ACCESS_EXPIRES_IN") || "7d",
    JWT_REFRESH_EXPIRES_IN: optional("JWT_REFRESH_EXPIRES_IN") || "90d",

    BCRYPT_SALT_ROUNDS: toNumber("BCRYPT_SALT_ROUNDS", 10),

    /* CORS */
    CORS_ORIGIN: optional("CORS_ORIGIN") || "*",

    /* SMTP */
    SMTP: {
        HOST: optional("SMTP_HOST"),
        PORT: toNumber("SMTP_PORT", 587),
        USER: optional("SMTP_USER"),
        PASS: optional("SMTP_PASS"),
        FROM_NAME: optional("SMTP_FROM_NAME"),
        FROM_EMAIL: optional("SMTP_FROM_EMAIL"),
    },
    REDIS: {
        REDIS_HOST: required("REDIS_HOST"),
        REDIS_PORT: required("REDIS_PORT"),
        REDIS_PASSWORD: required("REDIS_PASSWORD"),
        REDIS_USERNAME: required("REDIS_USERNAME")
    },

    CLOUDINARY: {
        CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
        CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
        CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET")
    },
    /* File Upload */
    UPLOAD_DIR: optional("UPLOAD_DIR") || "uploads",
    MAX_FILE_SIZE: toNumber("MAX_FILE_SIZE", 10 * 1024 * 1024),

    /* Rate Limiting */
    RATE_LIMIT_WINDOW_MS: toNumber("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    RATE_LIMIT_MAX: toNumber("RATE_LIMIT_MAX", 100),
} as const;

export default env;
