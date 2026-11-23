import express from "express";

import {
    createOrganizerEvent,
    getMyEvents,
    getMyEventById,
    updateOrganizerEvent,
    deleteOrganizerEvent,
    cancelOrganizerEvent
} from "../controllers/organizerEvent.controller.js";

import {
    requireAuth,
    authorizeRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(authorizeRoles("ORGANIZER"));

router.get("/", getMyEvents);
router.post("/", createOrganizerEvent);

router.get("/:id", getMyEventById);
router.put("/:id", updateOrganizerEvent);
router.delete("/:id", deleteOrganizerEvent);
router.patch("/:id/cancel", cancelOrganizerEvent);

export default router;