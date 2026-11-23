
import { useState } from "react";

import {
    CalendarDays,
    CheckCircle2,
    LogOut,
    Ticket,
    UserRound,
    ShieldCheck
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [error, setError] = useState("");
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setError("");
        setLoggingOut(true);

        try {
            await logout();
            navigate("/", { replace: true });
        } catch {
            setError("Unable to contact the server. Your local session was cleared.");
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <div className="dashboard-page">

            {/* HEADER */}
            <header className="dashboard-header">
                <Link to="/" className="brand">
                    <span className="brand-icon">
                        <Ticket size={22} />
                    </span>

                    <span>
                        event<span className="brand-accent">sphere</span>
                    </span>
                </Link>

                <button
                    className="dashboard-logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                >
                    <LogOut size={17} />
                    {loggingOut ? "Signing out..." : "Sign out"}
                </button>
            </header>

            <main className="dashboard-content">

                {/* WELCOME */}
                <div className="dashboard-welcome">
                    <span className="section-label">
                        YOUR EVENTSPHERE ACCOUNT
                    </span>

                    <h1>
                        Welcome, {user?.name?.split(" ")[0]}!
                    </h1>

                    <p>
                        Your next memorable experience is waiting for you.
                    </p>
                </div>

                {error && (
                    <div className="auth-error" role="alert">
                        {error}
                    </div>
                )}

                {/* USER PROFILE */}
                <div className="dashboard-profile">
                    <div className="dashboard-profile-icon">
                        <UserRound size={30} />
                    </div>

                    <div className="dashboard-profile-details">
                        <span>YOUR ACCOUNT</span>

                        <h2>{user?.name}</h2>

                        <p>{user?.email}</p>
                    </div>

                    <span className="role-badge">
                        {user?.role}
                    </span>
                </div>

                {/* ATTENDEE ACTIONS */}
                {user?.role === "ATTENDEE" && (
                    <Link
                        to="/organizer/apply"
                        className="dashboard-action-card"
                    >
                        <div className="dashboard-card-icon">
                            <Ticket size={22} />
                        </div>

                        <div>
                            <h3>Become an organizer</h3>

                            <p>
                                Apply to publish and manage your own events.
                            </p>
                        </div>
                    </Link>
                )}

                {/* ORGANIZER ACTIONS */}
                {user?.role === "ORGANIZER" && (
                    <Link
                        to="/organizer/events"
                        className="dashboard-action-card"
                    >
                        <div className="dashboard-card-icon">
                            <Ticket size={22} />
                        </div>

                        <div>
                            <h3>Manage my events</h3>

                            <p>
                                Create, edit and manage your event listings.
                            </p>
                        </div>
                    </Link>
                )}

                {/* ADMIN ACTIONS */}
                {user?.role === "ADMIN" && (
                    <>
                        <Link
                            to="/admin/organizers"
                            className="dashboard-action-card"
                        >
                            <div className="dashboard-card-icon">
                                <ShieldCheck size={22} />
                            </div>

                            <div>
                                <h3>Manage organizer applications</h3>

                                <p>
                                    Approve or reject organizer applications.
                                </p>
                            </div>
                        </Link>

                    </>
                )}

                {/* COMMON DASHBOARD CARDS */}
                <div className="dashboard-cards">

                    <div className="dashboard-card">
                        <div className="dashboard-card-icon">
                            <Ticket size={22} />
                        </div>

                        <h3>My Bookings</h3>

                        <p>
                            View your ticket reservations and booking history.
                        </p>

                        <Link to="/my-bookings">
                            View my bookings →
                        </Link>
                    </div>

                    <div className="dashboard-card">
                        <div className="dashboard-card-icon">
                            <CalendarDays size={22} />
                        </div>

                        <h3>Discover Events</h3>

                        <p>
                            Explore upcoming concerts, festivals and experiences.
                        </p>

                        <Link to="/#events">
                            Explore events →
                        </Link>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default Dashboard;
