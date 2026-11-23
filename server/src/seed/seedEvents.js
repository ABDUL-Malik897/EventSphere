import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Event from "../models/Event.js";

const events = [
    {
        title: "Neon Nights Music Festival",
        slug: "neon-nights-music-festival",
        description:
            "Experience an unforgettable evening of live music, incredible performances, lights and an energetic crowd.",
        category: "Music",
        date: new Date("2026-12-06T19:00:00+05:30"),
        time: "7:00 PM onwards",
        venue: "Janeshwar Mishra Park",
        city: "Lucknow",
        price: 799,
        imageUrl:
            "https://images.unsplash.com/photo-1506157786151-b8491531f063?w=1000&q=85",
        tag: "Trending",
        status: "published"
    },
    {
        title: "Future Tech Summit 2026",
        slug: "future-tech-summit-2026",
        description:
            "Meet technology enthusiasts and industry professionals. Discover AI, cloud computing and the future of technology.",
        category: "Technology",
        date: new Date("2026-12-12T10:00:00+05:30"),
        time: "10:00 AM onwards",
        venue: "Indira Gandhi Pratishthan",
        city: "Lucknow",
        price: 499,
        imageUrl:
            "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&q=85",
        tag: "Popular",
        status: "published"
    },
    {
        title: "The Grand Food Carnival",
        slug: "grand-food-carnival",
        description:
            "Explore delicious street food, international cuisines, live cooking stations and special food experiences.",
        category: "Food & Drink",
        date: new Date("2026-12-14T12:00:00+05:30"),
        time: "12:00 PM onwards",
        venue: "Riverside Mall",
        city: "Lucknow",
        price: 299,
        imageUrl:
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1000&q=85",
        tag: "New",
        status: "published"
    },
    {
        title: "Colours of Creativity",
        slug: "colours-of-creativity",
        description:
            "An artistic evening featuring paintings, creative workshops, live performances and independent artists.",
        category: "Arts",
        date: new Date("2026-12-18T16:00:00+05:30"),
        time: "4:00 PM onwards",
        venue: "City Art Gallery",
        city: "Delhi",
        price: 350,
        imageUrl:
            "https://images.unsplash.com/photo-1531058020387-3be344556be6?w=1000&q=85",
        tag: "Limited seats",
        status: "published"
    },
    {
        title: "Champions Sports Arena",
        slug: "champions-sports-arena",
        description:
            "Enjoy an exciting sporting experience with live action, passionate supporters and a thrilling atmosphere.",
        category: "Sports",
        date: new Date("2026-12-20T17:30:00+05:30"),
        time: "5:30 PM onwards",
        venue: "Ekana Sports City",
        city: "Lucknow",
        price: 599,
        imageUrl:
            "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1000&q=85",
        tag: "Popular",
        status: "published"
    },
    {
        title: "Midnight Music Experience",
        slug: "midnight-music-experience",
        description:
            "An immersive electronic music experience featuring talented DJs, spectacular visuals and incredible sound.",
        category: "Music",
        date: new Date("2026-12-27T20:00:00+05:30"),
        time: "8:00 PM onwards",
        venue: "The Dome",
        city: "Mumbai",
        price: 999,
        imageUrl:
            "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1000&q=85",
        tag: "Trending",
        status: "published"
    }
];

const seedEvents = async () => {
    try {
        await connectDB();

        const operations = events.map((event) => ({
            updateOne: {
                filter: { slug: event.slug },
                update: { $set: event },
                upsert: true
            }
        }));

        const result = await Event.bulkWrite(operations);

        console.log("Event seeding completed!");
        console.log(`Inserted: ${result.upsertedCount}`);
        console.log(`Updated: ${result.modifiedCount}`);
    } catch (error) {
        console.error("Event seeding failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

seedEvents();