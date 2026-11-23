
import mongoose from "mongoose";

const admissionPassSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            unique: true
        },

        tokenNonce: {
            type: String,
            required: true
        },

        tokenHash: {
            type: String,
            required: true,
            unique: true
        },

        status: {
            type: String,
            enum: ["ACTIVE", "USED", "REVOKED"],
            default: "ACTIVE"
        },

        expiresAt: {
            type: Date,
            required: true
        },

        checkedInAt: {
            type: Date,
            default: null
        },

        checkedInBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        emailStatus: {
            type: String,
            enum: [
                "PENDING",
                "SENDING",
                "SENT",
                "FAILED",
                "NOT_CONFIGURED"
            ],
            default: "PENDING"
        },

        emailAttemptedAt: {
            type: Date,
            default: null
        },

        emailAttempts: {
            type: Number,
            default: 0
        },

        emailError: {
            type: String,
            default: ""
        },

        emailSentAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

admissionPassSchema.index({ status: 1, expiresAt: 1 });

const AdmissionPass = mongoose.model(
    "AdmissionPass",
    admissionPassSchema
);

export default AdmissionPass;
