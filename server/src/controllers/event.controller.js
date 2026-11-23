import mongoose from "mongoose";
import Event from "../models/Event.js";

// GET /api/events
export const getEvents = async (req, res) => {
    try {
        const {
            search = "",
            city,
            category,
            page = 1,
            limit = 12
        } = req.query;

        const currentPage = Math.max(1, Number(page) || 1);
        const pageLimit = Math.min(
            50,
            Math.max(1, Number(limit) || 12)
        );

        const filter = {
            status: "published",
            date: { $gte: new Date() }
        };

        if (city && city !== "All Cities") {
            filter.city = city;
        }

        if (category && category !== "All Events") {
            filter.category = category;
        }

        if (search.trim()) {
            const safeSearch = search.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

            filter.$or = [
                { title: { $regex: safeSearch, $options: "i" } },
                { venue: { $regex: safeSearch, $options: "i" } },
                { city: { $regex: safeSearch, $options: "i" } }
            ];
        }

        const total = await Event.countDocuments(filter);

        const events = await Event.find(filter)
            .sort({ date: 1 })
            .skip((currentPage - 1) * pageLimit)
            .limit(pageLimit)
            .lean();

        res.status(200).json({
            success: true,
            total,
            page: currentPage,
            pages: Math.ceil(total / pageLimit),
            data: events
        });

    } catch (error) {
        console.error("Get events error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch events."
        });
    }
};

// GET /api/events/:id
export const getEventById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid event ID."
            });
        }

        const event = await Event.findOne({
            _id: req.params.id,
            status: "published"
        }).lean();

        if (!event) {
            return res.status(404).json({
                success: false,
                message: "Event not found."
            });
        }

        res.status(200).json({
            success: true,
            data: event
        });

    } catch (error) {
        console.error("Get event error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to fetch event."
        });
    }
};