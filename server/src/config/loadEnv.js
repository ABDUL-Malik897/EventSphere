import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// server/src/config -> server/
const serverRoot = path.resolve(currentDir, "../..");

const envPath = path.join(serverRoot, ".env");

const result = dotenv.config({
    path: envPath
});

if (result.error) {
    throw new Error(
        `Unable to load backend environment file: ${envPath}`
    );
}

if (!result.parsed) {
    throw new Error("Backend .env file is empty or could not be parsed.");
}

const requiredVariables = [
    "MONGODB_URI",
    "JWT_SECRET"
];

const missingVariables = requiredVariables.filter(
    (key) => !process.env[key]?.trim()
);

if (missingVariables.length > 0) {
    throw new Error(
        `Missing environment variables: ${missingVariables.join(", ")}`
    );
}

console.log("EventSphere backend environment loaded.");
console.log("Razorpay configured:", Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET
));