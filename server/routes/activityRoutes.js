import express from "express";
import { logActivity, getActivityLogs, getActivityStats } from "../controllers/activityController.js";
import { protect } from "../middleware/auth.js";

const activityRouter = express.Router();

// Activity records are private - only authenticated users may read or write them
activityRouter.use(protect);

// Log a new activity event
// POST /api/activity/log
activityRouter.post("/log", logActivity);

// Get activity logs with filtering and pagination
// GET /api/activity/logs
activityRouter.get("/logs", getActivityLogs);

// Get activity statistics/analytics
// GET /api/activity/stats
activityRouter.get("/stats", getActivityStats);

// DEBUG: Test route
activityRouter.get("/test", (req, res) => res.json({ msg: "activity routes work!" }));

export default activityRouter;