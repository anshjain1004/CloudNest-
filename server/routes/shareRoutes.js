import express from "express";
import { accessShareLink, createShareLink, deleteShareLink, getUserShareLinks, getShareAnalytics, getShareAccessHistory } from "../controllers/shareController.js";
import { protect, optionalAuth } from "../middleware/auth.js";
import {
    createDirectShare,
    getDirectShares,
    deleteDirectShare,
    getSharedWithMe,
    openDirectShare,
    getDirectShareAccessHistory,
} from "../controllers/directShareController.js";

const shareRouter = express.Router()

// Public link access (anyone with the link). optionalAuth identifies logged-in
// visitors so their access is recorded with their account details.
shareRouter.get("/access/:token", optionalAuth, accessShareLink)

// Protected share management endpoints
shareRouter.use(protect)

shareRouter.post("/", createShareLink)
shareRouter.get("/", getUserShareLinks)

// Direct sharing with a specific registered user
shareRouter.post("/direct", createDirectShare)
shareRouter.get("/direct", getDirectShares)
shareRouter.get("/shared-with-me", getSharedWithMe)
shareRouter.post("/direct/:id/open", openDirectShare)
shareRouter.get("/direct/:id/access-history", getDirectShareAccessHistory)
shareRouter.delete("/direct/:id", deleteDirectShare)

shareRouter.delete("/:id", deleteShareLink)

// Sharing analytics endpoint (protected - requires auth)
shareRouter.get("/analytics", getShareAnalytics)

// Access history for a specific share link (protected - requires auth)
// GET /api/shares/:id/access-history
shareRouter.get("/:id/access-history", getShareAccessHistory)

export default shareRouter