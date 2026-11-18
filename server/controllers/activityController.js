import { sql } from "../config/db.js";
import { logActivity as logActivityService } from "../services/storageService.js";

// Log a new activity event
// POST /api/activity/log
export const logActivity = async (req, res) => {
  try {
    const { action, fileId, folderId, userId } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required." });
    }

    // Determine user ID from req.user if not provided
    const userIdValue = userId || req.user?.id || null;

    // Determine IP and user agent from request
    const ipAddress = req.ip || req.connection?.remoteAddress || undefined;
    const userAgent = req.get("user-agent") || undefined;

    await logActivityService(action, userIdValue, fileId, folderId, {
      ip: ipAddress,
      get: (header) => req.get(header),
    });

    return res.status(201).json({ message: "Activity logged successfully." });
  } catch (error) {
    console.error("Activity log error:", error.message);
    return res.status(500).json({ error: "Failed to log activity." });
  }
};

// Get activity logs with filtering and pagination
// GET /api/activity/logs
export const getActivityLogs = async (req, res) => {
  try {
    const {
      action,
      user_id,
      file_id,
      folder_id,
      start_date,
      end_date,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE conditions dynamically
    const whereConditions = [];

    if (action) {
      whereConditions.push(`action = ${action}`);
    }

    if (user_id) {
      whereConditions.push(`user_id = ${user_id}`);
    }

    if (file_id) {
      whereConditions.push(`file_id = ${file_id}`);
    }

    if (folder_id) {
      whereConditions.push(`folder_id = ${folder_id}`);
    }

    if (start_date) {
      whereConditions.push(`created_at >= ${start_date}`);
    }

    if (end_date) {
      whereConditions.push(`created_at <= ${end_date}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Fetch activity logs with pagination
    const [rows] = await sql`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      ${sql.raw(whereClause)}
      ORDER BY al.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    // Get total count
    const [countRows] = await sql`
      SELECT COUNT(*)::int AS total FROM activity_log al ${sql.raw(whereClause)}
    `;

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      activities: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Get activity logs error:", error.message);
    return res.status(500).json({ error: "Failed to fetch activity logs." });
  }
};

// Get activity statistics/analytics
// GET /api/activity/stats
export const getActivityStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Build date filter
    const dateFilter = start_date || end_date
      ? `WHERE created_at ${start_date ? ">=" : ""} ${start_date || ""} ${end_date ? "<=" : ""} ${end_date || ""}`
      : "";

    // Get overall statistics
    const stats = await sql`
      SELECT 
        COUNT(*)::int AS total_activities,
        COUNT(DISTINCT action)::int AS unique_actions,
        COUNT(DISTINCT al.user_id)::int AS unique_users,
        COUNT(DISTINCT al.file_id)::int AS unique_files,
        COUNT(DISTINCT CASE WHEN al.success THEN al.user_id END)::int AS unique_viewers
      FROM activity_log al ${sql.raw(dateFilter ? "WHERE" : "")} ${dateFilter || ""}
    `;

    // Get activity counts by type
    const actionStats = await sql`
      SELECT action, COUNT(*)::int AS count
      FROM activity_log
      ${sql.raw(dateFilter ? "WHERE" : "")} ${dateFilter || ""}
      GROUP BY action
      ORDER BY count DESC
    `;

    // Get daily activity trend
    const dailyStats = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*)::int AS count
      FROM activity_log
      ${sql.raw(dateFilter ? "WHERE" : "")} ${dateFilter || ""}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    // Get top viewed files
    const topFiles = await sql`
      SELECT f.id, f.name, f.original_name, COUNT(al.id)::int AS view_count
      FROM activity_log al
      JOIN files f ON al.file_id = f.id AND al.success = true
      ${sql.raw(dateFilter ? "WHERE" : "")} ${dateFilter || ""} AND al.file_id IS NOT NULL
      GROUP BY f.id, f.name, f.original_name
      ORDER BY view_count DESC
      LIMIT 10
    `;

    // Get recent unauthorized access attempts
    const failedAccess = await sql`
      SELECT al.*, u.name as user_name, u.email as user_email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.success = false
      ${sql.raw(dateFilter ? "WHERE" : "")} ${dateFilter || ""}
      ORDER BY al.created_at DESC
      LIMIT 10
    `;

    return res.status(200).json({
      overall: stats[0],
      by_action: actionStats,
      daily_trend: dailyStats,
      top_files: topFiles,
      failed_access: failedAccess,
    });
  } catch (error) {
    console.error("Get activity stats error:", error.message);
    return res.status(500).json({ error: "Failed to fetch activity statistics." });
  }
};