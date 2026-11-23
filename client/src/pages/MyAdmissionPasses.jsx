
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Clock3,
    Ticket
} from "lucide-react";

import api from "../services/api";

const MyAdmissionPasses = () => {
    const [passes, setPasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadPasses = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get("/admission-passes/me");
            setPasses(response.data.passes || []);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to load admission passes."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadPasses();
    }, [loadPasses]);

    const getPassStatus = (pass) => {
        if (pass.status === "USED") return "Admitted";
        if (pass.status === "REVOKED") return "Revoked";

        if (new Date(pass.expiresAt) <= new Date()) {
            return "Expired";
        }

        return "Active";
    };

    const getStatusClass = (status) => {
        if (status === "Admitted") return "admission-used";
        if (status === "Active") return "admission-active";

        return "admission-expired";
    };

    return (
        <div className="admission-page">
            <header className="admission-header">
                <Link to="/" className="brand">
                    <span className="brand-icon">
                        <Ticket size={22} />
                    </span>

                    <span>
                        event<span className="brand-accent">sphere</span>
                    </span>
                </Link>

                <Link to="/my-bookings" className="admission-back-link">
                    <ArrowLeft size={16} />
                    My bookings
                </Link>
            </header>

            <main className="admission-container">
                <span className="section-label">
                    YOUR EVENT ENTRY PASSES
                </span>

                <h1>My admission passes</h1>

                <p className="admission-intro">
                    Your confirmed event tickets are listed below.
                    Open an individual ticket to view its admission QR code.
                </p>

                {loading ? (
                    <div className="admission-empty">
                        Loading your admission passes...
                    </div>
                ) : error ? (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                ) : passes.length === 0 ? (
                    <div className="admission-empty">
                        <Ticket size={40} />

                        <h2>No admission passes yet</h2>

                        <p>
                            Confirmed bookings will appear here.
                        </p>

                        <Link to="/" className="cart-primary-btn">
                            Explore events
                        </Link>
                    </div>
                ) : (
                    <div className="admission-list">
                        {passes.map((pass) => {
                            const booking = pass.booking;
                            const status = getPassStatus(pass);

                            return (
                                <article
                                    className="admission-list-card"
                                    key={pass._id}
                                >
                                    <div className="admission-list-main">
                                        <div className="admission-list-icon">
                                            <Ticket size={25} />
                                        </div>

                                        <div className="admission-list-info">
                                            <span className="cart-item-category">
                                                {booking.ticketTypeName}
                                            </span>

                                            <h2>{booking.eventTitle}</h2>

                                            <p>
                                                {booking.venue}, {booking.city}
                                            </p>

                                            <div className="admission-list-meta">
                                                <span>
                                                    {booking.quantity} guest(s)
                                                </span>

                                                <span>
                                                    {new Date(
                                                        booking.eventDate
                                                    ).toLocaleDateString("en-IN")}
                                                </span>

                                                <span>
                                                    Ref: {booking.bookingReference}
                                                </span>
                                            </div>
                                        </div>

                                        <span
                                            className={`admission-status ${getStatusClass(status)}`}
                                        >
                                            {status}
                                        </span>
                                    </div>

                                    {pass.status === "USED" ? (
                                        <p className="admission-used-note">
                                            <CheckCircle2 size={16} />
                                            This ticket group has already been admitted.
                                        </p>
                                    ) : status === "Expired" || status === "Revoked" ? (
                                        <p className="admission-warning-note">
                                            <Clock3 size={16} />
                                            This admission pass is no longer valid.
                                        </p>
                                    ) : null}

                                    <div className="admission-list-footer">
                                        <span>
                                            One QR code represents this complete
                                            ticket group.
                                        </span>

                                        <Link
                                            to={`/my-passes/${pass._id}`}
                                            className="admission-view-ticket"
                                        >
                                            View ticket
                                            <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
};

export default MyAdmissionPasses;
