
import mongoose from "mongoose";
import { randomBytes } from "crypto";

import Cart from "../models/Cart.js";
import Event from "../models/Event.js";
import Booking from "../models/Booking.js";
import Checkout from "../models/Checkout.js";

const createDomainError = (code, message, statusCode = 400) => {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
};

const getCartLineKey = (eventId, ticketTypeId) =>
    `${eventId.toString()}:${ticketTypeId.toString()}`;

// Reserve one cart line using an atomic inventory update.
// This function must run inside the caller's MongoDB transaction.
const reserveTicket = async (item, session) => {
    const eventId = new mongoose.Types.ObjectId(item.event);
    const ticketTypeId = new mongoose.Types.ObjectId(item.ticketTypeId);
    const quantity = item.quantity;

    const updatedEvent = await Event.findOneAndUpdate(
        {
            _id: eventId,
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
                                            $ifNull: ["$ticketTypes", []]
                                        },
                                        as: "ticket",
                                        cond: {
                                            $eq: [
                                                "$$ticket._id",
                                                ticketTypeId
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
                                            ticketTypeId
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
        throw createDomainError(
            "TICKET_UNAVAILABLE",
            "One or more selected tickets are unavailable. Please review your cart.",
            409
        );
    }

    const selectedTicket = updatedEvent.ticketTypes.find(
        (ticket) => ticket._id.toString() === ticketTypeId.toString()
    );

    if (!selectedTicket) {
        throw createDomainError(
            "TICKET_UNAVAILABLE",
            "A selected ticket category no longer exists.",
            409
        );
    }

    return {
        event: updatedEvent,
        ticket: selectedTicket,
        quantity,
        totalAmount: selectedTicket.price * quantity
    };
};

// CREATE CHECKOUT AND RESERVE ALL CART ITEMS
export const createCheckout = async (req, res) => {
    const session = await mongoose.startSession();

    let createdCheckout = null;
    let reusedCheckout = false;

    try {
        await session.withTransaction(async () => {
            const cart = await Cart.findOne({
                user: req.user._id
            }).session(session);

            if (!cart || cart.items.length === 0) {
                throw createDomainError(
                    "CART_EMPTY",
                    "Your cart is empty.",
                    400
                );
            }

            const now = new Date();

            // Aggregate cart quantities by event + ticket category.
            const cartLines = new Map();

            for (const item of cart.items) {
                const key = getCartLineKey(
                    item.event,
                    item.ticketTypeId
                );

                const existing = cartLines.get(key);

                if (existing) {
                    existing.quantity += item.quantity;
                } else {
                    cartLines.set(key, {
                        event: item.event,
                        ticketTypeId: item.ticketTypeId,
                        quantity: item.quantity
                    });
                }
            }

            const cartQuantities = new Map(
                [...cartLines].map(([key, item]) => [
                    key,
                    item.quantity
                ])
            );

            // Find all active parent checkouts.
            const activeCheckouts = await Checkout.find({
                user: req.user._id,
                status: "PENDING_PAYMENT",
                expiresAt: { $gt: now }
            })
                .sort({ createdAt: 1 })
                .session(session)
                .lean();

            const activeIds = activeCheckouts.map(
                (checkout) => checkout._id
            );

            // Fetch all child bookings so we can detect stale
            // or partially cancelled checkout groups.
            const allActiveBookings = activeIds.length
                ? await Booking.find({
                    user: req.user._id,
                    checkout: { $in: activeIds }
                })
                    .session(session)
                    .lean()
                : [];

            // Only genuinely pending bookings reserve inventory.
            const reservedBookings = allActiveBookings.filter(
                (booking) =>
                    booking.status === "PENDING_PAYMENT" &&
                    new Date(booking.expiresAt) > now
            );

            // Identify complete checkout groups that can safely
            // be resumed when they exactly match the cart.
            const exactMatches = [];

            for (const checkout of activeCheckouts) {
                const groupBookings = allActiveBookings.filter(
                    (booking) =>
                        booking.checkout.toString() ===
                        checkout._id.toString()
                );

                const groupIds = new Set(
                    groupBookings.map((booking) =>
                        booking._id.toString()
                    )
                );

                const completeGroup =
                    groupBookings.length === checkout.bookings.length &&
                    checkout.bookings.every((id) =>
                        groupIds.has(id.toString())
                    ) &&
                    groupBookings.every(
                        (booking) =>
                            booking.status === "PENDING_PAYMENT" &&
                            new Date(booking.expiresAt) > now
                    );

                if (!completeGroup) continue;

                const groupQuantities = new Map();

                for (const booking of groupBookings) {
                    const key = getCartLineKey(
                        booking.event,
                        booking.ticketTypeId
                    );

                    groupQuantities.set(
                        key,
                        (groupQuantities.get(key) || 0) +
                            booking.quantity
                    );
                }

                const exactMatch =
                    cartQuantities.size === groupQuantities.size &&
                    [...cartQuantities].every(
                        ([key, quantity]) =>
                            groupQuantities.get(key) === quantity
                    );

                if (exactMatch) {
                    exactMatches.push(checkout);
                }
            }

            // Count quantities already reserved by other pending
            // checkouts. This prevents reserving the same tickets twice.
            const reservedQuantities = new Map();

            for (const booking of reservedBookings) {
                const key = getCartLineKey(
                    booking.event,
                    booking.ticketTypeId
                );

                reservedQuantities.set(
                    key,
                    (reservedQuantities.get(key) || 0) +
                        booking.quantity
                );
            }

            const itemsToReserve = [];

            for (const [key, item] of cartLines) {
                const alreadyReserved =
                    reservedQuantities.get(key) || 0;

                const remainingQuantity = Math.max(
                    0,
                    item.quantity - alreadyReserved
                );

                if (remainingQuantity > 0) {
                    itemsToReserve.push({
                        ...item,
                        quantity: remainingQuantity
                    });
                }
            }

            // If the complete cart is already reserved by one
            // existing checkout, resume that exact checkout.
            if (itemsToReserve.length === 0) {
                if (exactMatches.length === 1) {
                    createdCheckout = exactMatches[0];
                    reusedCheckout = true;
                    return;
                }

                if (exactMatches.length > 1) {
                    throw createDomainError(
                        "MULTIPLE_MATCHING_CHECKOUTS",
                        "Multiple pending checkouts match your cart. Open My Bookings and resolve them individually.",
                        409
                    );
                }

                throw createDomainError(
                    "CART_ALREADY_RESERVED",
                    "Your cart tickets are already reserved across other pending checkouts. Resume or cancel those checkouts from My Bookings first.",
                    409
                );
            }

            // Create a new checkout only for the quantities
            // that are not already reserved elsewhere.
            const checkoutId = new mongoose.Types.ObjectId();

            const expiresAt = new Date(
                Date.now() + 10 * 60 * 1000
            );

            const bookingIds = [];
            const currencySet = new Set();

            let totalAmount = 0;

            for (const item of itemsToReserve) {
                const reserved = await reserveTicket(item, session);

                const currency = (
                    reserved.event.currency || "INR"
                ).toUpperCase();

                currencySet.add(currency);

                const bookingReference =
                    `ES-${randomBytes(5).toString("hex").toUpperCase()}`;

                const [booking] = await Booking.create(
                    [
                        {
                            bookingReference,
                            user: req.user._id,
                            checkout: checkoutId,
                            event: reserved.event._id,
                            ticketTypeId: reserved.ticket._id,
                            eventTitle: reserved.event.title,
                            eventDate: reserved.event.date,
                            venue: reserved.event.venue,
                            city: reserved.event.city,
                            imageUrl: reserved.event.imageUrl,
                            ticketTypeName: reserved.ticket.name,
                            quantity: reserved.quantity,
                            unitPrice: reserved.ticket.price,
                            totalAmount: reserved.totalAmount,
                            currency,
                            status: "PENDING_PAYMENT",
                            paymentStatus: "NOT_STARTED",
                            expiresAt
                        }
                    ],
                    { session }
                );

                bookingIds.push(booking._id);
                totalAmount += reserved.totalAmount;
            }

            if (currencySet.size !== 1) {
                throw createDomainError(
                    "MIXED_CURRENCIES",
                    "Your selected tickets have different currencies. Please purchase them separately.",
                    400
                );
            }

            const currency = [...currencySet][0];

            totalAmount = Math.round(
                (totalAmount + Number.EPSILON) * 100
            ) / 100;

            const amountPaise = Math.round(totalAmount * 100);

            if (
                !Number.isSafeInteger(amountPaise) ||
                amountPaise < 100
            ) {
                throw createDomainError(
                    "INVALID_AMOUNT",
                    "The combined checkout amount must be at least ₹1.",
                    400
                );
            }

            const checkoutReference =
                `ESC-${randomBytes(5).toString("hex").toUpperCase()}`;

            const [checkout] = await Checkout.create(
                [
                    {
                        _id: checkoutId,
                        checkoutReference,
                        user: req.user._id,
                        bookings: bookingIds,
                        totalAmount,
                        currency,
                        status: "PENDING_PAYMENT",
                        paymentStatus: "NOT_STARTED",
                        expiresAt
                    }
                ],
                { session }
            );

            // Keep the cart unchanged until payment confirmation.
            createdCheckout = checkout;
        });

        return res.status(reusedCheckout ? 200 : 201).json({
            success: true,
            reused: reusedCheckout,
            message: reusedCheckout
                ? "Your existing checkout matches your cart. Resuming payment."
                : "Unreserved tickets have been reserved for 10 minutes.",
            checkout: {
                _id: createdCheckout._id,
                checkoutReference: createdCheckout.checkoutReference,
                totalAmount: createdCheckout.totalAmount,
                currency: createdCheckout.currency,
                status: createdCheckout.status,
                expiresAt: createdCheckout.expiresAt,
                bookingCount: createdCheckout.bookings.length
            }
        });

    } catch (error) {
        console.error("Create checkout error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || "CHECKOUT_FAILED",
            message: error.statusCode
                ? error.message
                : "Unable to create checkout. Please refresh and try again."
        });

    } finally {
        await session.endSession();
    }
};

// GET ONE CHECKOUT BELONGING TO THE LOGGED-IN USER
export const getCheckoutById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid checkout ID."
            });
        }

        const checkout = await Checkout.findOne({
            _id: req.params.id,
            user: req.user._id
        })
            .populate(
                "bookings",
                "bookingReference eventTitle eventDate venue city ticketTypeName quantity unitPrice totalAmount currency status"
            )
            .lean();

        if (!checkout) {
            return res.status(404).json({
                success: false,
                message: "Checkout not found."
            });
        }

        return res.status(200).json({
            success: true,
            checkout
        });

    } catch (error) {
        console.error("Get checkout error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve checkout."
        });
    }
};

// GET CHECKOUT HISTORY FOR THE LOGGED-IN USER
export const getMyCheckouts = async (req, res) => {
    try {
        const checkouts = await Checkout.find({
            user: req.user._id
        })
            .populate(
                "bookings",
                "bookingReference eventTitle eventDate ticketTypeName quantity totalAmount currency status"
            )
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        return res.status(200).json({
            success: true,
            total: checkouts.length,
            checkouts
        });

    } catch (error) {
        console.error("Get my checkouts error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve your checkouts."
        });
    }
};
