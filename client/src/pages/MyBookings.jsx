
import { useCallback, useEffect, useState } from "react";

import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    MapPin,
    Ticket,
    XCircle,
    RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";

import api from "../services/api";

const MyBookings = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancellingId, setCancellingId] = useState(null);


    const formatCurrency = (amount, currency = "INR") => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0
        }).format(Number(amount || 0));
    };

    const fetchBookings = useCallback(async () => {
        try {
            setError("");

            const response = await api.get("/bookings/me");

            setBookings(response.data.bookings);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load your bookings."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleCancel = async (booking) => {
        const confirmed = window.confirm(
            `Cancel reservation ${booking.bookingReference}?`
        );

        if (!confirmed) return;

        setCancellingId(booking._id);
        setError("");

        try {
            const response = await api.patch(
                `/bookings/${booking._id}/cancel`
            );

            const cancelledIds =
                response.data.cancelledBookingIds || [booking._id];

            setBookings((previous) =>
                previous.map((item) =>
                    cancelledIds.includes(item._id)
                        ? { ...item, status: "CANCELLED" }
                        : item
                )
            );

            alert(response.data.message);

        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to cancel reservation."
            );

            await fetchBookings();
        } finally {
            setCancellingId(null);
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short"
        });
    };

    const getStatusClass = (status) => {
        return `booking-status booking-${status.toLowerCase()}`;
    };

    return (
        <div className="my-bookings-page">

            <header className="dashboard-header">
                <Link to="/dashboard" className="back-home">
                    <ArrowLeft size={17} />
                    Back to dashboard
                </Link>

                <span className="section-label">
                    MY EVENTSPHERE
                </span>
            </header>

            <main className="my-bookings-container">

                <div className="organizer-apply-heading">
                    <span className="section-label">
                        YOUR EXPERIENCES
                    </span>

                    <h1>My bookings.</h1>

                    <p>
                        View and manage your event reservations.
                    </p>
                </div>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="my-bookings-toolbar">
                    <h2>Booking history</h2>

                    <button
                        className="view-all-btn"
                        onClick={() => {
                            setLoading(true);
                            fetchBookings();
                        }}
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="auth-loading">
                        Loading your bookings...
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="application-status">
                        <Ticket size={38} />

                        <h2>No bookings yet</h2>

                        <p>
                            You haven't reserved any event tickets.
                            Discover something exciting!
                        </p>

                        <Link to="/" className="search-button">
                            Explore events
                        </Link>
                    </div>
                ) : (
                    <div className="booking-list">
                        {bookings.map((booking) => (
                            <article
                                className="booking-card"
                                key={booking._id}
                            >
                                <div className="booking-event-image">
                                    <img
                                        src={
                                            booking.imageUrl ||
                                            booking.event?.imageUrl
                                        }
                                        alt={booking.eventTitle}
                                    />

                                    <span className={getStatusClass(booking.status)}>
                                        {booking.status.replaceAll("_", " ")}
                                    </span>
                                </div>

                                <div className="booking-card-content">

                                    <div className="booking-card-heading">
                                        <div>
                                            <span className="section-label">
                                                {booking.bookingReference}
                                            </span>

                                            <h3>{booking.eventTitle}</h3>
                                        </div>
                                    </div>

                                    <div className="booking-meta">
                                        <span>
                                            <CalendarDays size={15} />
                                            {formatDate(booking.eventDate)}
                                        </span>

                                        <span>
                                            <MapPin size={15} />
                                            {booking.venue}, {booking.city}
                                        </span>

                                        <span>
                                            <Ticket size={15} />
                                            {booking.ticketTypeName}
                                        </span>
                                    </div>

                                    <div className="booking-card-footer">
                                        <div className="booking-price-details">
                                            <span>
                                                {booking.quantity} ticket(s)
                                            </span>

                                            <strong>
                                                {formatCurrency(booking.totalAmount, booking.currency)}
                                            </strong>
                                        </div>

                                        {booking.status === "PENDING_PAYMENT" && (
                                            <div className="booking-payment-actions">

                                                {booking.checkout?.status === "PENDING_PAYMENT" &&
                                                    new Date(booking.checkout.expiresAt).getTime() > Date.now() && (
                                                        <Link
                                                            to={`/checkout/${booking.checkout._id}`}
                                                            className="booking-pay-btn"
                                                        >
                                                            Resume payment
                                                        </Link>
                                                    )}
                                                <button
                                                    className="booking-cancel-btn"
                                                    disabled={cancellingId === booking._id}
                                                    onClick={() => handleCancel(booking)}
                                                >
                                                    <XCircle size={15} />

                                                    {cancellingId === booking._id
                                                        ? "Cancelling..."
                                                        : "Cancel reservation"}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {booking.status === "PENDING_PAYMENT" && (
                                        <div className="booking-pending-notice">
                                            <Clock3 size={15} />

                                            <span>
                                                This reservation is awaiting payment.
                                                Return to your active checkout to retry payment.
                                                Reservation expires at{" "}
                                                {formatDate(booking.expiresAt)}.
                                            </span>
                                        </div>
                                    )}

                                    {booking.status === "EXPIRED" && (
                                        <div className="booking-expired-notice">
                                            This reservation has expired.
                                            You can book again while tickets remain available.
                                        </div>
                                    )}

                                </div>
                            </article>
                        ))}
                    </div>
                )}

            </main>
        </div>
    );
};

export default MyBookings;
