import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import healthRoutes from "./routes/health.routes.js";
import eventRoutes from "./routes/event.routes.js";
import authRoutes from "./routes/auth.routes.js";
import organizerApplicationRoutes from "./routes/organizerApplication.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import organizerEventRoutes from "./routes/organizerEvent.routes.js";
import { razorpayWebhook } from "./controllers/payment.controller.js";
import cartRoutes from "./routes/cart.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import admissionPassRoutes from "./routes/admissionPass.routes.js";
import checkinRoutes from "./routes/checkin.routes.js";



const app = express();

// Security
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));

// Logging
app.use(morgan("dev"));

// Razorpay requires the original raw body for webhook verification.
// This route MUST be registered before express.json().
app.post("/api/webhooks/razorpay",
    express.raw({
        type: "application/json",
        limit: "1mb"
    }),
    razorpayWebhook
);

// Normal API body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Cookies
app.use(cookieParser());

// API routes
app.use("/api/health", healthRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/organizer-applications", organizerApplicationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizer/events", organizerEventRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkouts", checkoutRoutes);
app.use("/api/admission-passes", admissionPassRoutes);
app.use("/api/checkin", checkinRoutes);


// Unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});

export default app;