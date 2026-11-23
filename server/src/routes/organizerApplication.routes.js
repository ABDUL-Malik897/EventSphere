import express from "express";

import {
    submitApplication,
    getMyApplication
} from "../controllers/organizerApplication.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", submitApplication);
router.get("/me", getMyApplication);

export default router;