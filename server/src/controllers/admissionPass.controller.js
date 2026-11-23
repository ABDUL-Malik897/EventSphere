
import mongoose from "mongoose";
import QRCode from "qrcode";

import AdmissionPass from "../models/AdmissionPass.js";
import Booking from "../models/Booking.js";
import Event from "../models/Event.js";

import {
    createAdmissionPassForBooking,
    getTokenForAdmissionPass,
    hashAdmissionToken
} from "../services/admissionPass.service.js";

const getPublicAppUrl = () => {
    const baseUrl =
        process.env.PUBLIC_APP_URL ||
        process.env.CLIENT_URL ||
        "http://localhost:5173";

    return baseUrl.replace(/\/+$/, "");
};

const validateToken = (token) => {
    return (
        typeof token === "string" &&
        /^[A-Za-z0-9_-]{40,60}$/.test(token)
    );
};

const getOrCreateAdmissionPass = async (booking) => {
    let pass = await AdmissionPass.findOne({
        booking: booking._id
    });

    if (!pass) {
        try {
            pass = await createAdmissionPassForBooking(booking);
        } catch (error) {
            if (error.code !== 11000) throw error;

            // Another request may have created the pass simultaneously.
            pass = await AdmissionPass.findOne({
                booking: booking._id
            });
        }
    }

    if (!pass) {
        throw new Error(
            `Unable to prepare admission pass for ${booking.bookingReference}`
        );
    }

    return pass;
};

// ATTENDEE: GET ALL CONFIRMED ADMISSION PASS SUMMARIES
export const getMyAdmissionPasses = async (req, res) => {
    try {
        const bookings = await Booking.find({
            user: req.user._id,
            status: "CONFIRMED"
        })
            .sort({ createdAt: -1 })
            .lean();

        const passes = [];

        for (const booking of bookings) {
            const pass = await getOrCreateAdmissionPass(booking);

            passes.push({
                _id: pass._id,
                status: pass.status,
                expiresAt: pass.expiresAt,
                checkedInAt: pass.checkedInAt,
                emailStatus: pass.emailStatus,

                booking: {
                    _id: booking._id,
                    bookingReference: booking.bookingReference,
                    eventTitle: booking.eventTitle,
                    eventDate: booking.eventDate,
                    venue: booking.venue,
                    city: booking.city,
                    ticketTypeName: booking.ticketTypeName,
                    quantity: booking.quantity,
                    totalAmount: booking.totalAmount,
                    currency: booking.currency
                }
            });
        }

        return res.status(200).json({
            success: true,
            total: passes.length,
            passes
        });

    } catch (error) {
        console.error("Get admission passes error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve admission passes."
        });
    }
};

// ATTENDEE: GET ONE SPECIFIC ADMISSION PASS WITH ITS QR CODE
export const getMyAdmissionPassById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.passId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admission pass ID."
            });
        }

        const pass = await AdmissionPass.findById(
            req.params.passId
        ).lean();

        if (!pass) {
            return res.status(404).json({
                success: false,
                message: "Admission pass not found."
            });
        }

        // Verify that this pass belongs to a confirmed booking
        // owned by the currently logged-in attendee.
        const booking = await Booking.findOne({
            _id: pass.booking,
            user: req.user._id,
            status: "CONFIRMED"
        }).lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: "Admission pass not found."
            });
        }

        const token = getTokenForAdmissionPass(pass);

        const checkInUrl =
            `${getPublicAppUrl()}/checkin/${token}`;

        const qrCodeDataUrl = await QRCode.toDataURL(
            checkInUrl,
            {
                errorCorrectionLevel: "H",
                margin: 2,
                width: 400
            }
        );

        return res.status(200).json({
            success: true,

            pass: {
                _id: pass._id,
                status: pass.status,
                expiresAt: pass.expiresAt,
                checkedInAt: pass.checkedInAt,
                emailStatus: pass.emailStatus,

                booking: {
                    _id: booking._id,
                    bookingReference: booking.bookingReference,
                    eventTitle: booking.eventTitle,
                    eventDate: booking.eventDate,
                    venue: booking.venue,
                    city: booking.city,
                    ticketTypeName: booking.ticketTypeName,
                    quantity: booking.quantity,
                    totalAmount: booking.totalAmount,
                    currency: booking.currency
                },

                qrCodeDataUrl
            }
        });

    } catch (error) {
        console.error("Get individual admission pass error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve this admission pass."
        });
    }
};


