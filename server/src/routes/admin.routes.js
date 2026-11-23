import express from "express";

import {
    getOrganizerApplications,
    approveOrganizer,
    rejectOrganizer,
    getPendingEvents,
    approveEvent,
    rejectEvent
} from "../controllers/admin.controller.js";

import {
    requireAuth,
    authorizeRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Every route below requires ADMIN.
router.use(requireAuth);
router.use(authorizeRoles("ADMIN"));

router.get("/organizer-applications", getOrganizerApplications);
router.patch("/organizer-applications/:id/approve", approveOrganizer);
router.patch("/organizer-applications/:id/reject", rejectOrganizer);
router.get("/events/pending", getPendingEvents);
router.patch("/events/:id/approve", approveEvent);
router.patch("/events/:id/reject", rejectEvent);

export default router;