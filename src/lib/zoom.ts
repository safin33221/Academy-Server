import axios from "axios";

export async function getZoomAccessToken() {
    const accountId = process.env.ZOOM_ACCOUNT_ID?.trim();
    const clientId = process.env.ZOOM_CLIENT_ID?.trim();
    const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();

    if (!accountId || !clientId || !clientSecret) {
        throw new Error(
            "Missing Zoom OAuth env vars. Required: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET."
        );
    }

    try {
        const params = new URLSearchParams({
            grant_type: "account_credentials",
            account_id: accountId,
        });

        const response = await axios.post(
            "https://zoom.us/oauth/token",
            params,
            {
                auth: {
                    username: clientId,
                    password: clientSecret,
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        return response.data.access_token;
    } catch (error: any) {
        const details = error?.response?.data
            ? JSON.stringify(error.response.data)
            : error?.message;
        throw new Error(`Zoom access token failed: ${details}`);
    }
}
