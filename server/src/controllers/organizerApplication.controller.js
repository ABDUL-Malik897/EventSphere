
import { z } from "zod";
import OrganizerApplication from "../models/OrganizerApplication.js";

const applicationSchema = z.object({
    organizationName: z.string().trim().min(2).max(100),

    organizationType: z.enum([
        "Individual",
        "Company",
        "Non-profit",
        "Educational Institution",
        "Community"
    ]),

    description: z.string().trim().min(30).max(1500),

    website: z.union([
        z.string().url(),
        z.literal("")
    ]).optional().default(""),

    contactPhone: z.string().trim().min(7).max(20),

    experience: z.string().max(1000).optional().default("")
}).strict();

// SUBMIT ORGANIZER APPLICATION
export const submitApplication = async (req, res) => {
    try {
        if (req.user.role !== "ATTENDEE") {
            return res.status(403).json({
                success: false,
                message: "Only attendees can apply to become organizers."
            });
        }

        const validation = applicationSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid application details.",
                errors: validation.error.issues
            });
        }

        let application = await OrganizerApplication.findOne({
            user: req.user._id
        });

        if (
            application &&
            ["pending", "approved"].includes(application.status)
        ) {
            return res.status(409).json({
                success: false,
                message: "An active or approved application already exists.",
                application
            });
        }

        if (application) {
            // Allow rejected applications to be submitted again.
            application.set({
                ...validation.data,
                status: "pending",
                rejectionReason: "",
                reviewedBy: null,
                reviewedAt: null
            });

            await application.save();
        } else {
            application = await OrganizerApplication.create({
                ...validation.data,
                user: req.user._id
            });
        }

        res.status(201).json({
            success: true,
            message: "Organizer application submitted successfully!",
            application
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "An organizer application already exists."
            });
        }

        console.error("Organizer application error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to submit organizer application."
        });
    }
};

// GET CURRENT USER APPLICATION
export const getMyApplication = async (req, res) => {
    try {
        const application = await OrganizerApplication.findOne({
            user: req.user._id
        }).lean();

        res.status(200).json({
            success: true,
            application
        });

    } catch (error) {
        console.error("Get application error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve application."
        });
    }
};
