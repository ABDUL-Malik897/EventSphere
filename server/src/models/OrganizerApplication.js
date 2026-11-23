
import mongoose from "mongoose";

const organizerApplicationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },

        organizationName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        organizationType: {
            type: String,
            enum: [
                "Individual",
                "Company",
                "Non-profit",
                "Educational Institution",
                "Community"
            ],
            required: true
        },

        description: {
            type: String,
            required: true,
            minlength: 30,
            maxlength: 1500
        },

        website: {
            type: String,
            default: ""
        },

        contactPhone: {
            type: String,
            required: true,
            trim: true
        },

        experience: {
            type: String,
            default: "",
            maxlength: 1000
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },

        rejectionReason: {
            type: String,
            default: ""
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        reviewedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

organizerApplicationSchema.index({ status: 1, createdAt: -1 });

const OrganizerApplication = mongoose.model(
    "OrganizerApplication",
    organizerApplicationSchema
);

export default OrganizerApplication;
