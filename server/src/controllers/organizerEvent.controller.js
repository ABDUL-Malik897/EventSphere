
import mongoose from "mongoose";
import { randomBytes } from "crypto";
import { z } from "zod";

import Event from "../models/Event.js";

const categories = [
    "Music",
    "Technology",
    "Food & Drink",
    "Arts",
    "Sports",
    "Business",
    "Education",
    "Other"
];

const ticketSchema = z.object({
    _id: z.string().optional(),

    name: z.string().trim().min(2).max(50),

    description: z.string().max(250).optional().default(""),

    price: z.coerce.number().min(0).max(10000000),

    quantity: z.coerce.number().int().min(1).max(1000000)
}).strict();

const eventSchema = z.object({
    title: z.string().trim().min(5).max(120),

    description: z.string().trim().min(30).max(3000),

    category: z.enum(categories),

    date: z.coerce.date(),

    time: z.string().trim().min(3).max(50),

    venue: z.string().trim().min(2).max(150),

    city: z.string().trim().min(2).max(80),

    imageUrl: z.string().url(),

    tag: z.string().trim().max(30).optional().default("New"),

    ticketTypes: z.array(ticketSchema).min(1).max(8)
}).strict();

const validateEvent = (body) => {
    const result = eventSchema.safeParse(body);

    if (!result.success) {
        return {
            valid: false,
            errors: result.error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message
            }))
        };
    }

    if (result.data.date <= new Date()) {
        return {
            valid: false,
            errors: [{ field: "date", message: "Event date must be in the future." }]
        };
    }

    return {
        valid: true,
        data: result.data
    };
};

const createSlug = (title) => {
    const base = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return `${base}-${randomBytes(3).toString("hex")}`;
};

const getTicketSummary = (ticketTypes) => ({
    capacity: ticketTypes.reduce(
        (sum, ticket) => sum + ticket.quantity,
        0
    ),

    price: Math.min(
        ...ticketTypes.map((ticket) => ticket.price)
    )
});

// CREATE EVENT
export const createOrganizerEvent = async (req, res) => {
    try {
        const validation = validateEvent(req.body);

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: "Invalid event details.",
                errors: validation.errors
            });
        }

        const data = validation.data;

        const summary = getTicketSummary(data.ticketTypes);

        const event = await Event.create({
            ...data,

            slug: createSlug(data.title),

            organizer: req.user._id,

            price: summary.price,
            capacity: summary.capacity,

            status: "pending_review",
            publishedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: "Event submitted for administrator review.",
            event
        });

    } catch (error) {
        console.error("Create event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create event."
        });
    }
};

// GET ORGANIZER'S EVENTS
export const getMyEvents = async (req, res) => {
    try {
        const events = await Event.find({
            organizer: req.user._id
        })
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            total: events.length,
            events
        });

    } catch (error) {
        console.error("Get organizer events error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve your events."
        });
    }
};

// GET SINGLE ORGANIZER EVENT
export const getMyEventById = async (req, res) => {
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
            organizer: req.user._id
        }).lean();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found."
            });
        }

        res.status(200).json({
            success: true,
            event
        });

    } catch (error) {
        console.error("Get event details error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve event."
        });
    }
};

// UPDATE EVENT
export const updateOrganizerEvent = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID."
            });
        }

        const validation = validateEvent(req.body);

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: "Invalid event details.",
                errors: validation.errors
            });
        }

        const event = await Event.findOne({
            _id: id,
            organizer: req.user._id
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found."
            });
        }

        if (["cancelled"].includes(event.status)) {
            return res.status(400).json({
                success: false,
                message: "Cancelled events cannot be edited."
            });
        }

        const data = validation.data;
        const oldTickets = event.ticketTypes;

        // Preserve ticket IDs and already-sold quantities.
        const updatedTickets = [];
        const usedIds = new Set();

        for (const newTicket of data.ticketTypes) {
            let existingTicket = null;

            if (newTicket._id) {
                if (!mongoose.isValidObjectId(newTicket._id)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid ticket category ID."
                    });
                }

                existingTicket = oldTickets.find(
                    (ticket) => ticket._id.toString() === newTicket._id
                );

                if (!existingTicket || usedIds.has(newTicket._id)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid or duplicate ticket category."
                    });
                }

                usedIds.add(newTicket._id);

                if (newTicket.quantity < existingTicket.sold) {
                    return res.status(400).json({
                        success: false,
                        message: `Quantity for ${newTicket.name} cannot be lower than tickets already sold.`
                    });
                }
            }

            updatedTickets.push({
                ...(existingTicket
                    ? { _id: existingTicket._id }
                    : {}),
                name: newTicket.name,
                description: newTicket.description,
                price: newTicket.price,
                quantity: newTicket.quantity,
                sold: existingTicket?.sold || 0
            });
        }

        // Don't allow removal of a category with existing sales.
        const removedSoldTicket = oldTickets.some(
            (ticket) =>
                ticket.sold > 0 &&
                !usedIds.has(ticket._id.toString())
        );

        if (removedSoldTicket) {
            return res.status(400).json({
                success: false,
                message: "Ticket categories with existing sales cannot be removed."
            });
        }

        const summary = getTicketSummary(updatedTickets);

        event.set({
            ...data,
            ticketTypes: updatedTickets,
            price: summary.price,
            capacity: summary.capacity,
            status: "published",
            rejectionReason: "",
            publishedAt: event.publishedAt || new Date()
        });

        await event.save();

        res.status(200).json({
            success: true,
            message: "Event updated and resubmitted for review.",
            event
        });

    } catch (error) {
        console.error("Update event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to update event."
        });
    }
};

// DELETE UNPUBLISHED EVENT
export const deleteOrganizerEvent = async (req, res) => {
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
            organizer: req.user._id
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found."
            });
        }

        if (!["draft", "pending_review", "rejected"].includes(event.status)) {
            return res.status(400).json({
                success: false,
                message: "Only unpublished events can be deleted."
            });
        }

        await event.deleteOne();

        res.status(200).json({
            success: true,
            message: "Event deleted successfully."
        });

    } catch (error) {
        console.error("Delete event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to delete event."
        });
    }
};

// CANCEL PUBLISHED EVENT
export const cancelOrganizerEvent = async (req, res) => {
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
            organizer: req.user._id
        });

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found."
            });
        }

        if (event.status !== "published") {
            return res.status(400).json({
                success: false,
                message: "Only published events can be cancelled."
            });
        }

        event.status = "cancelled";

        await event.save();

        res.status(200).json({
            success: true,
            message: "Event cancelled successfully."
        });

    } catch (error) {
        console.error("Cancel event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to cancel event."
        });
    }
};
