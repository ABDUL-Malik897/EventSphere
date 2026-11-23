
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    Ticket
} from "lucide-react";

import api from "../services/api";

const formatCurrency = (amount, currency = "INR") => {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0
        }).format(Number(amount || 0));
    } catch {
        return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
    }
};

const AdmissionPassDetails = () => {
    const { passId } = useParams();

    const [pass, setPass] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        const loadPass = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await api.get(
                    `/admission-passes/me/${passId}`
                );

                if (!cancelled) {
                    setPass(response.data.pass);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.response?.data?.message ||
                        "Unable to load this ticket."
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPass();

        return () => {
            cancelled = true;
        };
    }, [passId]);

    const getStatus = () => {
        if (!pass) return "";

        if (pass.status === "USED") return "Admitted";
        if (pass.status === "REVOKED") return "Revoked";

        if (new Date(pass.expiresAt) <= new Date()) {
            return "Expired";
        }

        return "Active";
    };

    const status = getStatus();

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

                <Link to="/my-passes" className="admission-back-link">
                    <ArrowLeft size={16} />
                    All my passes
                </Link>
            </header>

            <main className="admission-container">
                <span className="section-label">
                    YOUR EVENT ENTRY TICKET
                </span>

                <h1>Admission ticket</h1>

                {loading ? (
                    <div className="admission-empty">
                        Loading your ticket...
                    </div>
                ) : error ? (
                    <div className="auth-error" role="alert">
                        {error}

                        <p>
                            <Link to="/my-passes">
                                Return to My Passes
                            </Link>
                        </p>
                    </div>
                ) : pass ? (
                    <article className="admission-detail-card">
                        <div className="admission-detail-heading">
                            <div>
                                <span className="cart-item-category">
                                    {pass.booking.ticketTypeName}
                                </span>

                                <h2>{pass.booking.eventTitle}</h2>

                                <p>
                                    {pass.booking.venue}, {pass.booking.city}
                                </p>
                            </div>

                            <span
                                className={`admission-status ${
                                    status === "Active"
                                        ? "admission-active"
                                        : status === "Admitted"
                                            ? "admission-used"
                                            : "admission-expired"
                                }`}
                            >
                                {status}
                            </span>
                        </div>

                        <div className="admission-detail-qr">
                            <p>YOUR ADMISSION QR CODE</p>

                            <img
                                src={pass.qrCodeDataUrl}
                                alt={`Admission QR for ${pass.booking.eventTitle}`}
                            />

                            <span>
                                Present this QR code to the event organizer
                                at the entrance.
                            </span>
                        </div>

                        <div className="admission-ticket-details">
                            <div>
                                <span>BOOKING REFERENCE</span>
                                <strong>
                                    {pass.booking.bookingReference}
                                </strong>
                            </div>

                            <div>
                                <span>GROUP SIZE</span>
                                <strong>
                                    {pass.booking.quantity} guest(s)
                                </strong>
                            </div>

                            <div>
                                <span>EVENT DATE</span>
                                <strong>
                                    {new Date(
                                        pass.booking.eventDate
                                    ).toLocaleDateString("en-IN")}
                                </strong>
                            </div>

                            <div>
                                <span>TICKET TOTAL</span>
                                <strong>
                                    {formatCurrency(
                                        pass.booking.totalAmount,
                                        pass.booking.currency
                                    )}
                                </strong>
                            </div>
                        </div>

                        {status === "Admitted" ? (
                            <p className="admission-used-note">
                                <CheckCircle2 size={16} />
                                This ticket group has already been admitted.
                            </p>
                        ) : status !== "Active" ? (
                            <p className="admission-warning-note">
                                <Clock3 size={16} />
                                This admission pass is no longer valid.
                            </p>
                        ) : (
                            <p className="admission-hint">
                                This single QR code represents all{" "}
                                {pass.booking.quantity} ticket(s) in this booking.
                                It can only be used once.
                            </p>
                        )}
                    </article>
                ) : null}
            </main>
        </div>
    );
};

export default AdmissionPassDetails;
