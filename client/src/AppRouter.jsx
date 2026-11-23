import { Routes, Route } from "react-router-dom";

import App from "./App";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import OrganizerApply from "./pages/OrganizerApply";
import AdminOrganizerApplications from "./pages/AdminOrganizerApplications";
import OrganizerEvents from "./pages/OrganizerEvents";
import EventForm from "./pages/EventForm";
import MyBookings from "./pages/MyBookings";
import PaymentSuccess from "./pages/PaymentSuccess";
import EventDetails from "./pages/EventDetails";
import Cart from "./pages/Cart";
import CheckoutStatus from "./pages/CheckoutStatus";
import MyAdmissionPasses from "./pages/MyAdmissionPasses";
import OrganizerCheckIn from "./pages/OrganizerCheckIn";
import ProtectedRoute from "./components/ProtectedRoute";
import AdmissionPassDetails from "./pages/AdmissionPassDetails";




function AppRouter() {
    return (
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/organizer/apply"
                element={
                    <ProtectedRoute allowedRoles={["ATTENDEE"]}>
                        <OrganizerApply />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/admin/organizers"
                element={
                    <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <AdminOrganizerApplications />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/organizer/events"
                element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                        <OrganizerEvents />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/organizer/events/new"
                element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                        <EventForm />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/organizer/events/:id/edit"
                element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                        <EventForm />
                    </ProtectedRoute>
                }
            />


            <Route
                path="/my-bookings"
                element={
                    <ProtectedRoute>
                        <MyBookings />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/payment/success/:bookingId"
                element={
                    <ProtectedRoute>
                        <PaymentSuccess />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/events/:id"
                element={<EventDetails />}
            />

            <Route
                path="/cart"
                element={
                    <ProtectedRoute allowedRoles={["ATTENDEE", "ORGANIZER"]}>
                        <Cart />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/checkout/:id"
                element={
                    <ProtectedRoute allowedRoles={["ATTENDEE", "ORGANIZER"]}>
                        <CheckoutStatus />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/my-passes"
                element={
                    <ProtectedRoute allowedRoles={["ATTENDEE", "ORGANIZER"]}>
                        <MyAdmissionPasses />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/my-passes/:passId"
                element={
                    <ProtectedRoute allowedRoles={["ATTENDEE", "ORGANIZER"]}>
                        <AdmissionPassDetails />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/checkin/:token"
                element={
                    <ProtectedRoute allowedRoles={["ORGANIZER"]}>
                        <OrganizerCheckIn />
                    </ProtectedRoute>
                }
            />

            <Route
                path="*"
                element={<div className="auth-loading">404 - Page not found</div>}
            />
        </Routes>
    );
}

export default AppRouter;