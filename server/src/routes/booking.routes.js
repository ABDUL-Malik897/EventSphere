import express from "express";

import {
    createReservation,
    getMyBookings,
    getBookingById,
    cancelReservation
} from "../controllers/booking.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", createReservation);

router.get("/me", getMyBookings);

router.get("/:id", getBookingById);

router.patch("/:id/cancel", cancelReservation);

export default router;