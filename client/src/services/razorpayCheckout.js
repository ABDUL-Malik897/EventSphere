
import api from "./api.js";

let checkoutScriptPromise = null;

// Load Razorpay Checkout JavaScript only once.
const loadRazorpayScript = () => {
    if (window.Razorpay) {
        return Promise.resolve(true);
    }

    if (checkoutScriptPromise) {
        return checkoutScriptPromise;
    }

    checkoutScriptPromise = new Promise((resolve) => {
        const script = document.createElement("script");

        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;

        script.onload = () => {
            resolve(Boolean(window.Razorpay));
        };

        script.onerror = () => {
            checkoutScriptPromise = null;
            resolve(false);
        };

        document.body.appendChild(script);
    });

    return checkoutScriptPromise;
};

// Create an order and open Razorpay Checkout.
export const startRazorpayCheckout = async (bookingId) => {
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
        throw new Error(
            "Unable to load Razorpay Checkout. Check your internet connection."
        );
    }

    // Ask our backend to create or retrieve the payment order.
    const orderResponse = await api.post(
        "/payments/create-order",
        { bookingId }
    );

    const order = orderResponse.data;

    return new Promise((resolve) => {
        let completed = false;

        // Prevent multiple callbacks from resolving the same checkout.
        const finish = (result) => {
            if (completed) return;

            completed = true;
            resolve(result);
        };

        const checkout = new window.Razorpay({
            key: order.keyId,

            amount: order.amount,

            currency: order.currency,

            name: "EventSphere",

            description: "Event ticket reservation",

            order_id: order.orderId,

            prefill: {
                name: order.prefill.name,
                email: order.prefill.email
            },

            theme: {
                color: "#f15b3e"
            },

            modal: {
                confirm_close: true,

                ondismiss: () => {
                    finish({
                        status: "dismissed",
                        message: "Payment checkout was closed."
                    });
                }
            },

            // This executes after a successful Checkout payment.
            handler: async (paymentResponse) => {
                try {
                    const verificationResponse = await api.post(
                        "/payments/verify",
                        {
                            bookingId,

                            razorpay_payment_id:
                                paymentResponse.razorpay_payment_id,

                            razorpay_order_id:
                                paymentResponse.razorpay_order_id,

                            razorpay_signature:
                                paymentResponse.razorpay_signature
                        }
                    );

                    const confirmedBooking =
                        verificationResponse.data.booking;

                    if (
                        !verificationResponse.data.success ||
                        confirmedBooking?.status !== "CONFIRMED"
                    ) {
                        finish({
                            status: "pending",
                            message:
                                "Payment was received, but booking confirmation is still pending."
                        });

                        return;
                    }

                    finish({
                        status: "confirmed",
                        booking: confirmedBooking
                    });

                } catch (error) {
                    console.error(
                        "Payment verification failed:",
                        error
                    );

                    finish({
                        status: "verification_failed",
                        message:
                            error.response?.data?.message ||
                            "Payment could not be verified. Please check My Bookings before retrying."
                    });
                }
            }
        });

        // Listen for failed payment attempts.
        checkout.on("payment.failed", (response) => {
            finish({
                status: "failed",
                message:
                    response.error?.description ||
                    "Payment failed. You can try again."
            });
        });

        checkout.open();
    });
};

// COMBINED CART CHECKOUT
export const startRazorpayCheckoutForCart = async (checkoutId) => {
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
        throw new Error(
            "Unable to load Razorpay Checkout. Check your internet connection."
        );
    }

    // Request one Razorpay order for the complete checkout.
    const orderResponse = await api.post(
        "/payments/checkout/create-order",
        { checkoutId }
    );

    const order = orderResponse.data;

    return new Promise((resolve) => {
        let completed = false;

        const finish = (result) => {
            if (completed) return;

            completed = true;
            resolve(result);
        };

        const checkout = new window.Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,

            name: "EventSphere",
            description: "Combined event ticket checkout",

            order_id: order.orderId,

            prefill: {
                name: order.prefill.name,
                email: order.prefill.email
            },

            theme: {
                color: "#f15b3e"
            },

            modal: {
                confirm_close: true,

                ondismiss: () => {
                    finish({
                        status: "dismissed",
                        message:
                            "Payment window closed. Your checkout remains available until its reservation expires."
                    });
                }
            },

            handler: async (paymentResponse) => {
                try {
                    const verificationResponse = await api.post(
                        "/payments/checkout/verify",
                        {
                            checkoutId,

                            razorpay_payment_id:
                                paymentResponse.razorpay_payment_id,

                            razorpay_order_id:
                                paymentResponse.razorpay_order_id,

                            razorpay_signature:
                                paymentResponse.razorpay_signature
                        }
                    );

                    const confirmedCheckout =
                        verificationResponse.data.checkout;

                    if (
                        !verificationResponse.data.success ||
                        confirmedCheckout?.status !== "CONFIRMED"
                    ) {
                        finish({
                            status: "pending",
                            message:
                                "Payment was received, but checkout confirmation is still pending. Refresh your checkout status."
                        });

                        return;
                    }

                    finish({
                        status: "confirmed",
                        checkout: confirmedCheckout
                    });

                } catch (error) {
                    console.error(
                        "Combined checkout verification failed:",
                        error
                    );

                    finish({
                        status: "verification_failed",
                        message:
                            error.response?.data?.message ||
                            "Payment verification could not be completed. Refresh your checkout status before trying again."
                    });
                }
            }
        });

        checkout.on("payment.failed", (response) => {
            finish({
                status: "failed",
                message:
                    response.error?.description ||
                    "Payment failed. You can retry while your reservation is active."
            });
        });

        checkout.open();
    });
};