import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma.js";


interface JwtPayload {
    id: string;
    role: string;
    iat?: number;
    exp?: number;
}

interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
}

const auth: (...roles: string[]) => RequestHandler =
    (...roles: string[]) =>
        async (req, res, next) => {
            try {
                const authHeader = req.header("authorization");

                if (!authHeader || !authHeader.startsWith("Bearer ")) {
                    return res.status(401).json({
                        success: false,
                        message: "Unauthorized access",
                    });
                }

                const token = authHeader.split(" ")[1];

                const decoded = jwt.verify(
                    token,
                    process.env.JWT_SECRET as string
                ) as JwtPayload;

                const user = await prisma.user.findUnique({
                    where: { id: decoded.id },
                });

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: "User not found",
                    });
                }

                if (user.isBlocked) {
                    return res.status(403).json({
                        success: false,
                        message: "Account is blocked",
                    });
                }

                // Role Check
                if (roles.length && !roles.includes(user.role)) {
                    return res.status(403).json({
                        success: false,
                        message: "Forbidden access",
                    });
                }

                const authReq = req as AuthenticatedRequest;
                authReq.user = {
                    id: user.id,
                    role: user.role,
                };

                next();
            } catch (error) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired token",
                });
            }
        };

export default auth;
