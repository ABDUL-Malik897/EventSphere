import mongoose from "mongoose";

import User from "../models/User.js";
import Event from "../models/Event.js";
import OrganizerApplication from "../models/OrganizerApplication.js";

// GET ALL ORGANIZER APPLICATIONS
export const getOrganizerApplications = async (req, res) => {
    try {
        const allowedStatuses = [
            "pending",
            "approved",
            "rejected"
        ];

        const status = req.query.status || "pending";

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid application status."
            });
        }

        const applications = await OrganizerApplication.find({
            status
        })
            .populate("user", "name email role")
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            total: applications.length,
            applications
        });

    } catch (error) {
        console.error("Admin application listing error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve applications."
        });
    }
};

// APPROVE APPLICATION
export const approveOrganizer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid application ID."
            });
        }

        const application = await OrganizerApplication.findById(id);

        if (!application || application.status !== "pending") {
            return res.status(404).json({
                success: false,
                message: "Pending application not found."
            });
        }

        const user = await User.findById(application.user);

        if (!user || !user.isActive || user.role !== "ATTENDEE") {
            return res.status(409).json({
                success: false,
                message: "Applicant account is unavailable or has an incompatible role."
            });
        }

        // Upgrade user role only after admin approval.
        user.role = "ORGANIZER";
        await user.save();

        application.status = "approved";
        application.rejectionReason = "";
        application.reviewedBy = req.user._id;
        application.reviewedAt = new Date();

        await application.save();

        res.status(200).json({
            success: true,
            message: "Organizer application approved.",
            application
        });

    } catch (error) {
        console.error("Organizer approval error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to approve application."
        });
    }
};

// REJECT APPLICATION
export const rejectOrganizer = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid application ID."
            });
        }

        const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

        if (!reason || reason.length < 5 || reason.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Please provide a rejection reason between 5 and 500 characters."
            });
        }

        const application = await OrganizerApplication.findById(id);

        if (!application || application.status !== "pending") {
            return res.status(404).json({
                success: false,
                message: "Pending application not found."
            });
        }

        application.status = "rejected";
        application.rejectionReason = reason;
        application.reviewedBy = req.user._id;
        application.reviewedAt = new Date();

        await application.save();

        res.status(200).json({
            success: true,
            message: "Organizer application rejected.",
            application
        });

    } catch (error) {
        console.error("Organizer rejection error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to reject application."
        });
    }
};

// GET EVENTS WAITING FOR APPROVAL
export const getPendingEvents = async (req, res) => {
    try {
        const events = await Event.find({
            status: "pending_review"
        })
            .populate("organizer", "name email")
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            total: events.length,
            events
        });

    } catch (error) {
        console.error("Get pending events error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve pending events."
        });
    }
};

// APPROVE EVENT
export const approveEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID."
            });
        }

        const event = await Event.findOne({
            _id: id,
            status: "pending_review"
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Pending event not found."
            });
        }

        event.status = "published";
        event.rejectionReason = "";
        event.publishedAt = new Date();

        await event.save();

        res.status(200).json({
            success: true,
            message: "Event approved and published!",
            event
        });

    } catch (error) {
        console.error("Approve event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to approve event."
        });
    }
};

// REJECT EVENT
export const rejectEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID."
            });
        }

        const reason =
            typeof req.body?.reason === "string"
                ? req.body.reason.trim()
                : "";

        if (reason.length < 5 || reason.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason must be between 5 and 500 characters."
            });
        }

        const event = await Event.findOne({
            _id: id,
            status: "pending_review"
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Pending event not found."
            });
        }

        event.status = "rejected";
        event.rejectionReason = reason;
        event.publishedAt = null;

        await event.save();

        res.status(200).json({
            success: true,
            message: "Event rejected.",
            event
        });

    } catch (error) {
        console.error("Reject event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to reject event."
        });
    }
};