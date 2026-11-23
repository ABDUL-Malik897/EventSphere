
import mongoose from "mongoose";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import {
    createAdmissionPassForBooking
} from "../services/admissionPass.service.js";
import Checkout from "../models/Checkout.js";
import Booking from "../models/Booking.js";
import { getRazorpay } from "../config/razorpay.js";
import {
    sendAdmissionEmailsForCheckout
} from "../services/admissionEmail.service.js";
import Cart from "../models/Cart.js";

const createOrderSchema = z.object({
    checkoutId: z.string().regex(/^[a-f\d]{24}$/i)
}).strict();

const verifyPaymentSchema = z.object({
    checkoutId: z.string().regex(/^[a-f\d]{24}$/i),
    razorpay_payment_id: z.string().min(1),
    razorpay_order_id: z.string().min(1),
    razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i)
}).strict();

const toPaise = (amount) => Math.round(amount * 100);

const paymentError = (code, message, statusCode = 409) => {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
};

// CHECK WHETHER A CHECKOUT ALREADY HAS A PAYMENT ORDER.
const fetchExistingOrder = async (razorpay, checkout) => {
    if (!checkout.razorpayOrderId) return null;

    const order = await razorpay.orders.fetch(
        checkout.razorpayOrderId
    );

    const expectedAmount = toPaise(checkout.totalAmount);

    if (
        Number(order.amount) !== expectedAmount ||
        order.currency !== checkout.currency
    ) {
        throw paymentError(
            "ORDER_MISMATCH",
            "The existing Razorpay order does not match this checkout.",
            409
        );
    }

    if (order.status === "paid") {
        throw paymentError(
            "ORDER_ALREADY_PAID",
            "This order is already paid. Please refresh your checkout status.",
            409
        );
    }

    return order;
};

// CREATE OR REUSE ONE RAZORPAY ORDER FOR THE ENTIRE CHECKOUT.
export const createCheckoutPaymentOrder = async (req, res) => {
    try {
        const validation = createOrderSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid checkout ID."
            });
        }

        let checkout = await Checkout.findOne({
            _id: validation.data.checkoutId,
            user: req.user._id
        });

        if (!checkout) {
            return res.status(404).json({
                success: false,
                message: "Checkout not found."
            });
        }

        if (checkout.status !== "PENDING_PAYMENT") {
            return res.status(409).json({
                success: false,
                message: "This checkout is no longer awaiting payment."
            });
        }

        const remainingTime =
            new Date(checkout.expiresAt).getTime() - Date.now();

        if (remainingTime <= 0) {
            return res.status(409).json({
                success: false,
                message: "Your checkout reservation has expired. Please add your tickets again."
            });
        }

        const amount = toPaise(checkout.totalAmount);

        if (
            !Number.isSafeInteger(amount) ||
            amount < 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid checkout payment amount."
            });
        }

        const razorpay = getRazorpay();

        let order = await fetchExistingOrder(razorpay, checkout);

        if (!order) {
            // Create one order for all bookings in this checkout.
            order = await razorpay.orders.create({
                amount,
                currency: checkout.currency,
                receipt: checkout.checkoutReference,
                notes: {
                    checkoutId: checkout._id.toString(),
                    checkoutReference: checkout.checkoutReference,
                    bookingCount: checkout.bookings.length.toString()
                }
            });

            // Save the provider order against this user's active checkout.
            const savedCheckout = await Checkout.findOneAndUpdate(
                {
                    _id: checkout._id,
                    user: req.user._id,
                    status: "PENDING_PAYMENT",
                    expiresAt: { $gt: new Date() },
                    $or: [
                        { razorpayOrderId: { $exists: false } },
                        { razorpayOrderId: null }
                    ]
                },
                {
                    $set: {
                        razorpayOrderId: order.id,
                        paymentStatus: "ORDER_CREATED"
                    }
                },
                {
                    new: true
                }
            );

            if (!savedCheckout) {
                // A concurrent request may have created an order first.
                checkout = await Checkout.findOne({
                    _id: checkout._id,
                    user: req.user._id
                });

                if (!checkout?.razorpayOrderId) {
                    return res.status(409).json({
                        success: false,
                        message: "Checkout changed while payment was being initialized. Please refresh and try again."
                    });
                }

                order = await fetchExistingOrder(
                    razorpay,
                    checkout
                );
            } else {
                checkout = savedCheckout;
            }
        }

        return res.status(201).json({
            success: true,
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            checkoutId: checkout._id,
            checkoutReference: checkout.checkoutReference,
            checkoutTimeoutSeconds: Math.max(
                1,
                Math.floor(
                    (new Date(checkout.expiresAt).getTime() - Date.now()) / 1000
                )
            ),
            prefill: {
                name: req.user.name,
                email: req.user.email
            }
        });

    } catch (error) {
        console.error("Create checkout payment order error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || "PAYMENT_ORDER_FAILED",
            message: error.statusCode
                ? error.message
                : "Unable to initialize combined payment."
        });
    }
};

