import express from "express";

import {
    getMyAdmissionPasses,
    getMyAdmissionPassById
} from "../controllers/admissionPass.controller.js";

import {
    requireAuth,
    authorizeRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(authorizeRoles("ATTENDEE", "ORGANIZER"));

router.get("/me", getMyAdmissionPasses);
router.get("/me/:passId", getMyAdmissionPassById);

export default router;