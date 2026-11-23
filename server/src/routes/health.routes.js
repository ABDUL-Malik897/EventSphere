import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "EventSphere API is running!",
        timestamp: new Date()
    });
});

export default router;