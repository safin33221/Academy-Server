class ApiError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(
        statusCode: number,
        message = "Something went wrong",
        isOperational = true,
        stack?: string
    ) {
        super(message);

        this.statusCode = statusCode;
        this.isOperational = isOperational;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default ApiError;

