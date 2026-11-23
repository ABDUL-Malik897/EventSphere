
import { useEffect, useState } from "react";

import {
    ArrowLeft,
    Building2,
    CheckCircle2,
    Clock3,
    XCircle
} from "lucide-react";

import { Link } from "react-router-dom";

import api from "../services/api";

const AdminOrganizerApplications = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [processingId, setProcessingId] = useState(null);

    const fetchApplications = async () => {
        try {
            setError("");

            const response = await api.get(
                "/admin/organizer-applications?status=pending"
            );

            setApplications(response.data.applications);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to retrieve applications."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    const handleApprove = async (id) => {
        const confirmed = window.confirm(
            "Approve this organizer application?"
        );

        if (!confirmed) return;

        setProcessingId(id);
        setError("");

        try {
            await api.patch(
                `/admin/organizer-applications/${id}/approve`
            );

            await fetchApplications();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to approve application."
            );
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt(
            "Enter the reason for rejecting this application:"
        );

        if (reason === null) return;

        if (reason.trim().length < 5) {
            setError("Please enter a rejection reason of at least 5 characters.");
            return;
        }

        setProcessingId(id);
        setError("");

        try {
            await api.patch(
                `/admin/organizer-applications/${id}/reject`,
                { reason }
            );

            await fetchApplications();
        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to reject application."
            );
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="admin-applications-page">
            <header className="dashboard-header">
                <Link to="/dashboard" className="back-home">
                    <ArrowLeft size={17} />
                    Back to dashboard
                </Link>

                <span className="role-badge">ADMINISTRATOR</span>
            </header>

            <main className="admin-applications-container">
                <div className="organizer-apply-heading">
                    <span className="section-label">
                        PLATFORM ADMINISTRATION
                    </span>

                    <h1>Organizer applications</h1>

                    <p>
                        Review applications and decide who can
                        publish events on EventSphere.
                    </p>
                </div>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                <div className="admin-list-heading">
                    <h2>Pending applications</h2>

                    <button
                        className="view-all-btn"
                        onClick={fetchApplications}
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="auth-loading">
                        Loading applications...
                    </div>
                ) : applications.length === 0 ? (
                    <div className="application-status">
                        <CheckCircle2 size={34} />
                        <h2>All caught up!</h2>
                        <p>There are no pending organizer applications.</p>
                    </div>
                ) : (
                    <div className="admin-application-list">
                        {applications.map((application) => (
                            <article
                                className="admin-application-card"
                                key={application._id}
                            >
                                <div className="admin-application-top">
                                    <div className="dashboard-profile-icon">
                                        <Building2 size={24} />
                                    </div>

                                    <div>
                                        <h3>{application.organizationName}</h3>
                                        <span>{application.organizationType}</span>
                                    </div>

                                    <span className="application-pending-badge">
                                        <Clock3 size={13} />
                                        Pending
                                    </span>
                                </div>

                                <div className="application-user">
                                    <strong>
                                        {application.user?.name || "Unknown user"}
                                    </strong>
                                    <span>
                                        {application.user?.email || "No email"}
                                    </span>
                                </div>

                                <p className="admin-application-description">
                                    {application.description}
                                </p>

                                <div className="admin-application-meta">
                                    <span>
                                        Contact: {application.contactPhone}
                                    </span>

                                    {application.website && (
                                        <a
                                            href={application.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Visit website
                                        </a>
                                    )}
                                </div>

                                {application.experience && (
                                    <div className="application-experience">
                                        <strong>Previous experience</strong>
                                        <p>{application.experience}</p>
                                    </div>
                                )}

                                <div className="application-submitted">
                                    Submitted:{" "}
                                    {new Date(
                                        application.createdAt
                                    ).toLocaleDateString()}
                                </div>

                                <div className="admin-application-actions">
                                    <button
                                        className="approve-button"
                                        disabled={processingId === application._id}
                                        onClick={() => handleApprove(application._id)}
                                    >
                                        <CheckCircle2 size={16} />
                                        Approve
                                    </button>

                                    <button
                                        className="reject-button"
                                        disabled={processingId === application._id}
                                        onClick={() => handleReject(application._id)}
                                    >
                                        <XCircle size={16} />
                                        Reject
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminOrganizerApplications;