// CONFIRM THE CHECKOUT AND ALL ITS BOOKINGS ATOMICALLY.
// The same helper is used by the browser verification and webhook.
const confirmCheckoutAtomically = async ({
    checkoutId,
    userId = null,
    payment
}) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            const checkoutQuery = {
                _id: checkoutId
            };

            if (userId) {
                checkoutQuery.user = userId;
            }

            const checkout = await Checkout.findOne(
                checkoutQuery
            ).session(session);

            if (!checkout) {
                throw paymentError(
                    "CHECKOUT_NOT_FOUND",
                    "Checkout not found.",
                    404
                );
            }

            // Repeated verification of the same captured payment is safe.
            if (checkout.status === "CONFIRMED") {
                if (checkout.razorpayPaymentId === payment.id) {
                    return;
                }

                throw paymentError(
                    "CHECKOUT_ALREADY_CONFIRMED",
                    "This checkout was already confirmed with another payment."
                );
            }

            if (checkout.status !== "PENDING_PAYMENT") {
                throw paymentError(
                    "CHECKOUT_INACTIVE",
                    "This checkout is no longer active. Contact support if payment was captured."
                );
            }

            if (new Date(checkout.expiresAt) <= new Date()) {
                throw paymentError(
                    "CHECKOUT_EXPIRED",
                    "The reservation expired. Contact support if payment was captured."
                );
            }

            if (checkout.razorpayOrderId !== payment.order_id) {
                throw paymentError(
                    "ORDER_MISMATCH",
                    "Payment does not belong to this checkout.",
                    400
                );
            }

            const bookings = await Booking.find({
                _id: { $in: checkout.bookings },
                checkout: checkout._id,
                user: checkout.user
            }).session(session);
            
            

            if (bookings.length === 0 || bookings.length !== checkout.bookings.length) {
                throw paymentError("BOOKING_GROUP_INCOMPLETE", "The checkout's booking records are incomplete. Contact support.")
            }

            if (bookings.some((booking) => booking.status !== "PENDING_PAYMENT")) {
                throw paymentError(
                    "BOOKING_GROUP_INACTIVE",
                    "One or more reservations are no longer active. Contact support if payment was captured."
                );
            }

            // Create one admission pass for each event + ticket-category
            // booking group, inside the same confirmation transaction.
            for (const booking of bookings) {
                await createAdmissionPassForBooking(
                    booking,
                    session
                );
            }

            const currencies = new Set(bookings.map((booking) => booking.currency));
            const bookingTotal = bookings.reduce((total, booking) => total + booking.totalAmount,0);

            if (
                currencies.size !== 1 ||
                [...currencies][0] !== checkout.currency ||
                toPaise(bookingTotal) !== toPaise(checkout.totalAmount)
            ) {
                throw paymentError(
                    "BOOKING_TOTAL_MISMATCH",
                    "The stored booking totals do not match the checkout amount."
                );
            }

            // Claim the checkout before updating its bookings.
            // A concurrent expiry transaction cannot also claim it.
            const confirmedCheckout = await Checkout.findOneAndUpdate(
                {
                    _id: checkout._id,
                    user: checkout.user,
                    status: "PENDING_PAYMENT",
                    expiresAt: { $gt: new Date() },
                    razorpayOrderId: payment.order_id
                },
                {
                    $set: {
                        status: "CONFIRMED",
                        paymentStatus: "CAPTURED",
                        razorpayPaymentId: payment.id,
                        paidAt: new Date()
                    }
                },
                {
                    new: true,
                    session
                }
            );

            if (!confirmedCheckout) {
                throw paymentError(
                    "CHECKOUT_STATE_CHANGED",
                    "Checkout status changed during payment confirmation."
                );
            }

            const bookingUpdate = await Booking.updateMany(
                {
                    _id: { $in: checkout.bookings },
                    checkout: checkout._id,
                    user: checkout.user,
                    status: "PENDING_PAYMENT"
                },
                {
                    $set: {
                        status: "CONFIRMED",
                        paymentStatus: "CAPTURED",
                        paidAt: confirmedCheckout.paidAt
                    }
                },
                { session }
            );

            if (bookingUpdate.modifiedCount !== bookings.length) {
                throw paymentError(
                    "BOOKING_CONFIRMATION_INCOMPLETE",
                    "Not all bookings could be confirmed. The database transaction was rolled back."
                );
            }

            // Remove purchased quantities from the attendee's cart.
            // This executes only after captured payment has been verified,
            // and inside the same MongoDB transaction as booking confirmation.
            const cart = await Cart.findOne({
                user: checkout.user
            }).session(session);

            if (cart) {
                for (const booking of bookings) {
                    let remainingToRemove = booking.quantity;

                    // Iterate backwards so removing cart lines is safe.
                    for (
                        let index = cart.items.length - 1;
                        index >= 0 && remainingToRemove > 0;
                        index--
                    ) {
                        const cartItem = cart.items[index];

                        const sameEvent =
                            cartItem.event.toString() === booking.event.toString();

                        const sameTicketType =
                            cartItem.ticketTypeId.toString() ===
                            booking.ticketTypeId.toString();

                        if (!sameEvent || !sameTicketType) {
                            continue;
                        }

                        const deduction = Math.min(
                            cartItem.quantity,
                            remainingToRemove
                        );

                        cartItem.quantity -= deduction;
                        remainingToRemove -= deduction;

                        if (cartItem.quantity <= 0) {
                            cart.items.pull(cartItem._id);
                        }
                    }
                }

                await cart.save({ session });
            }
        });

        return await Checkout.findOne({
            _id: checkoutId,
            ...(userId ? { user: userId } : {})
        })
            .populate(
                "bookings",
                "bookingReference eventTitle eventDate venue city ticketTypeName quantity unitPrice totalAmount currency status"
            )
            .lean();

    } finally {
        await session.endSession();
    }
};

