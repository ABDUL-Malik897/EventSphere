
import express from "express";

import {
    createCheckout,
    getCheckoutById,
    getMyCheckouts
} from "../controllers/checkout.controller.js";

import {
    requireAuth,
    authorizeRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(authorizeRoles("ATTENDEE", "ORGANIZER"));

router.post("/", createCheckout);
router.get("/me", getMyCheckouts);
router.get("/:id", getCheckoutById);

export default router;
