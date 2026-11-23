
import express from "express";

import {
    getMyCart,
    addCartItem,
    updateCartItem,
    removeCartItem,
    clearCart
} from "../controllers/cart.controller.js";

import {
    requireAuth,
    authorizeRoles
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Attendees and approved organizers can purchase tickets.
// Admin accounts are kept separate from the customer cart.
router.use(requireAuth);
router.use(authorizeRoles("ATTENDEE", "ORGANIZER"));

router.get("/", getMyCart);
router.post("/items", addCartItem);
router.patch("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", removeCartItem);
router.delete("/", clearCart);

export default router;
