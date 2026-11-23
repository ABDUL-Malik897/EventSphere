import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import User from "../models/User.js";

const createAdmin = async () => {
    let exitCode = 0;

    try {
        const name = process.env.ADMIN_NAME;
        const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
        const password = process.env.ADMIN_PASSWORD;

        if (!name || !email || !password) {
            throw new Error(
                "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required."
            );
        }

        if (password.length < 12 || password.length > 72) {
            throw new Error(
                "Administrator password must contain 12–72 characters."
            );
        }

        await connectDB();

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            if (existingUser.role === "ADMIN") {
                console.log("This administrator account already exists.");
                return;
            }

            throw new Error(
                "This email already belongs to a non-admin account. Choose a separate administrator email."
            );
        }

        const admin = await User.create({
            name,
            email,
            password,
            role: "ADMIN"
        });

        console.log("Administrator created successfully!");
        console.log(`Email: ${admin.email}`);
        console.log(`Role: ${admin.role}`);

    } catch (error) {
        console.error("Admin creation failed:", error.message);
        exitCode = 1;
    } finally {
        await mongoose.disconnect();
        process.exitCode = exitCode;
    }
};

createAdmin();