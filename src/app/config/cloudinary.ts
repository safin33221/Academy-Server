// config/cloudinary.ts
import { v2 as cloudinary } from "cloudinary";
import envConfig from "../config/env.config.js";

cloudinary.config({
    cloud_name: envConfig.CLOUDINARY.CLOUDINARY_CLOUD_NAME,
    api_key: envConfig.CLOUDINARY.CLOUDINARY_API_KEY,
    api_secret: envConfig.CLOUDINARY.CLOUDINARY_API_SECRET,
});

export default cloudinary;