// VERIFY THE SIGNATURE AND THE ACTUAL RAZORPAY PAYMENT.
export const verifyCheckoutPayment = async (req, res) => {
    try {
        const validation = verifyPaymentSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid checkout payment verification details."
            });
        }

        const {
            checkoutId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = validation.data;

        const checkout = await Checkout.findOne({
            _id: checkoutId,
            user: req.user._id
        });

        if (!checkout || !checkout.razorpayOrderId) {
            return res.status(404).json({
                success: false,
                message: "Payment checkout not found."
            });
        }

        if (checkout.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: "Payment order mismatch."
            });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keySecret) {
            throw new Error("Razorpay Key Secret is missing.");
        }

        // Verify against the order ID saved by the backend.
        const expectedSignature = createHmac("sha256", keySecret)
            .update(`${checkout.razorpayOrderId}|${razorpay_payment_id}`)
            .digest("hex");

        const expectedBuffer = Buffer.from(expectedSignature, "hex");
        const suppliedBuffer = Buffer.from(razorpay_signature, "hex");

        const signatureValid =
            expectedBuffer.length === suppliedBuffer.length &&
            timingSafeEqual(expectedBuffer, suppliedBuffer);

        if (!signatureValid) {
            return res.status(400).json({
                success: false,
                message: "Payment signature verification failed."
            });
        }

        const razorpay = getRazorpay();

        let payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        const expectedAmount = toPaise(checkout.totalAmount);

        if (
            payment.order_id !== checkout.razorpayOrderId ||
            Number(payment.amount) !== expectedAmount ||
            payment.currency !== checkout.currency
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment amount, currency or order does not match this checkout."
            });
        }

        // Capture an authorized payment before confirming any tickets.
        if (payment.status === "authorized") {
            payment = await razorpay.payments.capture(
                payment.id,
                expectedAmount,
                checkout.currency
            );
        }

        if (
            payment.status !== "captured" ||
            payment.captured !== true
        ) {
            return res.status(409).json({
                success: false,
                message: "Payment has not been captured. Your bookings are not confirmed.",
                paymentStatus: payment.status
            });
        }

        let confirmedCheckout;

        try {
            confirmedCheckout = await confirmCheckoutAtomically({
                checkoutId: checkout._id,
                userId: req.user._id,
                payment
            });
        } catch (error) {
            if (
                error.code === "CHECKOUT_EXPIRED" ||
                error.code === "CHECKOUT_INACTIVE" ||
                error.code === "BOOKING_GROUP_INACTIVE"
            ) {
                console.error(
                    "Captured payment requires reconciliation:",
                    checkout.checkoutReference,
                    payment.id,
                    error.message
                );
            }

            throw error;
        }

                // Payment is already confirmed and the database transaction
        // has committed. Email failure must not affect payment success.
        try {
            const emailResults = await sendAdmissionEmailsForCheckout(
                confirmedCheckout._id
            );

            console.log(
                "Checkout admission email results:",
                emailResults
            );
        } catch (emailError) {
            console.error(
                "Checkout was confirmed, but email processing failed:",
                emailError
            );
        }

        return res.status(200).json({
            success: true,
            message: "Payment verified. All bookings in your checkout are confirmed.",
            checkout: confirmedCheckout
        });

    } catch (error) {
        console.error("Verify checkout payment error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || "PAYMENT_VERIFICATION_FAILED",
            message: error.statusCode
                ? error.message
                : "Unable to verify combined payment. Check your checkout status before retrying."
        });
    }
};

