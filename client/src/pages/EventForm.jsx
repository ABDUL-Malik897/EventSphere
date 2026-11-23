
import { useEffect, useState } from "react";

import {
    ArrowLeft,
    Plus,
    Trash2,
    Ticket
} from "lucide-react";

import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";

import api from "../services/api";

const categories = [
    "Music",
    "Technology",
    "Food & Drink",
    "Arts",
    "Sports",
    "Business",
    "Education",
    "Other"
];

const emptyTicket = {
    name: "",
    description: "",
    price: "",
    quantity: ""
};

const initialForm = {
    title: "",
    description: "",
    category: "Music",
    date: "",
    time: "",
    venue: "",
    city: "",
    imageUrl: "",
    tag: "New"
};

const toLocalDateTime = (date) => {
    const value = new Date(date);

    const offset = value.getTimezoneOffset() * 60000;

    return new Date(value.getTime() - offset)
        .toISOString()
        .slice(0, 16);
};

const EventForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const editing = Boolean(id);

    const [formData, setFormData] = useState(initialForm);

    const [tickets, setTickets] = useState([
        {
            ...emptyTicket,
            name: "General Admission",
            price: "499",
            quantity: "100"
        }
    ]);

    const [loading, setLoading] = useState(editing);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!editing) return;

        let active = true;

        const fetchEvent = async () => {
            try {
                const response = await api.get(
                    `/organizer/events/${id}`
                );

                if (!active) return;

                const event = response.data.event;

                setFormData({
                    title: event.title,
                    description: event.description,
                    category: event.category,
                    date: toLocalDateTime(event.date),
                    time: event.time,
                    venue: event.venue,
                    city: event.city,
                    imageUrl: event.imageUrl,
                    tag: event.tag || "New"
                });

                setTickets(
                    event.ticketTypes.length > 0
                        ? event.ticketTypes.map((ticket) => ({
                            _id: ticket._id,
                            name: ticket.name,
                            description: ticket.description || "",
                            price: String(ticket.price),
                            quantity: String(ticket.quantity)
                        }))
                        : [{
                            ...emptyTicket,
                            name: "General Admission",
                            price: String(event.price),
                            quantity: String(event.capacity || 100)
                        }]
                );

            } catch (err) {
                if (active) {
                    setError(
                        err.response?.data?.message ||
                        "Unable to load event."
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
    }, [id, editing]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleTicketChange = (index, e) => {
        const updated = [...tickets];

        updated[index] = {
            ...updated[index],
            [e.target.name]: e.target.value
        };

        setTickets(updated);
    };

    const addTicket = () => {
        if (tickets.length >= 8) {
            setError("You can add a maximum of 8 ticket categories.");
            return;
        }

        setTickets([
            ...tickets,
            { ...emptyTicket }
        ]);

        setError("");
    };

    const removeTicket = (index) => {
        if (tickets.length === 1) {
            setError("At least one ticket category is required.");
            return;
        }

        setTickets(tickets.filter((_, i) => i !== index));
        setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        if (new Date(formData.date) <= new Date()) {
            setError("Please choose a future event date.");
            return;
        }

        const invalidTicket = tickets.some(
            (ticket) =>
                !ticket.name.trim() ||
                ticket.price === "" ||
                ticket.quantity === "" ||
                Number(ticket.price) < 0 ||
                !Number.isInteger(Number(ticket.quantity)) ||
                Number(ticket.quantity) < 1
        );

        if (invalidTicket) {
            setError(
                "Please enter valid details for every ticket category."
            );
            return;
        }

        setSubmitting(true);

        const payload = {
            ...formData,
            date: new Date(formData.date).toISOString(),
            ticketTypes: tickets.map((ticket) => ({
                ...(ticket._id ? { _id: ticket._id } : {}),
                name: ticket.name.trim(),
                description: ticket.description,
                price: Number(ticket.price),
                quantity: Number(ticket.quantity)
            }))
        };

        try {
            if (editing) {
                await api.put(
                    `/organizer/events/${id}`,
                    payload
                );
            } else {
                await api.post(
                    "/organizer/events",
                    payload
                );
            }

            navigate("/organizer/events");

        } catch (err) {
            const serverErrors = err.response?.data?.errors;

            setError(
                serverErrors?.map((item) => item.message).join(" ") ||
                err.response?.data?.message ||
                "Unable to save event."
            );

        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="auth-loading">Loading event...</div>;
    }

    return (
        <div className="event-form-page">
            <header className="dashboard-header">
                <Link to="/organizer/events" className="back-home">
                    <ArrowLeft size={17} />
                    Back to my events
                </Link>

                <span className="section-label">
                    EVENT MANAGEMENT
                </span>
            </header>

            <main className="event-form-container">
                <div className="organizer-apply-heading">
                    <span className="section-label">
                        CREATE AN EXPERIENCE
                    </span>

                    <h1>{editing ? "Edit your event" : "Create a new event"}</h1>

                    <p>
                        Provide event details and configure your tickets.
                        Your event will be sent for administrator review.
                    </p>
                </div>

                <form
                    className="event-create-form"
                    onSubmit={handleSubmit}
                >
                    {error && (
                        <div className="auth-error" role="alert">
                            {error}
                        </div>
                    )}

                    <section className="form-section">
                        <h2>Basic information</h2>

                        <div className="auth-field">
                            <label htmlFor="title">Event title</label>
                            <input
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. Neon Nights Music Festival"
                                minLength={5}
                                maxLength={120}
                                required
                            />
                        </div>

                        <div className="event-form-grid">
                            <div className="auth-field">
                                <label htmlFor="category">Category</label>

                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleChange}
                                >
                                    {categories.map((category) => (
                                        <option key={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="auth-field">
                                <label htmlFor="tag">Event label</label>

                                <select
                                    id="tag"
                                    name="tag"
                                    value={formData.tag}
                                    onChange={handleChange}
                                >
                                    <option>New</option>
                                    <option>Trending</option>
                                    <option>Popular</option>
                                    <option>Limited seats</option>
                                </select>
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="description">Description</label>

                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Describe what attendees can expect..."
                                rows={5}
                                minLength={30}
                                maxLength={3000}
                                required
                            />
                        </div>
                    </section>

                    <section className="form-section">
                        <h2>Schedule and location</h2>

                        <div className="event-form-grid">
                            <div className="auth-field">
                                <label htmlFor="date">Event date and time</label>

                                <input
                                    id="date"
                                    type="datetime-local"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    min={new Date(Date.now() + 60000)
                                        .toISOString().slice(0, 16)}
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="time">Display time</label>

                                <input
                                    id="time"
                                    name="time"
                                    value={formData.time}
                                    onChange={handleChange}
                                    placeholder="7:00 PM onwards"
                                    maxLength={50}
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="venue">Venue</label>

                                <input
                                    id="venue"
                                    name="venue"
                                    value={formData.venue}
                                    onChange={handleChange}
                                    placeholder="Venue name"
                                    maxLength={150}
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="city">City</label>

                                <input
                                    id="city"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    placeholder="Lucknow"
                                    maxLength={80}
                                    required
                                />
                            </div>
                        </div>
                    </section>

                    <section className="form-section">
                        <h2>Event poster</h2>

                        <div className="auth-field">
                            <label htmlFor="imageUrl">
                                Image URL
                            </label>

                            <input
                                id="imageUrl"
                                type="url"
                                name="imageUrl"
                                value={formData.imageUrl}
                                onChange={handleChange}
                                placeholder="https://example.com/event-poster.jpg"
                                required
                            />

                            <small>
                                For now, provide a publicly accessible image URL.
                                We'll add S3 uploads later.
                            </small>
                        </div>

                        {formData.imageUrl && (
                            <img
                                className="event-poster-preview"
                                src={formData.imageUrl}
                                alt="Event poster preview"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                }}
                            />
                        )}
                    </section>

                    <section className="form-section">
                        <div className="ticket-section-heading">
                            <div>
                                <h2>Ticket categories</h2>
                                <p>
                                    Configure your ticket prices and available quantities.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="add-ticket-btn"
                                onClick={addTicket}
                            >
                                <Plus size={16} /> Add ticket
                            </button>
                        </div>

                        {tickets.map((ticket, index) => (
                            <div className="ticket-form-card" key={ticket._id || index}>
                                <div className="ticket-form-header">
                                    <span>
                                        <Ticket size={16} />
                                        Ticket {index + 1}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => removeTicket(index)}
                                        aria-label="Remove ticket category"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="auth-field">
                                    <label>Ticket name</label>

                                    <input
                                        name="name"
                                        value={ticket.name}
                                        onChange={(e) => handleTicketChange(index, e)}
                                        placeholder="General Admission / VIP"
                                        maxLength={50}
                                        required
                                    />
                                </div>

                                <div className="auth-field">
                                    <label>Description</label>

                                    <input
                                        name="description"
                                        value={ticket.description}
                                        onChange={(e) => handleTicketChange(index, e)}
                                        placeholder="What does this ticket include?"
                                        maxLength={250}
                                    />
                                </div>

                                <div className="event-form-grid">
                                    <div className="auth-field">
                                        <label>Price (₹)</label>

                                        <input
                                            type="number"
                                            name="price"
                                            value={ticket.price}
                                            onChange={(e) => handleTicketChange(index, e)}
                                            min="0"
                                            max="10000000"
                                            step="1"
                                            required
                                        />
                                    </div>

                                    <div className="auth-field">
                                        <label>Available quantity</label>

                                        <input
                                            type="number"
                                            name="quantity"
                                            value={ticket.quantity}
                                            onChange={(e) => handleTicketChange(index, e)}
                                            min="1"
                                            max="1000000"
                                            step="1"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    <button
                        type="submit"
                        className="auth-submit"
                        disabled={submitting}
                    >
                        {submitting
                            ? "Submitting event..."
                            : editing
                                ? "Save changes and resubmit"
                                : "Submit event for review"}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default EventForm;
