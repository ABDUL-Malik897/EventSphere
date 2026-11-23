
import express from "express";

import {
    getCheckInDetails,
    admitGuests
} from "../controllers/admissionPass.controller.js";

import {
    requireAuth,
    authorizeRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(authorizeRoles("ORGANIZER"));

router.get("/:token", getCheckInDetails);
router.post("/:token/admit", admitGuests);

export default router;