// PROCESS A VERIFIED RAZORPAY order.paid WEBHOOK FOR A CHECKOUT.
// Returns false when this order does not belong to a Checkout,
// allowing the existing individual-booking webhook to handle it.
export const processCheckoutPaidWebhook = async ({
    order,
    payment
}) => {
    if (!order?.id) return false;

    const checkout = await Checkout.findOne({
        razorpayOrderId: order.id
    });

    if (!checkout) return false;

    const expectedAmount = toPaise(checkout.totalAmount);

    if (
        Number(order.amount) !== expectedAmount ||
        order.currency !== checkout.currency ||
        payment?.order_id !== checkout.razorpayOrderId ||
        Number(payment.amount) !== expectedAmount ||
        payment.currency !== checkout.currency ||
        payment.status !== "captured" ||
        payment.captured !== true
    ) {
        throw new Error(
            `Webhook payment details do not match checkout ${checkout.checkoutReference}.`
        );
    }

    try {
        const confirmedCheckout = await confirmCheckoutAtomically({
            checkoutId: checkout._id,
            payment
        });

        // The transaction has committed. Process email separately.
        // Never make an email failure cause a payment webhook failure.
        try {
            const emailResults = await sendAdmissionEmailsForCheckout(
                confirmedCheckout._id
            );

            console.log(
                "Webhook admission email results:",
                emailResults
            );
        } catch (emailError) {
            console.error(
                "Checkout webhook confirmed payment, but email processing failed:",
                emailError
            );
        }

        return true;

    } catch (error) {
        // A captured payment arriving after a checkout expires cannot
        // safely confirm tickets whose inventory has already been released.
        // Acknowledge it to Razorpay and flag it for reconciliation.
        if (
            error.code === "CHECKOUT_EXPIRED" ||
            error.code === "CHECKOUT_INACTIVE" ||
            error.code === "BOOKING_GROUP_INACTIVE"
        ) {
            console.error(
                "Webhook captured payment requires manual reconciliation/refund:",
                checkout.checkoutReference,
                payment.id,
                error.message
            );

            return true;
        }

        throw error;
    }
};
