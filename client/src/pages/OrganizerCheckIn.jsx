
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    MapPin,
    ShieldCheck,
    Ticket,
    UserCheck,
    XCircle
} from "lucide-react";

import api from "../services/api";

const OrganizerCheckIn = () => {
    const { token } = useParams();

    const [pass, setPass] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadPass = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const response = await api.get(`/checkin/${token}`);
            setPass(response.data.pass);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to verify this admission pass."
            );
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadPass();
    }, [loadPass]);

    const handleAdmit = async () => {
        if (submitting || pass?.status !== "ACTIVE") return;

        setSubmitting(true);
        setError("");
        setSuccess("");

        try {
            const response = await api.post(
                `/checkin/${token}/admit`
            );

            setSuccess(response.data.message);

            await loadPass();

        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to admit this group."
            );

            // Refresh to show if another authorized organizer
            // has already admitted the group.
            await loadPass();

        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="organizer-checkin-page">
            <header className="admission-header">
                <Link to="/" className="brand">
                    <span className="brand-icon">
                        <Ticket size={22} />
                    </span>

                    <span>
                        event<span className="brand-accent">sphere</span>
                    </span>
                </Link>

                <Link
                    to="/organizer/events"
                    className="admission-back-link"
                >
                    <ArrowLeft size={16} />
                    Organizer workspace
                </Link>
            </header>

            <main className="checkin-container">
                <div className="checkin-heading">
                    <ShieldCheck size={27} />

                    <div>
                        <span className="section-label">
                            EVENT ENTRY VERIFICATION
                        </span>

                        <h1>Organizer check-in</h1>
                    </div>
                </div>

                {loading ? (
                    <div className="checkin-card">
                        Verifying admission pass...
                    </div>
                ) : error && !pass ? (
                    <div className="checkin-card checkin-error">
                        <XCircle size={42} />
                        <h2>Pass verification failed</h2>
                        <p>{error}</p>
                    </div>
                ) : pass ? (
                    <section className="checkin-card">
                        <div className={`checkin-status-icon ${
                            pass.status === "USED"
                                ? "checkin-used"
                                : pass.status === "ACTIVE"
                                    ? "checkin-active"
                                    : "checkin-invalid"
                        }`}>
                            {pass.status === "USED"
                                ? <CheckCircle2 size={32} />
                                : pass.status === "ACTIVE"
                                    ? <UserCheck size={32} />
                                    : <XCircle size={32} />}
                        </div>

                        <span className="section-label">
                            {pass.status === "USED"
                                ? "ALREADY ADMITTED"
                                : pass.status === "ACTIVE"
                                    ? "VALID ADMISSION PASS"
                                    : "INVALID ADMISSION PASS"}
                        </span>

                        <h2>{pass.event.title}</h2>

                        <div className="checkin-event-location">
                            <MapPin size={17} />
                            {pass.event.venue}, {pass.event.city}
                        </div>

                        <div className="checkin-attendee">
                            <span>ATTENDEE</span>
                            <strong>{pass.booking.attendeeName}</strong>
                            <small>{pass.booking.attendeeEmail}</small>
                        </div>

                        <div className="checkin-ticket-details">
                            <div>
                                <span>TICKET CATEGORY</span>
                                <strong>{pass.booking.ticketTypeName}</strong>
                            </div>

                            <div>
                                <span>GROUP SIZE</span>
                                <strong>
                                    {pass.booking.quantity} guest(s)
                                </strong>
                            </div>

                            <div>
                                <span>BOOKING REFERENCE</span>
                                <strong>{pass.booking.reference}</strong>
                            </div>

                            <div>
                                <span>EVENT DATE</span>
                                <strong>
                                    {new Date(
                                        pass.event.date
                                    ).toLocaleDateString("en-IN")}
                                </strong>
                            </div>
                        </div>

                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="checkin-success-message">
                                <CheckCircle2 size={17} />
                                {success}
                            </div>
                        )}

                        {pass.status === "ACTIVE" && (
                            <button
                                type="button"
                                className="checkin-admit-btn"
                                onClick={handleAdmit}
                                disabled={submitting}
                            >
                                <UserCheck size={18} />
                                {submitting
                                    ? "Admitting guests..."
                                    : `Admit ${pass.booking.quantity} guest(s)`}
                            </button>
                        )}

                        {pass.status === "USED" && (
                            <div className="checkin-used-message">
                                <CheckCircle2 size={18} />
                                This QR code has already been redeemed.

                                {pass.checkedInAt && (
                                    <small>
                                        Admitted at:{" "}
                                        {new Date(
                                            pass.checkedInAt
                                        ).toLocaleString("en-IN")}
                                    </small>
                                )}
                            </div>
                        )}

                        <p className="checkin-security-note">
                            This pass can be redeemed only once by the
                            authorized organizer of this event.
                        </p>
                    </section>
                ) : null}
            </main>
        </div>
    );
};

export default OrganizerCheckIn;
