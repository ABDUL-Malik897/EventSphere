import "./config/loadEnv.js";

import app from "./app.js";
import connectDB from "./config/db.js";
import { startBookingExpiryJob } from "./jobs/bookingExpiry.job.js";

const PORT = process.env.PORT || 5000; 

const startServer = async () => {
    try {
        await connectDB();

        startBookingExpiryJob();

        app.listen(PORT, () => {
            console.log(`EventSphere server running on port ${PORT}`);
            console.log(`API: http://localhost:${PORT}/api/health`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
};

startServer();