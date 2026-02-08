import app from "./app.js";
import env from "./app/config/env.config.js";
import { connectRedis } from "./app/config/redis.config.js";
import prisma from "./lib/prisma.js";
const PORT = Number(env.PORT) || 5000;
const NODE_ENV = env.NODE_ENV || "development";

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

(async () => {
    await connectRedis();   // ensure connected
    await startServer();      // start server
    // AFTER server start
})();
