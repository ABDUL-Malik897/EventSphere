
import { createHmac, createHash, randomBytes } from "crypto";

import AdmissionPass from "../models/AdmissionPass.js";

const getAdmissionSecret = () => {
    const secret = process.env.ADMISSION_TOKEN_SECRET;

    if (!secret || secret.length < 32) {
        throw new Error(
            "ADMISSION_TOKEN_SECRET is missing or too short."
        );
    }

    return secret;
};

// A stable, unguessable token can be derived without storing
// the readable token in MongoDB.
export const deriveAdmissionToken = (bookingId, nonce) => {
    return createHmac("sha256", getAdmissionSecret())
        .update(`${bookingId.toString()}:${nonce}`)
        .digest("base64url");
};

export const hashAdmissionToken = (token) => {
    return createHash("sha256")
        .update(token)
        .digest("hex");
};

// Create exactly one admission pass for each booking group.
// Pass the MongoDB session when this is called during payment confirmation.
export const createAdmissionPassForBooking = async (
    booking,
    session = null
) => {
    let query = AdmissionPass.findOne({
        booking: booking._id
    });

    if (session) query = query.session(session);

    const existingPass = await query;

    if (existingPass) {
        return existingPass;
    }

    const tokenNonce = randomBytes(24).toString("hex");

    const token = deriveAdmissionToken(
        booking._id,
        tokenNonce
    );

    const tokenHash = hashAdmissionToken(token);

    // Keep the pass valid until 24 hours after the event date.
    const expiresAt = new Date(
        new Date(booking.eventDate).getTime() +
        24 * 60 * 60 * 1000
    );

    const passData = {
        booking: booking._id,
        tokenNonce,
        tokenHash,
        status: "ACTIVE",
        expiresAt
    };

    const options = session ? { session } : {};

    const [pass] = await AdmissionPass.create(
        [passData],
        options
    );

    return pass;
};

export const getTokenForAdmissionPass = (pass) => {
    return deriveAdmissionToken(
        pass.booking,
        pass.tokenNonce
    );
};
