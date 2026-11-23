import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
    {
        bookingReference: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        checkout: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Checkout",
            default: null
        },

        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true
        },

        ticketTypeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        // Snapshot fields preserve booking details.
        eventTitle: {
            type: String,
            required: true
        },

        eventDate: {
            type: Date,
            required: true
        },

        venue: {
            type: String,
            required: true
        },

        city: {
            type: String,
            required: true
        },

        imageUrl: {
            type: String,
            default: ""
        },

        ticketTypeName: {
            type: String,
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        },

        unitPrice: {
            type: Number,
            required: true,
            min: 0
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        currency: {
            type: String,
            default: "INR"
        },

        status: {
            type: String,
            enum: [
                "PENDING_PAYMENT",
                "CONFIRMED",
                "CANCELLED",
                "EXPIRED",
                "REFUNDED"
            ],
            default: "PENDING_PAYMENT"
        },

        razorpayOrderId: {
            type: String,
            default: undefined
        },

        razorpayPaymentId: {
            type: String,
            default: undefined
        },

        paymentStatus: {
            type: String,
            enum: [
                "NOT_STARTED",
                "ORDER_CREATED",
                "AUTHORIZED",
                "CAPTURED",
                "FAILED"
            ],
            default: "NOT_STARTED"
        },

        paidAt: {
            type: Date,
            default: null
        },

        expiresAt: {
            type: Date,
            required: true
        }
    },
    {
        timestamps: true
    }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ status: 1, expiresAt: 1 });
bookingSchema.index({ checkout: 1 });

bookingSchema.index(
    { razorpayOrderId: 1 },
    { unique: true, sparse: true }
);

bookingSchema.index(
    { razorpayPaymentId: 1 },
    { unique: true, sparse: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;