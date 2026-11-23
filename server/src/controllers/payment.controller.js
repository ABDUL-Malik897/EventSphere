
import mongoose from "mongoose";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import {
    processCheckoutPaidWebhook
} from "./checkoutPayment.controller.js";
import Booking from "../models/Booking.js";
import { getRazorpay } from "../config/razorpay.js";
import ProcessedWebhook from "../models/ProcessedWebhook.js";

const orderSchema = z.object({
    bookingId: z.string().regex(/^[a-f\d]{24}$/i)
}).strict();

const verifySchema = z.object({
    bookingId: z.string().regex(/^[a-f\d]{24}$/i),
    razorpay_payment_id: z.string().min(1),
    razorpay_order_id: z.string().min(1),
    razorpay_signature: z.string().min(1)
}).strict();

const toPaise = (amount) => Math.round(amount * 100);

// CREATE RAZORPAY ORDER
export const createPaymentOrder = async (req, res) => {
    try {
        const validation = orderSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }

        const booking = await Booking.findOne({
            _id: validation.data.bookingId,
            user: req.user._id
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        if (booking.status !== "PENDING_PAYMENT") {
            return res.status(409).json({
                success: false,
                message: "This booking is no longer awaiting payment."
            });
        }

        const remainingTime =
            new Date(booking.expiresAt).getTime() - Date.now();

        if (remainingTime <= 0) {
            return res.status(409).json({
                success: false,
                message: "Your reservation has expired. Please book again."
            });
        }

        const razorpay = getRazorpay();

        const amount = toPaise(booking.totalAmount);

        if (!Number.isSafeInteger(amount) || amount < 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment amount."
            });
        }

        let order;

        // Reuse an order already created for this booking.
        if (booking.razorpayOrderId) {
            order = await razorpay.orders.fetch(
                booking.razorpayOrderId
            );

            if (
                order.amount !== amount ||
                order.currency !== booking.currency
            ) {
                return res.status(409).json({
                    success: false,
                    message: "Payment order does not match this booking."
                });
            }

            if (order.status === "paid") {
                return res.status(409).json({
                    success: false,
                    message: "This payment order has already been paid. Refresh your bookings."
                });
            }

        } else {
            order = await razorpay.orders.create({
                amount,
                currency: booking.currency,
                receipt: booking.bookingReference,
                notes: {
                    bookingId: booking._id.toString(),
                    bookingReference: booking.bookingReference
                }
            });

            booking.razorpayOrderId = order.id;
            booking.paymentStatus = "ORDER_CREATED";

            await booking.save();
        }

        res.status(201).json({
            success: true,
            keyId: process.env.RAZORPAY_KEY_ID,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            bookingId: booking._id,
            checkoutTimeoutSeconds: Math.max(
                1,
                Math.floor(remainingTime / 1000)
            ),
            prefill: {
                name: req.user.name,
                email: req.user.email
            }
        });

    } catch (error) {
        console.error("Create payment order error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to initialize payment."
        });
    }
};

// VERIFY PAYMENT
export const verifyPayment = async (req, res) => {
    try {
        const validation = verifySchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment verification details."
            });
        }

        const {
            bookingId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = validation.data;

        const booking = await Booking.findOne({
            _id: bookingId,
            user: req.user._id
        });

        if (!booking || !booking.razorpayOrderId) {
            return res.status(404).json({
                success: false,
                message: "Payment booking not found."
            });
        }

        // Never trust an order ID just because the browser supplied it.
        const savedOrderId = booking.razorpayOrderId;

        if (savedOrderId !== razorpay_order_id) {
            return res.status(400).json({
                success: false,
                message: "Payment order mismatch."
            });
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            throw new Error("Razorpay Key Secret is missing.");
        }

        // Verify using the order ID stored in MongoDB.
        const expectedSignature = createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
        )
            .update(`${savedOrderId}|${razorpay_payment_id}`)
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

        // Fetch the actual provider-side payment.
        let payment = await razorpay.payments.fetch(
            razorpay_payment_id
        );

        const expectedAmount = toPaise(booking.totalAmount);

        if (
            payment.order_id !== savedOrderId ||
            payment.amount !== expectedAmount ||
            payment.currency !== booking.currency
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment amount, currency or order does not match."
            });
        }

        // Capture an authorized payment before confirming the booking.
        if (payment.status === "authorized") {
            payment = await razorpay.payments.capture(
                payment.id,
                expectedAmount,
                booking.currency
            );
        }

        // Do not issue tickets for authorized or failed payments.
        if (payment.status !== "captured" || !payment.captured) {
            return res.status(409).json({
                success: false,
                message: "Payment has not been captured yet. Your booking is not confirmed.",
                paymentStatus: payment.status
            });
        }

        // Idempotency: a repeated valid callback must not create
        // another confirmation.
        if (booking.status === "CONFIRMED") {
            if (booking.razorpayPaymentId === payment.id) {
                return res.status(200).json({
                    success: true,
                    message: "Payment was already verified.",
                    booking
                });
            }

            return res.status(409).json({
                success: false,
                message: "This booking has already been confirmed with another payment."
            });
        }

        if (booking.status !== "PENDING_PAYMENT") {
            return res.status(409).json({
                success: false,
                message: "Reservation is no longer active. Contact support if payment was captured."
            });
        }

        if (new Date(booking.expiresAt) <= new Date()) {
            return res.status(409).json({
                success: false,
                message: "Reservation expired. Contact support if payment was captured."
            });
        }

        const confirmedBooking = await Booking.findOneAndUpdate(
            {
                _id: booking._id,
                user: req.user._id,
                status: "PENDING_PAYMENT",
                expiresAt: { $gt: new Date() },
                razorpayOrderId: savedOrderId
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
                new: true
            }
        );

        if (!confirmedBooking) {
            return res.status(409).json({
                success: false,
                message: "Booking status changed while payment was being verified. Contact support if payment was captured."
            });
        }

        res.status(200).json({
            success: true,
            message: "Payment verified! Your booking is confirmed.",
            booking: confirmedBooking
        });

    } catch (error) {
        console.error("Payment verification error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to verify payment. Please check your booking status before retrying."
        });
    }
};

