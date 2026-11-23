import emailjs from "@emailjs/nodejs";

export const sendEmail = async (templateParams) => {
    const {
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        EMAILJS_PUBLIC_KEY,
        EMAILJS_PRIVATE_KEY
    } = process.env;

    const missing = [
        ["EMAILJS_SERVICE_ID", EMAILJS_SERVICE_ID],
        ["EMAILJS_TEMPLATE_ID", EMAILJS_TEMPLATE_ID],
        ["EMAILJS_PUBLIC_KEY", EMAILJS_PUBLIC_KEY],
        ["EMAILJS_PRIVATE_KEY", EMAILJS_PRIVATE_KEY]
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length) {
        throw new Error(
            `EmailJS configuration missing: ${missing.join(", ")}`
        );
    }

    return emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        {
            publicKey: EMAILJS_PUBLIC_KEY,
            privateKey: EMAILJS_PRIVATE_KEY
        }
    );
};