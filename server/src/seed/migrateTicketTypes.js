import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Event from "../models/Event.js";

const migrateTicketTypes = async () => {
    try {
        await connectDB();

        const events = await Event.find({
            status: "published"
        });

        let migrated = 0;

        for (const event of events) {
            if (!event.ticketTypes || event.ticketTypes.length === 0) {

                event.ticketTypes = [
                    {
                        name: "General Admission",
                        description: "Standard event entry.",
                        price: event.price,
                        quantity: 100,
                        sold: 0
                    }
                ];

                event.capacity = 100;

                await event.save();

                migrated++;

                console.log(`Migrated: ${event.title}`);
            }
        }

        console.log("\nTicket migration completed!");
        console.log(`Total events checked: ${events.length}`);
        console.log(`Events migrated: ${migrated}`);

    } catch (error) {
        console.error("Ticket migration failed:", error.message);
        process.exitCode = 1;

    } finally {
        await mongoose.disconnect();
    }
};

migrateTicketTypes();