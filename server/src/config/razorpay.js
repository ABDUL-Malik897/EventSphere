import Razorpay from "razorpay";

let razorpayInstance;

export const getRazorpay = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error(
            "Razorpay API credentials are missing from .env"
        );
    }

    if (!razorpayInstance) {
        razorpayInstance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });
    }

    return razorpayInstance;
};