
import { useEffect, useState } from "react";

import {
    ArrowLeft,
    CheckCircle2,
    Clock3,
    ShieldCheck
} from "lucide-react";

import { Link } from "react-router-dom";

import api from "../services/api";

const initialForm = {
    organizationName: "",
    organizationType: "Individual",
    description: "",
    website: "",
    contactPhone: "",
    experience: ""
};

const OrganizerApply = () => {
    const [formData, setFormData] = useState(initialForm);
    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        const fetchApplication = async () => {
            try {
                const response = await api.get(
                    "/organizer-applications/me"
                );

                const existing = response.data.application;

                setApplication(existing);

                if (existing) {
                    setFormData({
                        organizationName: existing.organizationName || "",
                        organizationType: existing.organizationType || "Individual",
                        description: existing.description || "",
                        website: existing.website || "",
                        contactPhone: existing.contactPhone || "",
                        experience: existing.experience || ""
                    });
                }
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                    "Unable to load your application."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchApplication();
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setSuccess("");
        setSubmitting(true);

        try {
            const response = await api.post(
                "/organizer-applications",
                formData
            );

            setApplication(response.data.application);

            setSuccess(response.data.message);

        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to submit your application."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="auth-loading">
                Loading application...
            </div>
        );
    }

    return (
        <div className="organizer-apply-page">
            <header className="dashboard-header">
                <Link to="/dashboard" className="back-home">
                    <ArrowLeft size={17} />
                    Back to dashboard
                </Link>

                <span className="section-label">
                    ORGANIZER PROGRAM
                </span>
            </header>

            <main className="organizer-apply-container">
                <div className="organizer-apply-heading">
                    <span className="section-label">
                        GROW WITH EVENTSPHERE
                    </span>

                    <h1>Become an organizer.</h1>

                    <p>
                        Tell us about your organization and the
                        experiences you want to bring to people.
                    </p>
                </div>

                {application?.status === "approved" ? (
                    <div className="application-status approved">
                        <CheckCircle2 size={35} />

                        <h2>You're an approved organizer!</h2>

                        <p>
                            Your application has been approved.
                            You can now access organizer features.
                        </p>

                        <Link to="/dashboard" className="search-button">
                            Go to dashboard
                        </Link>
                    </div>
                ) : application?.status === "pending" ? (
                    <div className="application-status pending">
                        <Clock3 size={35} />

                        <h2>Application under review</h2>

                        <p>
                            Your application for{" "}
                            <strong>{application.organizationName}</strong>{" "}
                            has been submitted.
                        </p>

                        <p>
                            Our administrators will review your information.
                        </p>

                        <span className="application-date">
                            Submitted:{" "}
                            {new Date(application.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                ) : (
                    <form
                        className="organizer-apply-form"
                        onSubmit={handleSubmit}
                    >
                        <div className="application-security-note">
                            <ShieldCheck size={20} />

                            <span>
                                Applications are reviewed by EventSphere
                                administrators before organizer access is granted.
                            </span>
                        </div>

                        {application?.status === "rejected" && (
                            <div className="auth-error">
                                <strong>Previous application rejected:</strong>
                                <p>{application.rejectionReason}</p>
                                <p>You can update your details and apply again.</p>
                            </div>
                        )}

                        {error && (
                            <div className="auth-error">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="application-success">
                                {success}
                            </div>
                        )}

                        <div className="application-form-grid">
                            <div className="auth-field">
                                <label htmlFor="organizationName">
                                    Organization / Brand Name
                                </label>

                                <input
                                    id="organizationName"
                                    name="organizationName"
                                    value={formData.organizationName}
                                    onChange={handleChange}
                                    placeholder="Your organization name"
                                    minLength={2}
                                    maxLength={100}
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="organizationType">
                                    Organization Type
                                </label>

                                <select
                                    id="organizationType"
                                    name="organizationType"
                                    value={formData.organizationType}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="Individual">Individual</option>
                                    <option value="Company">Company</option>
                                    <option value="Non-profit">Non-profit</option>
                                    <option value="Educational Institution">
                                        Educational Institution
                                    </option>
                                    <option value="Community">Community</option>
                                </select>
                            </div>

                            <div className="auth-field">
                                <label htmlFor="contactPhone">
                                    Contact Number
                                </label>

                                <input
                                    id="contactPhone"
                                    name="contactPhone"
                                    value={formData.contactPhone}
                                    onChange={handleChange}
                                    placeholder="+91 9876543210"
                                    minLength={7}
                                    maxLength={20}
                                    required
                                />
                            </div>

                            <div className="auth-field">
                                <label htmlFor="website">
                                    Website (Optional)
                                </label>

                                <input
                                    id="website"
                                    name="website"
                                    type="url"
                                    value={formData.website}
                                    onChange={handleChange}
                                    placeholder="https://example.com"
                                />
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="description">
                                About Your Organization
                            </label>

                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Describe your organization and the types of events you plan to organize..."
                                minLength={30}
                                maxLength={1500}
                                rows={5}
                                required
                            />

                            <small>
                                {formData.description.length}/1500 characters
                            </small>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="experience">
                                Previous Event Experience (Optional)
                            </label>

                            <textarea
                                id="experience"
                                name="experience"
                                value={formData.experience}
                                onChange={handleChange}
                                placeholder="Tell us about previous events you have organized..."
                                rows={3}
                                maxLength={1000}
                            />
                        </div>

                        <button
                            type="submit"
                            className="auth-submit"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Submitting application..."
                                : "Submit organizer application"}
                        </button>
                    </form>
                )}
            </main>
        </div>
    );
};

export default OrganizerApply;
