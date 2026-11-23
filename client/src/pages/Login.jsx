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

const Login = () => {
    const { login, user, loading } = useAuth();
    const { addItem } = useCart();
    const navigate = useNavigate();
    const location = useLocation();

    const [formData, setFormData] = useState({
        email: "",
        password: ""
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
        setSubmitting(true);

        try {
            await login(formData);
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
                "Unable to login. Please try again."
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
                        YOUR NEXT EXPERIENCE STARTS HERE
                    </span>

                    <h1>
                        Make room
                        <br />
                        for <span>memories.</span>
                    </h1>

                    <p>
                        Discover incredible experiences, meet
                        amazing people and be part of something special.
                    </p>

                    <div className="auth-decoration-bottom">
                        <Ticket size={25} />
                        <span>Discover. Book. Experience.</span>
                    </div>
                </div>

                <div className="auth-form-container">
                    <span className="section-label">
                        WELCOME BACK
                    </span>

                    <h2>Sign in to your account</h2>

                    <p className="auth-subtitle">
                        Welcome back! Enter your details below.
                    </p>

                    {error && (
                        <div className="auth-error" role="alert">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
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
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    autoComplete="current-password"
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

                        <button
                            className="auth-submit"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? "Signing in..." : "Sign in"}

                            {!submitting && <ArrowRight size={18} />}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Don't have an account?
                        <Link to="/register" state={location.state}> Create account</Link>
                    </p>

                    <p className="auth-legal">
                        By continuing, you agree to our Terms
                        and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;