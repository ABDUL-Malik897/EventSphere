import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Event from "../models/Event.js";
import User from "../models/User.js";

const publishExistingEvents = async () => {
    try {
        await connectDB();

        const organizerIds = await User.distinct("_id", {
            role: "ORGANIZER",
            isActive: true
        });

        if (organizerIds.length === 0) {
            console.log("No approved organizers found.");
            return;
        }

        const result = await Event.updateMany(
            {
                status: "pending_review",
                organizer: { $in: organizerIds }
            },
            {
                $set: {
                    status: "published",
                    publishedAt: new Date(),
                    rejectionReason: ""
                }
            }
        );

        console.log("Existing event migration completed.");
        console.log(`Events published: ${result.modifiedCount}`);

    } catch (error) {
        console.error("Event migration failed:", error.message);
        process.exitCode = 1;

    } finally {
        await mongoose.disconnect();
    }
};

publishExistingEvents();