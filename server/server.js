
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { initDB } from "./config/db.js";

import authRouter from "./routes/authRoutes.js";
import folderRouter from "./routes/folderRoutes.js";
import fileRouter from "./routes/fileRoutes.js";
import trashRouter from "./routes/trashRoutes.js";
import shareRouter from "./routes/shareRoutes.js";
import activityRouter from "./routes/activityRoutes.js";

const app = express();

// CORS Configuration
const allowedOrigins = (
    process.env.ORIGINS || "http://localhost:5176"
)
    .split(",")
    .map(origin => origin.trim());

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS blocked for origin: ${origin}`));
        }
    },
    credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: "100mb" }));

// Test Route
app.get("/", (_req, res) => {
    res.send("Server is Running");
});

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/folders", folderRouter);
app.use("/api/files", fileRouter);
app.use("/api/trash", trashRouter);
app.use("/api/shares", shareRouter);
app.use("/api/activity", activityRouter);

// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error("Server Error:", err);

    res.status(err.status || 500).json({
        error: err.message || "Something went wrong!"
    });
});

const port = process.env.PORT || 3000;

// Initialize Database and Start Server
initDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            console.log("Allowed Origins:", allowedOrigins);
        });
    })
    .catch((err) => {
        console.error("Failed to start server:", err);
        process.exit(1);
    });
