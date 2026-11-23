
import mongoose from "mongoose";

const ticketTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },

    description: {
        type: String,
        default: "",
        maxlength: 250
    },

    price: {
        type: Number,
        required: true,
        min: 0
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    sold: {
        type: Number,
        default: 0,
        min: 0
    }
});

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },

        slug: {
            type: String,
            required: true,
            unique: true
        },

        description: {
            type: String,
            required: true
        },

        category: {
            type: String,
            required: true,
            enum: [
                "Music",
                "Technology",
                "Food & Drink",
                "Arts",
                "Sports",
                "Business",
                "Education",
                "Other"
            ]
        },

        date: {
            type: Date,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        venue: {
            type: String,
            required: true
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        capacity: {
            type: Number,
            default: 0,
            min: 0
        },

        ticketTypes: {
            type: [ticketTypeSchema],
            default: []
        },

        currency: {
            type: String,
            default: "INR"
        },

        imageUrl: {
            type: String,
            required: true
        },

        tag: {
            type: String,
            default: "New"
        },

        organizer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        status: {
            type: String,
            enum: [
                "draft",
                "pending_review",
                "published",
                "rejected",
                "cancelled"
            ],
            default: "draft"
        },

        rejectionReason: {
            type: String,
            default: ""
        },

        publishedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

eventSchema.index({ status: 1, date: 1 });
eventSchema.index({ category: 1, city: 1 });
eventSchema.index({ organizer: 1, createdAt: -1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
