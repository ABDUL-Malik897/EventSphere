
import { useCallback, useEffect, useState } from "react";

import {
    CheckCircle2,
    Ticket,
    CalendarDays,
    MapPin,
    RefreshCw
} from "lucide-react";

import {
    Link,
    useParams
} from "react-router-dom";

import api from "../services/api";

const PaymentSuccess = () => {
    const { bookingId } = useParams();

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchBooking = useCallback(async () => {
        try {
            setError("");

            const response = await api.get(
                `/bookings/${bookingId}`
            );

            setBooking(response.data.booking);

        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to retrieve booking details."
            );
        } finally {
            setLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        fetchBooking();
    }, [fetchBooking]);

    if (loading) {
        return (
            <div className="auth-loading">
                Checking your payment confirmation...
            </div>
        );
    }

    const confirmed = booking?.status === "CONFIRMED";

    return (
        <div className="payment-result-page">

            <div className="payment-result-card">

                {confirmed ? (
                    <>
                        <div className="payment-success-icon">
                            <CheckCircle2 size={43} />
                        </div>

                        <span className="section-label">
                            PAYMENT VERIFIED
                        </span>

                        <h1>You're going!</h1>

                        <p>
                            Your payment has been verified and
                            your event booking is confirmed.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="payment-pending-icon">
                            <RefreshCw size={37} />
                        </div>

                        <span className="section-label">
                            PAYMENT STATUS
                        </span>

                        <h1>Confirmation pending</h1>

                        <p>
                            {booking
                                ? `Your booking status is ${booking.status}. No confirmed ticket has been issued yet.`
                                : "We could not retrieve your booking."}
                        </p>

                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        <button
                            className="search-button"
                            onClick={() => {
                                setLoading(true);
                                fetchBooking();
                            }}
                        >
                            Check again
                        </button>
                    </>
                )}

                {booking && (
                    <div className="payment-booking-details">

                        <div className="payment-reference">
                            <span>BOOKING REFERENCE</span>
                            <strong>{booking.bookingReference}</strong>
                        </div>

                        <h2>{booking.eventTitle}</h2>

                        <div>
                            <CalendarDays size={17} />
                            {new Date(booking.eventDate).toLocaleString("en-IN")}
                        </div>

                        <div>
                            <MapPin size={17} />
                            {booking.venue}, {booking.city}
                        </div>

                        <div>
                            <Ticket size={17} />
                            {booking.quantity} × {booking.ticketTypeName}
                        </div>

                        <div className="payment-total">
                            <span>Booking total</span>
                            <strong>
                                ₹{booking.totalAmount.toLocaleString("en-IN")}
                            </strong>
                        </div>

                        <div className="payment-booking-status">
                            Booking status: <strong>{booking.status}</strong>
                        </div>

                    </div>
                )}

                <div className="payment-result-actions">
                    <Link to="/my-bookings" className="search-button">
                        View my bookings
                    </Link>

                    <Link to="/" className="payment-home-link">
                        Back to EventSphere
                    </Link>
                </div>

                <p className="payment-qr-note">
                    Your digital QR ticket will be available
                    after we implement ticket issuance.
                </p>

            </div>
        </div>
    );
};

export default PaymentSuccess;
