import axios from "axios";

export async function getZoomAccessToken() {
    const response = await axios.post(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
        {},
        {
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(
                        process.env.ZOOM_CLIENT_ID +
                        ":" +
                        process.env.ZOOM_CLIENT_SECRET
                    ).toString("base64"),
            },
        }
    );

    return response.data.access_token;
}