
import Booking from "../models/Booking.js";
import Checkout from "../models/Checkout.js";
import AdmissionPass from "../models/AdmissionPass.js";
import { sendEmail } from "./emailjs.service.js";

const EMAIL_DELAY_MS = 1100;
const SENDING_STALE_MS = 5 * 60 * 1000;

const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

const isEmailJSConfigured = () =>
    Boolean(
        process.env.EMAILJS_SERVICE_ID &&
        process.env.EMAILJS_TEMPLATE_ID &&
        process.env.EMAILJS_PUBLIC_KEY &&
        process.env.EMAILJS_PRIVATE_KEY
    );

const getPassUrl = (passId) => {
    const baseUrl = (
        process.env.PUBLIC_APP_URL ||
        process.env.CLIENT_URL ||
        "http://localhost:5173"
    ).replace(/\/+$/, "");

    return `${baseUrl}/my-passes/${passId}`;
};

const formatEventDate = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Please check your EventSphere account";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata"
    }).format(date);
};

const formatEventTime = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Please check your EventSphere account";
    }

    const parts = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Kolkata"
    }).formatToParts(date);

    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;

    // A date stored at midnight may not have a meaningful event time.
    if (hour === "00" && minute === "00") {
        return "Please check your EventSphere account";
    }

    return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata"
    }).format(date);
};

const getErrorMessage = (error) =>
    String(
        error?.text ||
        error?.message ||
        "Email delivery failed"
    ).slice(0, 500);

/**
 * Sends one email for each confirmed booking in a checkout.
 * A booking represents one event + ticket category group.
 *
 * Email failure is recorded but never changes booking/payment status.
 */
export const sendAdmissionEmailsForCheckout = async (checkoutId) => {
    const checkout = await Checkout.findById(checkoutId)
        .select("bookings")
        .lean();

    if (!checkout) {
        throw new Error("Checkout not found while sending admission emails");
    }

    if (!checkout.bookings?.length) {
        return [];
    }

    const bookings = await Booking.find({
        _id: { $in: checkout.bookings },
        status: "CONFIRMED"
    })
        .populate({
            path: "user",
            select: "email name fullName firstName lastName"
        })
        .lean();

    if (!isEmailJSConfigured()) {
        await AdmissionPass.updateMany(
            {
                booking: { $in: checkout.bookings },
                emailStatus: "PENDING"
            },
            {
                $set: {
                    emailStatus: "NOT_CONFIGURED",
                    emailError: "EmailJS environment variables are not configured."
                }
            }
        );

        return bookings.map((booking) => ({
            bookingId: String(booking._id),
            status: "NOT_CONFIGURED"
        }));
    }

    const results = [];
    let emailRequestCount = 0;

    for (const booking of bookings) {
        const pass = await AdmissionPass.findOne({
            booking: booking._id
        }).select("_id status emailStatus");

        if (!pass) {
            results.push({
                bookingId: String(booking._id),
                status: "PASS_NOT_FOUND"
            });

            console.error(
                `Admission pass not found for booking ${booking.bookingReference}`
            );
            continue;
        }

        if (pass.status === "REVOKED") {
            results.push({
                bookingId: String(booking._id),
                status: "PASS_REVOKED"
            });
            continue;
        }

        if (pass.emailStatus === "SENT") {
            results.push({
                bookingId: String(booking._id),
                status: "ALREADY_SENT"
            });
            continue;
        }

        // Claim this pass so simultaneous payment verification/webhook
        // calls do not normally send the same email twice.
        const staleBefore = new Date(Date.now() - SENDING_STALE_MS);

        const claimedPass = await AdmissionPass.findOneAndUpdate(
            {
                _id: pass._id,
                $or: [
                    {
                        emailStatus: {
                            $in: ["PENDING", "FAILED", "NOT_CONFIGURED"]
                        }
                    },
                    {
                        emailStatus: "SENDING",
                        emailAttemptedAt: { $lt: staleBefore }
                    }
                ]
            },
            {
                $set: {
                    emailStatus: "SENDING",
                    emailAttemptedAt: new Date(),
                    emailError: ""
                },
                $inc: {
                    emailAttempts: 1
                }
            },
            { new: true }
        );

        if (!claimedPass) {
            results.push({
                bookingId: String(booking._id),
                status: "ALREADY_PROCESSING"
            });
            continue;
        }

        try {
            if (emailRequestCount > 0) {
                await wait(EMAIL_DELAY_MS);
            }

            if (!booking.user?.email) {
                throw new Error("Attendee email address is missing");
            }

            const attendeeName =
                booking.user.name ||
                booking.user.fullName ||
                [booking.user.firstName, booking.user.lastName]
                    .filter(Boolean)
                    .join(" ") ||
                "EventSphere attendee";

            emailRequestCount += 1;
            await sendEmail({
                to_email: booking.user.email,
                to_name: attendeeName,
                event_title: booking.eventTitle,
                event_date: formatEventDate(booking.eventDate),
                event_time: formatEventTime(booking.eventDate),
                venue: booking.venue,
                city: booking.city,
                ticket_type: booking.ticketTypeName,
                quantity: String(booking.quantity),
                booking_reference: booking.bookingReference,
                passes_url: getPassUrl(pass._id)
            });

            emailRequestCount += 1;

            await AdmissionPass.findByIdAndUpdate(claimedPass._id, {
                $set: {
                    emailStatus: "SENT",
                    emailSentAt: new Date(),
                    emailError: ""
                }
            });

            results.push({
                bookingId: String(booking._id),
                status: "SENT"
            });

            console.log(
                `Admission email sent for booking ${booking.bookingReference}`
            );
        } catch (error) {
            const message = getErrorMessage(error);

            await AdmissionPass.findByIdAndUpdate(claimedPass._id, {
                $set: {
                    emailStatus: "FAILED",
                    emailError: message
                }
            });

            results.push({
                bookingId: String(booking._id),
                status: "FAILED"
            });

            console.error(
                `Admission email failed for booking ${booking.bookingReference}:`,
                message
            );
        }
    }

    return results;
};
