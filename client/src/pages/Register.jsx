import { useState } from "react";

import {
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff,
    Ticket
} from "lucide-react";

import {
    Link,
    Navigate,
    useLocation,
    useNavigate
} from "react-router-dom";
import { useCart } from "../context/CartContext";

import {
    readPendingCartItem,
    clearPendingCartItem
} from "../services/pendingCart";
import { useAuth } from "../context/AuthContext";

const Register = () => {
    const { register, user, loading } = useAuth();
    const location = useLocation();
    const { addItem } = useCart();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        if (formData.password.length < 8) {
            setError("Password must have at least 8 characters.");
            return;
        }

        if (formData.password.length > 72) {
            setError("Password cannot exceed 72 characters.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSubmitting(true);

        try {
            const pendingItem = readPendingCartItem();

            if (pendingItem) {
                await addItem(pendingItem);
                clearPendingCartItem();

                navigate("/cart", { replace: true });
                return;
            }

            const requestedDestination = location.state?.from;

            const destination =
                typeof requestedDestination === "string" &&
                requestedDestination.startsWith("/")
                    ? requestedDestination
                    : "/dashboard";

            navigate(destination, { replace: true });

        } catch (err) {
            setError(
                err.response?.data?.message ||
                "Unable to create your account."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="auth-loading">Loading...</div>;
    }

    if (user && !submitting && !error) {
        return (
            <Navigate
                to={
                    readPendingCartItem()
                        ? "/cart"
                        : location.state?.from || "/dashboard"
                }
                replace
            />
        );
    }

    return (
        <div className="auth-page">
            <div className="auth-topbar">
                <Link to="/" className="brand">
                    <span className="brand-icon">
                        <Ticket size={23} />
                    </span>
                    <span>
                        event<span className="brand-accent">sphere</span>
                    </span>
                </Link>

                <Link to="/" className="back-home">
                    <ArrowLeft size={16} />
                    Back to home
                </Link>
            </div>

            <div className="auth-container">
                <div className="auth-decoration">
                    <span className="section-label">
                        JOIN THE EXPERIENCE
                    </span>

                    <h1>
                        Your world.
                        <br />
                        Your <span>moments.</span>
                    </h1>

                    <p>
                        Create your account and start discovering
                        experiences worth remembering.
                    </p>

                    <div className="auth-decoration-bottom">
                        <Ticket size={25} />
                        <span>Your next adventure awaits.</span>
                    </div>
                </div>

                <div className="auth-form-container">
                    <span className="section-label">
                        GET STARTED
                    </span>

                    <h2>Create your account</h2>

                    <p className="auth-subtitle">
                        Join EventSphere and discover amazing events.
                    </p>

                    {error && (
                        <div className="auth-error" role="alert">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label htmlFor="name">Full name</label>

                            <input
                                id="name"
                                type="text"
                                name="name"
                                placeholder="Your full name"
                                value={formData.name}
                                onChange={handleChange}
                                minLength={2}
                                maxLength={60}
                                autoComplete="name"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="email">Email address</label>

                            <input
                                id="email"
                                type="email"
                                name="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="auth-field">
                            <label htmlFor="password">Password</label>

                            <div className="password-input">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="At least 8 characters"
                                    value={formData.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    minLength={8}
                                    maxLength={72}
                                    required
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label="Toggle password visibility"
                                >
                                    {showPassword
                                        ? <EyeOff size={19} />
                                        : <Eye size={19} />
                                    }
                                </button>
                            </div>
                        </div>

                        <div className="auth-field">
                            <label htmlFor="confirmPassword">
                                Confirm password
                            </label>

                            <input
                                id="confirmPassword"
                                type="password"
                                name="confirmPassword"
                                placeholder="Enter password again"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                autoComplete="new-password"
                                required
                            />
                        </div>

                        <button
                            className="auth-submit"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? "Creating account..." : "Create account"}

                            {!submitting && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account?
                        <Link to="/login" state={location.state}> Sign in</Link>
                    </p>

                    <p className="auth-legal">
                        By creating an account, you agree to our
                        Terms and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;