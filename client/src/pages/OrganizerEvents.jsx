
import { useEffect, useState } from "react";

import {
    Plus,
    CalendarDays,
    MapPin,
    Edit3,
    Trash2,
    XCircle,
    RefreshCw,
    Ticket
} from "lucide-react";

import { Link } from "react-router-dom";

import api from "../services/api";

const OrganizerEvents = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchEvents = async () => {
        try {
            setError("");

            const response = await api.get("/organizer/events");

            setEvents(response.data.events);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load your events."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleDelete = async (id) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this unpublished event?"
        );

        if (!confirmed) return;

        try {
            await api.delete(`/organizer/events/${id}`);

            fetchEvents();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to delete event."
            );
        }
    };

    const handleCancel = async (id) => {
        const confirmed = window.confirm(
            "Cancel this published event? It will no longer be visible to attendees."
        );

        if (!confirmed) return;

        try {
            await api.patch(`/organizer/events/${id}/cancel`);

            fetchEvents();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to cancel event."
            );
        }
    };

    const statusLabel = {
        draft: "Draft",
        pending_review: "Under Review",
        published: "Published",
        rejected: "Rejected",
        cancelled: "Cancelled"
    };

    const counts = {
        total: events.length,
        published: events.filter((e) => e.status === "published").length,
        pending: events.filter((e) => e.status === "pending_review").length,
        rejected: events.filter((e) => e.status === "rejected").length
    };

    return (
        <div className="organizer-dashboard-page">
            <header className="dashboard-header">
                <Link to="/dashboard" className="back-home">
                    ← Back to dashboard
                </Link>

                <Link
                    to="/organizer/events/new"
                    className="create-event-btn"
                >
                    <Plus size={17} /> Create Event
                </Link>
            </header>

            <main className="organizer-dashboard-content">
                <div className="organizer-dashboard-title">
                    <span className="section-label">
                        ORGANIZER WORKSPACE
                    </span>

                    <h1>My Events</h1>

                    <p>
                        Create, organize and manage your experiences.
                    </p>
                </div>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="organizer-stats">
                    <div>
                        <span>Total events</span>
                        <strong>{counts.total}</strong>
                    </div>

                    <div>
                        <span>Published</span>
                        <strong>{counts.published}</strong>
                    </div>

                    <div>
                        <span>Under review</span>
                        <strong>{counts.pending}</strong>
                    </div>

                    <div>
                        <span>Rejected</span>
                        <strong>{counts.rejected}</strong>
                    </div>
                </div>

                <div className="organizer-events-heading">
                    <h2>Your event listings</h2>

                    <button
                        className="view-all-btn"
                        onClick={() => {
                            setLoading(true);
                            fetchEvents();
                        }}
                    >
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="auth-loading">
                        Loading your events...
                    </div>
                ) : events.length === 0 ? (
                    <div className="application-status">
                        <Ticket size={38} />

                        <h2>No events yet</h2>

                        <p>
                            Create your first event and share it with
                            the EventSphere community.
                        </p>

                        <Link
                            to="/organizer/events/new"
                            className="search-button"
                        >
                            Create your first event
                        </Link>
                    </div>
                ) : (
                    <div className="organizer-event-list">
                        {events.map((event) => (
                            <article
                                className="organizer-event-card"
                                key={event._id}
                            >
                                <img
                                    src={event.imageUrl}
                                    alt={event.title}
                                />

                                <div className="organizer-event-info">
                                    <div className="organizer-event-top">
                                        <span className={`status-pill status-${event.status}`}>
                                            {statusLabel[event.status]}
                                        </span>

                                        <span className="event-category">
                                            {event.category}
                                        </span>
                                    </div>

                                    <h3>{event.title}</h3>

                                    <div className="organizer-event-meta">
                                        <span>
                                            <CalendarDays size={14} />
                                            {new Date(event.date).toLocaleDateString("en-IN")}
                                        </span>

                                        <span>
                                            <MapPin size={14} />
                                            {event.venue}, {event.city}
                                        </span>
                                    </div>

                                    <div className="organizer-event-footer">
                                        <strong>
                                            From ₹{event.price.toLocaleString("en-IN")}
                                        </strong>

                                        <div className="organizer-event-actions">
                                            {!["cancelled"].includes(event.status) && (
                                                <Link
                                                    to={`/organizer/events/${event._id}/edit`}
                                                    className="icon-action"
                                                    title="Edit event"
                                                >
                                                    <Edit3 size={16} />
                                                </Link>
                                            )}

                                            {["draft", "pending_review", "rejected"].includes(event.status) && (
                                                <button
                                                    className="icon-action danger"
                                                    onClick={() => handleDelete(event._id)}
                                                    title="Delete event"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}

                                            {event.status === "published" && (
                                                <button
                                                    className="icon-action danger"
                                                    onClick={() => handleCancel(event._id)}
                                                    title="Cancel event"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {event.status === "rejected" && (
                                        <div className="event-rejection">
                                            Reason: {event.rejectionReason || "Please contact an administrator."}
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

export default OrganizerEvents;
