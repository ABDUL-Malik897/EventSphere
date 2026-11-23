import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { z } from "zod";

import Event from "../models/Event.js";
import Booking from "../models/Booking.js";

import Checkout from "../models/Checkout.js";
import { getRazorpay } from "../config/razorpay.js";

const reservationSchema = z.object({
    eventId: z.string().regex(/^[a-f\d]{24}$/i),
    ticketTypeId: z.string().regex(/^[a-f\d]{24}$/i),
    quantity: z.coerce.number().int().min(1).max(10)
}).strict();

// CREATE A TICKET RESERVATION
export const createReservation = async (req, res) => {
    const validation = reservationSchema.safeParse(req.body);

    if (!validation.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking details.",
            errors: validation.error.issues
        });
    }

    const { eventId, ticketTypeId, quantity } = validation.data;

    const eventObjectId = new mongoose.Types.ObjectId(eventId);
    const ticketObjectId = new mongoose.Types.ObjectId(ticketTypeId);

    const session = await mongoose.startSession();

    let createdBooking = null;

    try {
        await session.withTransaction(async () => {

            /*
             * Atomically check availability and increase
             * the sold counter for the selected ticket.
             *
             * The availability condition and inventory
             * update happen as one database operation.
             */

            const updatedEvent = await Event.findOneAndUpdate(
                {
                    _id: eventObjectId,
                    status: "published",
                    date: { $gt: new Date() },

                    $expr: {
                        $let: {
                            vars: {
                                selectedTicket: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: {
                                                    $ifNull: [
                                                        "$ticketTypes",
                                                        []
                                                    ]
                                                },
                                                as: "ticket",
                                                cond: {
                                                    $eq: [
                                                        "$$ticket._id",
                                                        ticketObjectId
                                                    ]
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },

                            in: {
                                $and: [
                                    {
                                        $ne: [
                                            "$$selectedTicket",
                                            null
                                        ]
                                    },
                                    {
                                        $lte: [
                                            {
                                                $add: [
                                                    {
                                                        $ifNull: [
                                                            "$$selectedTicket.sold",
                                                            0
                                                        ]
                                                    },
                                                    quantity
                                                ]
                                            },
                                            "$$selectedTicket.quantity"
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                },

                [
                    {
                        $set: {
                            ticketTypes: {
                                $map: {
                                    input: "$ticketTypes",
                                    as: "ticket",

                                    in: {
                                        $cond: [
                                            {
                                                $eq: [
                                                    "$$ticket._id",
                                                    ticketObjectId
                                                ]
                                            },

                                            {
                                                $mergeObjects: [
                                                    "$$ticket",
                                                    {
                                                        sold: {
                                                            $add: [
                                                                {
                                                                    $ifNull: [
                                                                        "$$ticket.sold",
                                                                        0
                                                                    ]
                                                                },
                                                                quantity
                                                            ]
                                                        }
                                                    }
                                                ]
                                            },

                                            "$$ticket"
                                        ]
                                    }
                                }
                            }
                        }
                    }
                ],

                {
                    new: true,
                    session,
                    updatePipeline: true
                }
            );

            if (!updatedEvent) {
                const error = new Error(
                    "Tickets are unavailable, the event has ended, or the event is not published."
                );

                error.code = "TICKET_UNAVAILABLE";

                throw error;
            }

            const selectedTicket = updatedEvent.ticketTypes.find(
                (ticket) =>
                    ticket._id.toString() === ticketTypeId
            );

            if (!selectedTicket) {
                const error = new Error("Ticket category not found.");
                error.code = "TICKET_UNAVAILABLE";
                throw error;
            }

            const bookingReference =
                `ES-${randomBytes(5).toString("hex").toUpperCase()}`;

            const expiresAt = new Date(
                Date.now() + 10 * 60 * 1000
            );

            const totalAmount =
                selectedTicket.price * quantity;

            const [booking] = await Booking.create(
                [
                    {
                        bookingReference,

                        user: req.user._id,

                        event: updatedEvent._id,

                        ticketTypeId: selectedTicket._id,

                        eventTitle: updatedEvent.title,

                        eventDate: updatedEvent.date,

                        venue: updatedEvent.venue,

                        city: updatedEvent.city,

                        imageUrl: updatedEvent.imageUrl,

                        ticketTypeName: selectedTicket.name,

                        quantity,

                        unitPrice: selectedTicket.price,

                        totalAmount,

                        currency: updatedEvent.currency || "INR",

                        status: "PENDING_PAYMENT",

                        expiresAt
                    }
                ],
                { session }
            );

            createdBooking = booking;
        });

        res.status(201).json({
            success: true,
            message: "Tickets reserved successfully. Complete payment within 10 minutes.",
            booking: createdBooking
        });

    } catch (error) {
        console.error("Create reservation error:", error);

        if (error.code === "TICKET_UNAVAILABLE") {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: "Unable to reserve tickets."
        });

    } finally {
        await session.endSession();
    }
};

// GET USER BOOKINGS
export const getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({
            user: req.user._id
        })
            .populate("event", "title date venue city imageUrl")
            .populate("checkout", "_id status expiresAt")
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            total: bookings.length,
            bookings
        });

    } catch (error) {
        console.error("Get bookings error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve bookings."
        });
    }
};

// GET INDIVIDUAL BOOKING
export const getBookingById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }

        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id
        })
            .populate("event", "title date venue city imageUrl")
            .lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        res.status(200).json({
            success: true,
            booking
        });

    } catch (error) {
        console.error("Get booking error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve booking."
        });
    }
};

const cancellationError = (code, message, statusCode = 409) => {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
};

// Verify the Razorpay order before releasing its reserved inventory.
const ensureNoUnsettledPayment = async (orderId) => {
    if (!orderId) return;

    try {
        const razorpay = getRazorpay();

        const [order, paymentResponse] = await Promise.all([
            razorpay.orders.fetch(orderId),
            razorpay.orders.fetchPayments(orderId)
        ]);

        const payments = paymentResponse?.items;

        if (!Array.isArray(payments)) {
            throw new Error("Unexpected Razorpay payment response.");
        }

        const paymentInProgress = payments.some(
            (payment) =>
                payment.status !== "failed" ||
                payment.captured === true
        );

        if (
            order.status === "paid" ||
            Number(order.amount_paid || 0) > 0 ||
            paymentInProgress
        ) {
            throw cancellationError(
                "PAYMENT_IN_PROGRESS",
                "A payment is authorized or captured for this reservation. It cannot be cancelled until its payment status is resolved."
            );
        }
    } catch (error) {
        if (error.code === "PAYMENT_IN_PROGRESS") {
            throw error;
        }

        throw cancellationError(
            "PAYMENT_STATUS_UNAVAILABLE",
            "Unable to verify the Razorpay payment status. No reservation was cancelled. Please try again.",
            503
        );
    }
};

// CANCEL PENDING RESERVATION

