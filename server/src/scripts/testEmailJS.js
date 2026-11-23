
import "../config/loadEnv.js";

const { sendEmail } = await import("../services/emailjs.service.js");

const recipient = process.env.EMAILJS_TEST_RECIPIENT;

if (!recipient) {
    throw new Error(
        "EMAILJS_TEST_RECIPIENT is missing from server/.env"
    );
}

try {
    console.log("Sending EventSphere test email...");

    const response = await sendEmail({
        to_email: recipient,
        to_name: "EventSphere Test User",
        event_title: "EventSphere Email Integration Test",
        event_date: "28 November 2026",
        event_time: "6:00 PM",
        venue: "Test Auditorium",
        city: "Lucknow",
        ticket_type: "General Admission",
        quantity: "2",
        booking_reference: "ES-EMAIL-TEST-001",
        passes_url: `${
            process.env.PUBLIC_APP_URL || "http://localhost:5173"
        }/my-passes`
    });

    console.log("EmailJS response:", response.status, response.text);
    console.log("Test email sent successfully.");
} catch (error) {
    console.error("EmailJS test failed:", error.text || error.message);
    process.exitCode = 1;
}
