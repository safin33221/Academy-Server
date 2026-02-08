export interface ISendOtpPayload {
    email: string;
}

export interface IVerifyOtpPayload {
    email: string;
    otp: string;
}