// RAZORPAY WEBHOOK
export const razorpayWebhook = async (req, res) => {
    let eventId;

    try {
        if (!Buffer.isBuffer(req.body)) {
            return res.status(415).json({
                success: false,
                message: "Raw webhook body required."
            });
        }

        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error("Razorpay webhook secret is missing.");

            return res.status(503).json({
                success: false,
                message: "Webhook is not configured."
            });
        }

        const signature = req.get("X-Razorpay-Signature");

        if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook signature."
            });
        }

        const expected = createHmac(
            "sha256",
            webhookSecret
        )
            .update(req.body)
            .digest();

        const received = Buffer.from(signature, "hex");

        if (
            expected.length !== received.length ||
            !timingSafeEqual(expected, received)
        ) {
            return res.status(400).json({
                success: false,
                message: "Webhook signature verification failed."
            });
        }

        const payload = JSON.parse(req.body.toString("utf8"));

        eventId = req.get("x-razorpay-event-id");

        if (!eventId || !payload.event) {
            return res.status(400).json({
                success: false,
                message: "Webhook event information is missing."
            });
        }

        // Ignore duplicate deliveries.
        try {
            await ProcessedWebhook.create({
                eventId,
                eventType: payload.event
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(200).json({
                    success: true,
                    message: "Webhook already processed."
                });
            }

            throw error;
        }

        // We only fulfil bookings on an order.paid event.
        if (payload.event !== "order.paid") {
            return res.status(200).json({
                success: true,
                message: "Webhook acknowledged."
            });
        }

        const order = payload.payload?.order?.entity;
        const payment = payload.payload?.payment?.entity;

        if (!order?.id || !payment?.id) {
            throw new Error("Payment or order information missing from webhook.");
        }

        // First check combined cart checkout orders.
        // Their Razorpay order ID is stored on Checkout, not Booking.
        const checkoutHandled = await processCheckoutPaidWebhook({
            order,
            payment
        });

        if (checkoutHandled) {
            return res.status(200).json({
                success: true,
                message: "Combined checkout webhook processed."
            });
        }

        // If it was not a combined checkout, check the legacy
        // individual-booking payment flow.
        const booking = await Booking.findOne({
            razorpayOrderId: order.id
        });

        if (!booking) {
            console.warn("Webhook order has no matching booking:", order.id);

            return res.status(200).json({
                success: true,
                message: "No matching booking."
            });
        }

        const expectedAmount = toPaise(booking.totalAmount);

        if (
            payment.order_id !== booking.razorpayOrderId ||
            payment.amount !== expectedAmount ||
            payment.currency !== booking.currency ||
            payment.status !== "captured" ||
            payment.captured !== true
        ) {
            throw new Error("Webhook payment details do not match the booking.");
        }

        if (
            booking.status === "CONFIRMED" &&
            booking.razorpayPaymentId === payment.id
        ) {
            return res.status(200).json({
                success: true,
                message: "Booking was already confirmed."
            });
        }

        if (
            booking.status === "PENDING_PAYMENT" &&
            new Date(booking.expiresAt) > new Date()
        ) {
            await Booking.findOneAndUpdate(
                {
                    _id: booking._id,
                    status: "PENDING_PAYMENT",
                    expiresAt: { $gt: new Date() },
                    razorpayOrderId: order.id
                },
                {
                    $set: {
                        status: "CONFIRMED",
                        paymentStatus: "CAPTURED",
                        razorpayPaymentId: payment.id,
                        paidAt: new Date()
                    }
                }
            );
        } else {
            // Do not restore tickets automatically after their
            // reservation has expired or been cancelled.
            console.error(
                "Captured payment needs reconciliation:",
                booking.bookingReference,
                payment.id
            );
        }

        return res.status(200).json({
            success: true,
            message: "Webhook processed."
        });

    } catch (error) {
        console.error("Razorpay webhook error:", error);

        // Remove the event record so Razorpay can retry.
        if (eventId) {
            await ProcessedWebhook.deleteOne({ eventId }).catch(
                () => {}
            );
        }

        return res.status(500).json({
            success: false,
            message: "Webhook processing failed."
        });
    }
};