
import mongoose from "mongoose";

import Booking from "../models/Booking.js";
import Checkout from "../models/Checkout.js";
import Event from "../models/Event.js";

let expiryTimer = null;
let isRunning = false;

// Release the inventory for one booking.
// This must run inside a MongoDB transaction.
const releaseBookingInventory = async (booking, session) => {
    const result = await Event.updateOne(
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

    if (result.modifiedCount !== 1) {
        throw new Error(
            `Unable to release inventory for booking ${booking.bookingReference}`
        );
    }
};

// EXPIRE OLD INDIVIDUAL BOOKINGS
const expireLegacyBookings = async () => {
    const expiredBookings = await Booking.find({
        checkout: null,
        status: "PENDING_PAYMENT",
        expiresAt: { $lte: new Date() }
    })
        .select("_id")
        .limit(100)
        .lean();

    for (const candidate of expiredBookings) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                const booking = await Booking.findOneAndUpdate(
                    {
                        _id: candidate._id,
                        checkout: null,
                        status: "PENDING_PAYMENT",
                        expiresAt: { $lte: new Date() }
                    },
                    {
                        $set: {
                            status: "EXPIRED"
                        }
                    },
                    {
                        new: true,
                        session
                    }
                );

                if (!booking) return;

                await releaseBookingInventory(booking, session);

                console.log(
                    `Individual reservation expired: ${booking.bookingReference}`
                );
            });

        } catch (error) {
            console.error(
                `Individual booking expiry failed for ${candidate._id}:`,
                error.message
            );

        } finally {
            await session.endSession();
        }
    }
};

// EXPIRE A COMPLETE MULTI-ITEM CHECKOUT
const expirePendingCheckouts = async () => {
    const expiredCheckouts = await Checkout.find({
        status: "PENDING_PAYMENT",
        expiresAt: { $lte: new Date() }
    })
        .select("_id")
        .limit(50)
        .lean();

    for (const candidate of expiredCheckouts) {
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Claim the checkout so it cannot be expired twice.
                const checkout = await Checkout.findOneAndUpdate(
                    {
                        _id: candidate._id,
                        status: "PENDING_PAYMENT",
                        expiresAt: { $lte: new Date() }
                    },
                    {
                        $set: {
                            status: "EXPIRED"
                        }
                    },
                    {
                        new: true,
                        session
                    }
                );

                if (!checkout) return;

                const bookings = await Booking.find({
                    checkout: checkout._id
                }).session(session);

                // Never partially release an incomplete checkout.
                if (
                    bookings.length !== checkout.bookings.length ||
                    bookings.length === 0
                ) {
                    throw new Error(
                        `Checkout ${checkout.checkoutReference} has an incomplete booking group.`
                    );
                }

                for (const booking of bookings) {
                    // These statuses have already had their inventory released.
                    if (
                        booking.status === "CANCELLED" ||
                        booking.status === "EXPIRED"
                    ) {
                        continue;
                    }

                    if (booking.status !== "PENDING_PAYMENT") {
                        throw new Error(
                            `Unexpected booking status in checkout ${checkout.checkoutReference}.`
                        );
                    }

                    await releaseBookingInventory(booking, session);

                    booking.status = "EXPIRED";

                    await booking.save({ session });
                }

                console.log(
                    `Complete checkout expired: ${checkout.checkoutReference} (${bookings.length} bookings)`
                );
            });

        } catch (error) {
            console.error(
                `Checkout expiry failed for ${candidate._id}:`,
                error.message
            );

        } finally {
            await session.endSession();
        }
    }
};

// PUBLIC EXPIRY WORKER
export const expirePendingBookings = async () => {
    if (isRunning) return;

    isRunning = true;

    try {
        // Preserve the old single-booking expiry behavior.
        await expireLegacyBookings();

        // Also release all items from expired multi-item checkouts.
        await expirePendingCheckouts();

    } catch (error) {
        console.error(
            "Reservation expiry worker failed:",
            error.message
        );

    } finally {
        isRunning = false;
    }
};

export const startBookingExpiryJob = () => {
    if (expiryTimer) return;

    console.log("Reservation expiry worker started.");

    // Check immediately on startup.
    expirePendingBookings();

    // Check every 60 seconds.
    expiryTimer = setInterval(() => {
        expirePendingBookings();
    }, 60 * 1000);
};