// ORGANIZER: VIEW SCANNED PASS DETAILS
export const getCheckInDetails = async (req, res) => {
    try {
        if (!validateToken(req.params.token)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admission QR code."
            });
        }

        const tokenHash = hashAdmissionToken(req.params.token);

        const pass = await AdmissionPass.findOne({
            tokenHash
        })
            .populate({
                path: "booking",
                populate: [
                    {
                        path: "event",
                        select: "title date time venue city organizer status"
                    },
                    {
                        path: "user",
                        select: "name email"
                    }
                ]
            })
            .lean();

        if (!pass || !pass.booking || !pass.booking.event) {
            return res.status(404).json({
                success: false,
                message: "Admission pass not found."
            });
        }

        const booking = pass.booking;
        const event = booking.event;

        // Only the organizer who owns this event may view the pass.
        if (
            !event.organizer ||
            event.organizer.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to check in guests for this event."
            });
        }

        return res.status(200).json({
            success: true,

            pass: {
                status:
                    pass.status === "ACTIVE" &&
                    new Date(pass.expiresAt) <= new Date()
                        ? "EXPIRED"
                        : pass.status,

                expiresAt: pass.expiresAt,
                checkedInAt: pass.checkedInAt,

                booking: {
                    id: booking._id,
                    reference: booking.bookingReference,
                    attendeeName: booking.user?.name || "Attendee",
                    attendeeEmail: booking.user?.email || "",
                    ticketTypeName: booking.ticketTypeName,
                    quantity: booking.quantity,
                    totalAmount: booking.totalAmount,
                    currency: booking.currency
                },

                event: {
                    title: event.title,
                    date: event.date,
                    time: event.time,
                    venue: event.venue,
                    city: event.city
                }
            }
        });

    } catch (error) {
        console.error("Get check-in details error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve admission details."
        });
    }
};

// ORGANIZER: ADMIT THE COMPLETE BOOKING GROUP ONCE
export const admitGuests = async (req, res) => {
    if (!validateToken(req.params.token)) {
        return res.status(400).json({
            success: false,
            message: "Invalid admission QR code."
        });
    }

    const session = await mongoose.startSession();

    let result = null;

    try {
        await session.withTransaction(async () => {
            const tokenHash = hashAdmissionToken(req.params.token);

            const pass = await AdmissionPass.findOne({
                tokenHash
            }).session(session);

            if (!pass) {
                throw Object.assign(
                    new Error("Admission pass not found."),
                    { statusCode: 404 }
                );
            }

            const booking = await Booking.findById(
                pass.booking
            ).session(session);

            if (!booking) {
                throw Object.assign(
                    new Error("Associated booking was not found."),
                    { statusCode: 404 }
                );
            }

            const event = await Event.findOne({
                _id: booking.event,
                organizer: req.user._id
            }).session(session);

            if (!event) {
                throw Object.assign(
                    new Error("You are not authorized to admit guests for this event."),
                    { statusCode: 403 }
                );
            }

            if (event.status === "cancelled") {
                throw Object.assign(
                    new Error("This event has been cancelled."),
                    { statusCode: 409 }
                );
            }

            if (booking.status !== "CONFIRMED") {
                throw Object.assign(
                    new Error("This booking is not confirmed."),
                    { statusCode: 409 }
                );
            }

            if (pass.status === "USED") {
                throw Object.assign(
                    new Error("This group has already been admitted."),
                    {
                        statusCode: 409,
                        code: "ALREADY_ADMITTED"
                    }
                );
            }

            if (
                pass.status !== "ACTIVE" ||
                new Date(pass.expiresAt) <= new Date()
            ) {
                throw Object.assign(
                    new Error("This admission pass has expired or been revoked."),
                    { statusCode: 409 }
                );
            }

            const checkedInAt = new Date();

            // Atomic update prevents two organizers from using
            // the same QR code simultaneously.
            const updatedPass = await AdmissionPass.findOneAndUpdate(
                {
                    _id: pass._id,
                    status: "ACTIVE",
                    expiresAt: { $gt: checkedInAt }
                },
                {
                    $set: {
                        status: "USED",
                        checkedInAt,
                        checkedInBy: req.user._id
                    }
                },
                {
                    new: true,
                    session
                }
            );

            if (!updatedPass) {
                throw Object.assign(
                    new Error("This group has already been admitted or the pass has expired."),
                    { statusCode: 409 }
                );
            }

            result = {
                bookingReference: booking.bookingReference,
                eventTitle: booking.eventTitle,
                ticketTypeName: booking.ticketTypeName,
                quantity: booking.quantity,
                checkedInAt
            };
        });

        return res.status(200).json({
            success: true,
            message: `${result.quantity} guest(s) admitted successfully.`,
            admission: result
        });

    } catch (error) {
        console.error("Admit guests error:", error);

        return res.status(error.statusCode || 500).json({
            success: false,
            code: error.code || "CHECK_IN_FAILED",
            message: error.statusCode
                ? error.message
                : "Unable to complete guest check-in."
        });

    } finally {
        await session.endSession();
    }
};
