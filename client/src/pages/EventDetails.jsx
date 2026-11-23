
import { useEffect, useState } from "react";

import {
    ArrowLeft,
    CalendarDays,
    Clock3,
    MapPin,
    Ticket
} from "lucide-react";

import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import CartLink from "../components/CartLink";

import { savePendingCartItem } from "../services/pendingCart";
    
const EventDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addItem } = useCart();
    const [event, setEvent] = useState(null);
    const [ticketId, setTicketId] = useState("");
    const [quantity, setQuantity] = useState(1);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        const fetchEvent = async () => {
            try {
                const response = await api.get(`/events/${id}`);

                if (!active) return;

                const fetchedEvent = response.data.data;

                setEvent(fetchedEvent);

                setTicketId(
                    fetchedEvent.ticketTypes?.[0]?._id || ""
                );
            } catch (err) {
                if (active) {
                    setError(
                        err.response?.data?.message ||
                        "Unable to load this event."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchEvent();

        return () => {
            active = false;
        };
    }, [id]);

    const selectedTicket = event?.ticketTypes?.find(
        (ticket) => ticket._id === ticketId
    );

    const available = selectedTicket
        ? Math.max(0, selectedTicket.quantity - selectedTicket.sold)
        : 0;

    const handleBooking = async () => {
        if (!user) {
            navigate("/login", {
                state: { from: `/events/${id}` }
            });
            return;
        }

        if (!selectedTicket || available < 1) {
            setError("This ticket category is unavailable.");
            return;
        }

        setSubmitting(true);
        setError("");

        let bookingId = null;

        try {
            const reservation = await api.post("/bookings", {
                eventId: event._id,
                ticketTypeId: ticketId,
                quantity
            });

            bookingId = reservation.data.booking._id;

            const payment = await startRazorpayCheckout(bookingId);

            if (payment.status === "confirmed") {
                navigate(`/payment/success/${bookingId}`);
                return;
            }

            navigate("/my-bookings");

        } catch (err) {
            if (bookingId) {
                navigate("/my-bookings");
            } else {
                setError(
                    err.response?.data?.message ||
                    err.message ||
                    "Unable to reserve tickets."
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddToCart = async () => {
        if (!selectedTicket || available < 1) {
            setError("This ticket category is unavailable.");
            return;
        }

        if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > Math.min(20, available)
        ) {
            setError("Please select a valid ticket quantity.");
            return;
        }

        const cartItem = {
            eventId: event._id,
            ticketTypeId: ticketId,
            quantity
        };

        // Preserve the selected ticket until the guest signs in.
        if (!user) {
            savePendingCartItem(cartItem);

            navigate("/login", {
                state: { from: "/cart" }
            });

            return;
        }

        if (!["ATTENDEE", "ORGANIZER"].includes(user.role)) {
            setError("This account cannot purchase event tickets.");
            return;
        }

        setSubmitting(true);
        setError("");

        try {
            await addItem(cartItem);
            navigate("/cart");
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to add tickets to your cart. Please try again."
            );
        } finally {
            setSubmitting(false);
        }
    };


    if (loading) {
        return (
            <div className="auth-loading">
                Loading event details...
            </div>
        );
    }

    if (error && !event) {
        return (
            <div className="auth-loading">
                <h2>Event unavailable</h2>
                <p>{error}</p>
                <Link to="/">Return to EventSphere</Link>
            </div>
        );
    }

    if (!event) return null;

    return (
        <div className="event-details-page">

            <header className="dashboard-header">
                <Link to="/" className="back-home">
                    <ArrowLeft size={17} />
                    Back to events
                </Link>

                <Link to="/" className="brand">
                    event<span className="brand-accent">sphere</span>
                </Link>

                <CartLink />
            </header>

            <main className="event-details-container">

                <img
                    className="event-details-cover"
                    src={event.imageUrl}
                    alt={event.title}
                />

                <div className="event-details-layout">

                    <section className="event-details-main">

                        <span className="section-label">
                            {event.category}
                        </span>

                        <h1>{event.title}</h1>

                        <p className="event-details-description">
                            {event.description}
                        </p>

                        <div className="event-details-information">

                            <div>
                                <CalendarDays />
                                <span>
                                    {new Date(event.date).toLocaleString("en-IN")}
                                </span>
                            </div>

                            <div>
                                <Clock3 />
                                <span>{event.time}</span>
                            </div>

                            <div>
                                <MapPin />
                                <span>{event.venue}, {event.city}</span>
                            </div>

                        </div>

                        <div className="event-about">
                            <h2>About this event</h2>
                            <p>{event.description}</p>
                        </div>

                    </section>

                    <aside className="event-booking-panel">

                        <h2>Get your tickets</h2>

                        <p>Choose your preferred ticket category and add it to your cart.</p>

                        {event.ticketTypes?.map((ticket) => {
                            const remaining = Math.max(
                                0,
                                ticket.quantity - ticket.sold
                            );

                            return (
                                <button
                                    type="button"
                                    key={ticket._id}
                                    disabled={remaining === 0}
                                    className={`event-ticket-choice ${
                                        ticketId === ticket._id
                                            ? "selected"
                                            : ""
                                    }`}
                                    onClick={() => {
                                        setTicketId(ticket._id);
                                        setQuantity(1);
                                    }}
                                >
                                    <span>
                                        <strong>{ticket.name}</strong>
                                        <small>
                                            {remaining} available
                                        </small>
                                    </span>

                                    <strong>
                                        ₹{ticket.price.toLocaleString("en-IN")}
                                    </strong>
                                </button>
                            );
                        })}

                        {selectedTicket && available > 0 && (
                            <>
                                <label className="event-quantity-label">
                                    Quantity

                                    <select
                                        value={quantity}
                                        onChange={(e) =>
                                            setQuantity(Number(e.target.value))
                                        }
                                    >
                                        {Array.from(
                                            { length: Math.min(20, available) },
                                            (_, i) => i + 1
                                        ).map((number) => (
                                            <option key={number} value={number}>
                                                {number}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <div className="event-total">
                                    <span>Total</span>
                                    <strong>
                                        ₹{(
                                            selectedTicket.price * quantity
                                        ).toLocaleString("en-IN")}
                                    </strong>
                                </div>
                            </>
                        )}

                        {error && (
                            <div className="auth-error">{error}</div>
                        )}

                        <button
                            className="auth-submit"
                            disabled={
                                submitting ||
                                !selectedTicket ||
                                available < 1
                            }
                            onClick={handleAddToCart}
                        >
                            {submitting
                                ? "Adding to cart..."
                                : user
                                    ? "Add to cart"
                                    : "Sign in to add to cart"}
                        </button>

                        <small className="event-payment-note">
                            Tickets are not reserved when added to your cart.
                            Inventory is checked again during checkout.
                        </small>

                    </aside>

                </div>
            </main>
        </div>
    );
};

export default EventDetails;
