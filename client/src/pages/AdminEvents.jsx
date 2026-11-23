import { useEffect, useState } from "react";

import {
    CheckCircle2,
    XCircle,
    MapPin,
    CalendarDays,
    Ticket
} from "lucide-react";

import { Link } from "react-router-dom";

import api from "../services/api";

const AdminEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [processingId, setProcessingId] = useState(null);

    const fetchEvents = async () => {
        try {
            setError("");

            const response = await api.get("/admin/events/pending");

            setEvents(response.data.events);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load pending events."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleApprove = async (id) => {
        if (!window.confirm("Approve and publish this event?")) {
            return;
        }

        setProcessingId(id);
        setError("");

        try {
            await api.patch(`/admin/events/${id}/approve`);
            await fetchEvents();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to approve event."
            );
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt(
            "Enter the reason for rejecting this event:"
        );

        if (reason === null) return;

        if (reason.trim().length < 5) {
            setError("Please enter a rejection reason of at least 5 characters.");
            return;
        }

        setProcessingId(id);
        setError("");

        try {
            await api.patch(`/admin/events/${id}/reject`, {
                reason
            });

            await fetchEvents();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to reject event."
            );
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="admin-events-page">
            <header className="dashboard-header">
                <Link to="/dashboard" className="back-home">
                    ← Back to dashboard
                </Link>

                <span className="role-badge">ADMINISTRATOR</span>
            </header>

            <main className="admin-events-container">
                <div className="organizer-apply-heading">
                    <span className="section-label">
                        PLATFORM MODERATION
                    </span>

                    <h1>Event approvals</h1>

                    <p>
                        Review submitted events before publishing
                        them on the public EventSphere platform.
                    </p>
                </div>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="admin-list-heading">
                    <h2>Pending events ({events.length})</h2>

                    <button
                        className="view-all-btn"
                        onClick={fetchEvents}
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="auth-loading">
                        Loading pending events...
                    </div>
                ) : events.length === 0 ? (
                    <div className="application-status">
                        <CheckCircle2 size={38} />
                        <h2>No pending events</h2>
                        <p>All submitted events have been reviewed.</p>
                    </div>
                ) : (
                    <div className="admin-event-list">
                        {events.map((event) => (
                            <article
                                className="admin-event-card"
                                key={event._id}
                            >
                                <img
                                    src={event.imageUrl}
                                    alt={event.title}
                                />

                                <div className="admin-event-content">
                                    <span className="event-category">
                                        {event.category}
                                    </span>

                                    <h3>{event.title}</h3>

                                    <p className="admin-event-description">
                                        {event.description}
                                    </p>

                                    <div className="admin-event-details">
                                        <span>
                                            <CalendarDays size={15} />
                                            {new Date(event.date).toLocaleDateString("en-IN")}
                                        </span>

                                        <span>
                                            <MapPin size={15} />
                                            {event.venue}, {event.city}
                                        </span>

                                        <span>
                                            <Ticket size={15} />
                                            {event.capacity} tickets
                                        </span>
                                    </div>

                                    <div className="admin-event-organizer">
                                        <strong>
                                            Organizer: {event.organizer?.name || "Unknown"}
                                        </strong>

                                        <span>
                                            {event.organizer?.email || ""}
                                        </span>
                                    </div>

                                    <div className="admin-event-tickets">
                                        {event.ticketTypes.map((ticket) => (
                                            <span key={ticket._id}>
                                                {ticket.name}: ₹{ticket.price}
                                                {" · "}
                                                {ticket.quantity} available
                                            </span>
                                        ))}
                                    </div>

                                    <div className="admin-application-actions">
                                        <button
                                            className="approve-button"
                                            disabled={processingId === event._id}
                                            onClick={() => handleApprove(event._id)}
                                        >
                                            <CheckCircle2 size={16} />
                                            Approve and publish
                                        </button>

                                        <button
                                            className="reject-button"
                                            disabled={processingId === event._id}
                                            onClick={() => handleReject(event._id)}
                                        >
                                            <XCircle size={16} />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminEvents;