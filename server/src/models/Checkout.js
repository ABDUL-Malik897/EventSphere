
import mongoose from "mongoose";

const checkoutSchema = new mongoose.Schema(
    {
        checkoutReference: {
            type: String,
            required: true,
            unique: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        bookings: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true
        }],

        totalAmount: {
            type: Number,
            required: true,
            min: 0
        },

        currency: {
            type: String,
            required: true,
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

        razorpayOrderId: {
            type: String,
            default: undefined
        },

        razorpayPaymentId: {
            type: String,
            default: undefined
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

checkoutSchema.index({ user: 1, createdAt: -1 });
checkoutSchema.index({ status: 1, expiresAt: 1 });

checkoutSchema.index(
    { razorpayOrderId: 1 },
    { unique: true, sparse: true }
);

checkoutSchema.index(
    { razorpayPaymentId: 1 },
    { unique: true, sparse: true }
);

const Checkout = mongoose.model("Checkout", checkoutSchema);

export default Checkout;
