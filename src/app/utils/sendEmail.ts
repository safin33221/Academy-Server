import nodemailer from "nodemailer";
import path from "path";
import ejs from "ejs";
import envConfig from "../config/env.config.js";
import { fileURLToPath } from 'url';
import env from "../config/env.config.js";

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
    host: env.SMTP.HOST,
    port: Number(env.SMTP.PORT),
    secure: Number(env.SMTP.PORT) === 465,
    auth: {
        user: env.SMTP.USER,
        pass: env.SMTP.PASS,
    },
    // Add these for production
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000,
});

interface SendEmailOption {
    to: string;
    subject: string;
    templateName: string;
    templateData?: Record<string, any>;
    attachments?: {
        fileName: string;
        content?: Buffer | string;
        path?: string;
        contentType?: string;
    }[];
}

// Helper function to find template path
const getTemplatePath = (templateName: string) => {
    const templateFile = `${templateName}.ejs`;

    // Multiple possible locations (development vs production)
    const possiblePaths = [
        // Development path (src folder)
        path.resolve(process.cwd(), "src", "app", "utils", "templates", templateFile),
        // Production path (dist folder)
        path.resolve(process.cwd(), "dist", "app", "utils", "templates", templateFile),
        // Relative path from current file
        path.resolve(__dirname, "templates", templateFile),
        // Another possible production path
        path.resolve(process.cwd(), "templates", templateFile),
    ];

    // Try each path
    for (const templatePath of possiblePaths) {
        try {
            // Check if file exists (using require for sync check)
            const fs = require('fs');
            if (fs.existsSync(templatePath)) {
                console.log(`✅ Found template at: ${templatePath}`);
                return templatePath;
            }
        } catch (error) {
            continue;
        }
    }

    // Fallback: create absolute path
    return path.resolve(__dirname, "templates", templateFile);
};

export const sendEmail = async ({
    to,
    subject,
    templateName,
    templateData = {},
    attachments,
}: SendEmailOption) => {
    try {
        // Get the correct template path
        const templatePath = getTemplatePath(templateName);
        console.log(`📄 Rendering template from: ${templatePath}`);

        // Render the template
        const html = await ejs.renderFile(templatePath, templateData);

        console.log(`📧 Attempting to send email to: ${to}`);
        console.log(`🔧 SMTP Config: ${envConfig.SMTP.HOST}:${envConfig.SMTP.PORT}`);

        const info = await transporter.sendMail({
            from: envConfig.SMTP.FROM_EMAIL,
            to,
            subject,
            html,
            attachments: attachments?.map((a) => ({
                filename: a.fileName,
                content: a.content,
                path: a.path,
                contentType: a.contentType,
            })),
        });

        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error: any) {
        console.error("❌ Email sending error details:");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Error command:", error.command);

        // For debugging, check if template was found
        try {
            const fs = require('fs');
            const templatePath = getTemplatePath(templateName);
            console.log(`Template exists: ${fs.existsSync(templatePath)}`);
            console.log(`Template path: ${templatePath}`);
        } catch (e) {
            console.error("Template check failed:", error.message);
        }

        throw new Error(error.message || "Email sending failed");
    }
};