import express from "express";
import rateLimit from "express-rate-limit";

import {
    register,
    login,
    logout,
    getMe
} from "../controllers/auth.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Please try again later."
    }
});

router.post("/register", authLimiter, register);

router.post("/login", authLimiter, login);

router.post("/logout", logout);

router.get("/me", requireAuth, getMe);

export default router;