import jwt from "jsonwebtoken";
import { z } from "zod";

import User from "../models/User.js";

const COOKIE_NAME = "eventsphere_token";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
};

const createToken = (userId) => {
    return jwt.sign(
        { sub: userId.toString() },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
};

const setTokenCookie = (res, userId) => {
    const token = createToken(userId);

    res.cookie(COOKIE_NAME, token, cookieOptions);
};

const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
});

// REGISTER
export const register = async (req, res) => {
    try {
        const schema = z.object({
            name: z.string().trim().min(2).max(60),
            email: z.string().trim().email().max(254),
            password: z.string().min(8).max(72)
        }).strict();

        const result = schema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid registration details.",
                errors: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message
                }))
            });
        }

        const { name, email, password } = result.data;

        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        // Public registration always creates an ATTENDEE.
        // Never accept role information from the client.
        const user = await User.create({
            name,
            email,
            password
        });

        setTokenCookie(res, user._id);

        res.status(201).json({
            success: true,
            message: "Account created successfully!",
            user: publicUser(user)
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email address is already registered."
            });
        }

        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
};

// LOGIN
export const login = async (req, res) => {
    try {
        const schema = z.object({
            email: z.string().trim().email(),
            password: z.string().min(1).max(72)
        }).strict();

        const result = schema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid login details."
            });
        }

        const { email, password } = result.data;

        const user = await User.findOne({
            email: email.toLowerCase()
        }).select("+password");

        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const isPasswordCorrect =
            await user.comparePassword(password);

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        setTokenCookie(res, user._id);

        res.status(200).json({
            success: true,
            message: "Login successful!",
            user: publicUser(user)
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
};

// LOGOUT
export const logout = (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });

    res.status(200).json({
        success: true,
        message: "Logged out successfully."
    });
};

// CURRENT USER
export const getMe = (req, res) => {
    res.status(200).json({
        success: true,
        user: publicUser(req.user)
    });
};