export const cancelReservation = async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: "Invalid booking ID."
        });
    }

    // First inspect the booking and its parent checkout outside
    // the transaction, so we can verify the provider payment.
    try {
        const candidate = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id,
            status: "PENDING_PAYMENT"
        }).lean();

        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: "Pending booking not found or already processed."
            });
        }

        let parentCheckout = null;

        if (candidate.checkout) {
            parentCheckout = await Checkout.findOne({
                _id: candidate.checkout,
                user: req.user._id
            }).lean();

            if (
                !parentCheckout ||
                parentCheckout.status !== "PENDING_PAYMENT"
            ) {
                return res.status(409).json({
                    success: false,
                    message: "The combined checkout is no longer cancellable."
                });
            }

            if (
                parentCheckout.razorpayPaymentId ||
                ["AUTHORIZED", "CAPTURED"].includes(
                    parentCheckout.paymentStatus
                )
            ) {
                return res.status(409).json({
                    success: false,
                    message: "Payment is already authorized or captured. This reservation cannot be cancelled."
                });
            }
        }

        const orderId =
            parentCheckout?.razorpayOrderId ||
            candidate.razorpayOrderId;

        await ensureNoUnsettledPayment(orderId);

    } catch (error) {
        console.error("Cancellation payment safety check:", error);

        return res.status(error.statusCode || 503).json({
            success: false,
            code: error.code || "PAYMENT_STATUS_UNAVAILABLE",
            message: error.message ||
                "Unable to verify payment status. Please try again."
        });
    }

    const session = await mongoose.startSession();

    let cancelledBookingIds = [];
    let combinedCheckoutCancelled = false;

    try {
        await session.withTransaction(async () => {
            const booking = await Booking.findOne({
                _id: req.params.id,
                user: req.user._id,
                status: "PENDING_PAYMENT"
            }).session(session);

            if (!booking) {
                throw cancellationError(
                    "BOOKING_NOT_CANCELLABLE",
                    "Booking was already processed or cancelled."
                );
            }

            // COMBINED CHECKOUT CANCELLATION
            if (booking.checkout) {
                const checkout = await Checkout.findOne({
                    _id: booking.checkout,
                    user: req.user._id,
                    status: "PENDING_PAYMENT"
                }).session(session);

                if (!checkout) {
                    throw cancellationError(
                        "CHECKOUT_NOT_CANCELLABLE",
                        "The combined checkout is no longer active."
                    );
                }

                if (
                    checkout.razorpayPaymentId ||
                    ["AUTHORIZED", "CAPTURED"].includes(
                        checkout.paymentStatus
                    )
                ) {
                    throw cancellationError(
                        "PAYMENT_IN_PROGRESS",
                        "Payment is already authorized or captured."
                    );
                }

                const groupBookings = await Booking.find({
                    checkout: checkout._id,
                    user: req.user._id
                }).session(session);

                const actualIds = new Set(
                    groupBookings.map((item) => item._id.toString())
                );

                const completeGroup =
                    groupBookings.length === checkout.bookings.length &&
                    checkout.bookings.every((id) =>
                        actualIds.has(id.toString())
                    );

                if (!completeGroup) {
                    throw cancellationError(
                        "BOOKING_GROUP_INCOMPLETE",
                        "The checkout booking group is incomplete. Please contact support."
                    );
                }

                if (
                    groupBookings.some(
                        (item) =>
                            !["PENDING_PAYMENT", "CANCELLED"].includes(
                                item.status
                            )
                    )
                ) {
                    throw cancellationError(
                        "BOOKING_GROUP_INACTIVE",
                        "One or more bookings have already been processed."
                    );
                }

                // Atomically claim the parent checkout.
                // Payment confirmation cannot also claim it as pending.
                const cancelledCheckout =
                    await Checkout.findOneAndUpdate(
                        {
                            _id: checkout._id,
                            user: req.user._id,
                            status: "PENDING_PAYMENT",
                            $or: [
                                { razorpayPaymentId: { $exists: false } },
                                { razorpayPaymentId: null }
                            ]
                        },
                        {
                            $set: {
                                status: "CANCELLED"
                            }
                        },
                        {
                            new: true,
                            session
                        }
                    );

                if (!cancelledCheckout) {
                    throw cancellationError(
                        "CHECKOUT_STATE_CHANGED",
                        "Checkout status changed. Refresh and try again."
                    );
                }

                // Release inventory for every still-pending booking
                // in the group. Already-cancelled bookings are skipped.
                for (const groupBooking of groupBookings) {
                    if (groupBooking.status === "CANCELLED") {
                        continue;
                    }

                    const inventoryResult = await Event.updateOne(
                        {
                            _id: groupBooking.event,
                            ticketTypes: {
                                $elemMatch: {
                                    _id: groupBooking.ticketTypeId,
                                    sold: {
                                        $gte: groupBooking.quantity
                                    }
                                }
                            }
                        },
                        {
                            $inc: {
                                "ticketTypes.$.sold":
                                    -groupBooking.quantity
                            }
                        },
                        { session }
                    );

                    if (inventoryResult.modifiedCount !== 1) {
                        throw new Error(
                            `Unable to release inventory for ${groupBooking.bookingReference}`
                        );
                    }

                    groupBooking.status = "CANCELLED";

                    await groupBooking.save({ session });

                    cancelledBookingIds.push(
                        groupBooking._id.toString()
                    );
                }

                combinedCheckoutCancelled = true;

            } else {
                // LEGACY INDIVIDUAL BOOKING CANCELLATION
                const inventoryResult = await Event.updateOne(
                    {
                        _id: booking.event,
                        ticketTypes: {
                            $elemMatch: {
                                _id: booking.ticketTypeId,
                                sold: { $gte: booking.quantity }
                            }
                        }
                    },
                    {
                        $inc: {
                            "ticketTypes.$.sold": -booking.quantity
                        }
                    },
                    { session }
                );

                if (inventoryResult.modifiedCount !== 1) {
                    throw new Error(
                        "Unable to release reserved ticket inventory."
                    );
                }

                booking.status = "CANCELLED";

                await booking.save({ session });

                cancelledBookingIds.push(
                    booking._id.toString()
                );
            }
        });

        return res.status(200).json({
            success: true,
            message: combinedCheckoutCancelled
                ? "Combined checkout cancelled. All remaining reservations were cancelled and their inventory was released."
                : "Reservation cancelled and tickets released.",
            combinedCheckoutCancelled,
            cancelledBookingIds
        });

    } catch (error) {
        console.error("Cancel reservation error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || "CANCELLATION_FAILED",
            message: error.message ||
                "Unable to cancel reservation."
        });

    } finally {
        await session.endSession();
    }
};
