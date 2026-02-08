import app from "./app.js";
import prisma from "./lib/prisma.js";

const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

async function startServer() {
    try {
        // Database connection
        await prisma.$connect();
        console.log("✅ Database connected successfully");

        // Start HTTP server
        const server = app.listen(PORT, () => {
            console.log(
                `🚀 Server started | ENV: ${NODE_ENV} | PORT: ${PORT}`
            );
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`⚠️  ${signal} received. Shutting down gracefully...`);

            server.close(async () => {
                try {
                    await prisma.$disconnect();
                    console.log("🛑 Database disconnected");
                    process.exit(0);
                } catch (err) {
                    console.error("❌ Error during shutdown", err);
                    process.exit(1);
                }
            });
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);

    } catch (error) {
        console.error("❌ Server startup failed", error);
        process.exit(1);
    }
}

startServer();
