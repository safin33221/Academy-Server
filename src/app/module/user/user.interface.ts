import { UserRole } from "@prisma/client";

export interface IUserUpdatePayload {
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    isActive?: boolean;
}
