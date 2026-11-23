
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    RefreshCw,
    Ticket,
    XCircle
} from "lucide-react";

import api from "../services/api";
import { startRazorpayCheckoutForCart } from "../services/razorpayCheckout";

const formatCurrency = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
};

const formatDate = (date) => {
    if (!date) return "Date unavailable";

    return new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
};

const CheckoutStatus = () => {
    const { id } = useParams();
    const location = useLocation();

    const [checkout, setCheckout] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [retrying, setRetrying] = useState(false);

    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const [notice, setNotice] = useState(
        location.state?.notice || ""
    );

    const loadCheckout = useCallback(async () => {
        setRefreshing(true);
        setError("");

        try {
            const response = await api.get(`/checkouts/${id}`);

            setCheckout(response.data.checkout);
            return response.data.checkout;

        } catch (err) {
            const message =
                err.response?.data?.message ||
                "Unable to retrieve this checkout.";

            setError(message);
            throw err;

        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id]);

    useEffect(() => {
        loadCheckout().catch(() => {});
    }, [loadCheckout]);

    const isPending =
        checkout?.status === "PENDING_PAYMENT";

    const reservationActive =
        isPending &&
        checkout?.expiresAt &&
        new Date(checkout.expiresAt).getTime() > Date.now();

    const handleRetryPayment = async () => {
        if (!reservationActive || retrying) return;

        setRetrying(true);
        setActionError("");
        setNotice("");

        try {
            const result = await startRazorpayCheckoutForCart(id);

            if (result.status === "confirmed") {
                setNotice(
                    "Payment verified successfully. All your bookings are confirmed."
                );
            } else {
                setNotice(
                    result.message ||
                    "Payment wasn't completed. Your checkout status has been refreshed."
                );
            }

            await loadCheckout();

        } catch (err) {
            setActionError(
                err.response?.data?.message ||
                err.message ||
                "Unable to restart payment."
            );

            // Refresh the checkout in case a webhook confirmed it
            // while the browser was waiting for the payment response.
            await loadCheckout().catch(() => {});

        } finally {
            setRetrying(false);
        }
    };

    if (loading) {
        return (
            <div className="checkout-status-page">
                <div className="checkout-status-card">
                    Loading checkout details...
                </div>
            </div>
        );
    }

    if (error || !checkout) {
        return (
            <div className="checkout-status-page">
                <div className="checkout-status-card">
                    <XCircle size={45} />

                    <h1>Checkout unavailable</h1>

                    <p>{error || "Checkout not found."}</p>

                    <Link to="/" className="checkout-action-btn">
                        Return to EventSphere
                    </Link>
                </div>
            </div>
        );
    }

    const isConfirmed = checkout.status === "CONFIRMED";
    const isExpired = checkout.status === "EXPIRED";
    const isRefunded = checkout.status === "REFUNDED";

    return (
        <div className="checkout-status-page">
            <header className="checkout-status-header">
                <Link to="/" className="brand">
                    <span className="brand-icon">
                        <Ticket size={22} />
                    </span>

                    <span>
                        event<span className="brand-accent">sphere</span>
                    </span>
                </Link>

                <Link to="/" className="checkout-back-link">
                    <ArrowLeft size={16} />
                    Explore events
                </Link>
            </header>

            <main className="checkout-status-container">
                <section className="checkout-status-card">

                    <div className={`checkout-status-icon ${
                        isConfirmed
                            ? "checkout-confirmed"
                            : isExpired || isRefunded
                                ? "checkout-expired"
                                : "checkout-pending"
                    }`}>
                        {isConfirmed ? (
                            <CheckCircle2 size={38} />
                        ) : isExpired || isRefunded ? (
                            <XCircle size={38} />
                        ) : (
                            <Clock3 size={38} />
                        )}
                    </div>

                    <span className="section-label">
                        CHECKOUT REFERENCE
                    </span>

                    <h1>
                        {isConfirmed
                            ? "Payment successful!"
                            : isExpired
                                ? "Reservation expired"
                                : isRefunded
                                    ? "Checkout refunded"
                                    : "Checkout pending"}
                    </h1>

                    <p className="checkout-status-description">
                        {isConfirmed
                            ? "Your payment has been verified and all bookings in this checkout are confirmed."
                            : isExpired
                                ? "The reservation period has ended. Your tickets have been released back into inventory."
                                : isRefunded
                                    ? "This checkout has been marked as refunded."
                                    : "Your tickets are reserved temporarily. Complete payment before the reservation expires."}
                    </p>

                    <div className="checkout-reference">
                        <span>CHECKOUT REFERENCE</span>
                        <strong>{checkout.checkoutReference}</strong>
                    </div>

                    {notice && (
                        <div className="checkout-notice">
                            {notice}
                        </div>
                    )}

                    {actionError && (
                        <div className="auth-error" role="alert">
                            {actionError}
                        </div>
                    )}

                    <div className="checkout-bookings">
                        <h2>Tickets in this checkout</h2>

                        {checkout.bookings?.map((booking) => (
                            <article
                                className="checkout-booking-item"
                                key={booking._id}
                            >
                                <div>
                                    <strong>{booking.eventTitle}</strong>

                                    <span>
                                        {booking.ticketTypeName} ·{" "}
                                        {booking.quantity} ticket(s)
                                    </span>

                                    <small>
                                        {formatDate(booking.eventDate)}
                                    </small>
                                </div>

                                <strong>
                                    {formatCurrency(
                                        booking.totalAmount,
                                        booking.currency
                                    )}
                                </strong>
                            </article>
                        ))}
                    </div>

                    <div className="checkout-total">
                        <span>Total checkout amount</span>

                        <strong>
                            {formatCurrency(
                                checkout.totalAmount,
                                checkout.currency
                            )}
                        </strong>
                    </div>

                    {isPending && (
                        <div className="checkout-expiry-note">
                            <Clock3 size={16} />

                            Reservation expires:{" "}
                            {formatDate(checkout.expiresAt)}
                        </div>
                    )}

                    <div className="checkout-status-actions">

                        {reservationActive && (
                            <button
                                type="button"
                                className="checkout-action-btn"
                                onClick={handleRetryPayment}
                                disabled={retrying}
                            >
                                {retrying
                                    ? "Opening payment..."
                                    : "Retry payment"}
                            </button>
                        )}

                        {isPending && (
                            <button
                                type="button"
                                className="checkout-refresh-btn"
                                onClick={() =>
                                    loadCheckout().catch(() => {})
                                }
                                disabled={refreshing}
                            >
                                <RefreshCw size={16} />
                                {refreshing
                                    ? "Refreshing..."
                                    : "Refresh checkout status"}
                            </button>
                        )}

                        <Link
                            to="/my-bookings"
                            className="checkout-secondary-link"
                        >
                            View my bookings
                        </Link>

                        <Link
                            to="/"
                            className="checkout-secondary-link"
                        >
                            Return to events
                        </Link>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default CheckoutStatus;
