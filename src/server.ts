import app from "./app.js";
import prisma from "./lib/prisma.js";
const PORT = Number(process.env.PORT) || 5000;
async function bootstrap() {
    try {
        await prisma.$connect();
        console.log('🟢 Database connected');

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('🔴 Failed to start server', error);
        process.exit(1);
    }

}