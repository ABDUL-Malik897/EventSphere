import express from "express";

import {
    createPaymentOrder,
    verifyPayment
} from "../controllers/payment.controller.js";
import {
    createCheckoutPaymentOrder,
    verifyCheckoutPayment
} from "../controllers/checkoutPayment.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/create-order", createPaymentOrder);

router.post("/verify", verifyPayment);

router.post(
    "/checkout/create-order",
    createCheckoutPaymentOrder
);

router.post(
    "/checkout/verify",
    verifyCheckoutPayment
);

export default router;