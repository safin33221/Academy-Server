declare const env: {
    readonly NODE_ENV: string;
    readonly PORT: number;
    readonly DATABASE_URL: string;
    readonly JWT_SECRET: string;
    readonly JWT_EXPIRES_IN: string;
    readonly BCRYPT_SALT_ROUNDS: number;
    readonly CORS_ORIGIN: string;
    readonly SMTP: {
        readonly HOST: string | undefined;
        readonly PORT: number;
        readonly USER: string | undefined;
        readonly PASS: string | undefined;
        readonly FROM_NAME: string | undefined;
        readonly FROM_EMAIL: string | undefined;
    };
    readonly UPLOAD_DIR: string;
    readonly MAX_FILE_SIZE: number;
    readonly RATE_LIMIT_WINDOW_MS: number;
    readonly RATE_LIMIT_MAX: number;
};
export default env;
//# sourceMappingURL=env.config.d.ts.map