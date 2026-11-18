import { sql } from "../config/db.js";
import crypto from "crypto";
import { getSignedFileUrl } from "../utils/s3Helper.js";

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getClientIp = (req) => {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || null;
};

// Create or retrieve public share link for file or folder
// POST /api/shares
export const createShareLink = async (req, res) => {
    try {
        const resourceType = req.body.resource_type ?? req.body.resourceType;
        const resourceId = req.body.resource_id ?? req.body.resourceId;
        const { permission = "download", expires_at, expiresAt } = req.body;

        const targetExpiresAt = expires_at ?? expiresAt;

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({ error: "Resource type must be file or folder." });
        }

        // Verify resource exists and belongs to user
        const [resource] =
            resourceType === "file"
                ? await sql`
            SELECT id FROM files
            WHERE id = ${resourceId} AND owner_id = ${req.user.id} AND is_trashed = false`
                : await sql`
            SELECT id FROM folders
            WHERE id = ${resourceId} AND owner_id = ${req.user.id} AND is_trashed = false
            `;

        if (!resource) {
            return res.status(404).json({ error: `${resourceType} not found.` });
        }

        // Check for an existing share link for this resource
        const [existing] = await sql`
             SELECT * FROM share_links
             WHERE resource_type = ${resourceType}
               AND resource_id = ${resource.id}
               AND owner_id = ${req.user.id}`;

        // If expired, remove it
        if (existing && existing.expires_at && new Date() > new Date(existing.expires_at)) {
            await sql`DELETE FROM share_links WHERE id = ${existing.id}`;
        } else if (existing) {
            return res.status(200).json({ share_link: existing, is_existing: true });
        }

        const token = crypto.randomBytes(16).toString("hex");
        const [shareLink] = await sql`
             INSERT INTO share_links (token, resource_type, resource_id, owner_id, permission, expires_at)
            VALUES (${token}, ${resourceType}, ${resource.id}, ${req.user.id}, ${permission}, ${targetExpiresAt ? new Date(targetExpiresAt) : null})
            RETURNING *
             `;

        return res.status(201).json({ share_link: shareLink, is_existing: false });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Get user's share links with resource details and access stats
// GET /api/shares
export const getUserShareLinks = async (req, res) => {
    try {
        const activeShareLinks = await sql`
        SELECT sl.*,
            CASE
                WHEN sl.resource_type = 'file' THEN json_build_object('id', f.id, 'name', f.name, 'mime_type', f.mime_type, 'size', f.size)
                WHEN sl.resource_type = 'folder' THEN json_build_object('id', fo.id, 'name', fo.name)
              END AS resource,
            COALESCE(stats.views, 0) AS view_count,
            COALESCE(stats.downloads, 0) AS download_count,
            stats.last_accessed
          FROM share_links sl
          LEFT JOIN files f ON sl.resource_type = 'file' AND f.id = sl.resource_id AND f.is_trashed = false
          LEFT JOIN folders pf ON f.folder_id = pf.id
          LEFT JOIN folders fo ON sl.resource_type = 'folder' AND fo.id = sl.resource_id AND fo.is_trashed = false
          LEFT JOIN LATERAL (
              SELECT
                  COUNT(CASE WHEN al.access_reason = 'shared_link_view' AND al.success THEN 1 END)::int AS views,
                  COUNT(CASE WHEN al.access_reason = 'shared_link_download' AND al.success THEN 1 END)::int AS downloads,
                  MAX(al.created_at) AS last_accessed
              FROM activity_log al
              WHERE al.share_link_id = sl.id
          ) stats ON true
        WHERE sl.owner_id = ${req.user.id}
        AND (
            (sl.resource_type = 'file' AND f.id IS NOT NULL AND (f.folder_id IS NULL OR pf.is_trashed = false))
            OR
            (sl.resource_type = 'folder' AND fo.id IS NOT NULL)
        )
        ORDER BY sl.created_at DESC
        `;

        return res.status(200).json({ share_links: activeShareLinks });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Access shared item by token (public link for anyone)
// GET /api/shares/access/:token
export const accessShareLink = async (req, res) => {
    try {
        const { token } = req.params;

        const [shareLink] = await sql`SELECT * FROM share_links WHERE token = ${token}`;

        if (!shareLink) {
            return res.status(404).json({ error: "Share link not found or has been revoked." });
        }

        // Check expiration
        if (shareLink.expires_at && new Date() > new Date(shareLink.expires_at)) {
            await logShareAccess(shareLink, req, {
                success: false,
                accessReason: "share_link_expired",
            });
            return res.status(410).json({ error: "This share link has expired." });
        }

        // Fetch owner info
        const [owner] = await sql`SELECT id, name, email FROM users WHERE id = ${shareLink.owner_id}`;

        if (shareLink.resource_type === "file") {
            const [file] = await sql`SELECT * FROM files WHERE id = ${shareLink.resource_id}`;

            if (!file || file.is_trashed) {
                await logShareAccess(shareLink, req, {
                    success: false,
                    accessReason: "resource_unavailable",
                });
                return res.status(404).json({ error: "File is no longer available." });
            }

            if (file.folder_id) {
                const [parentFolder] = await sql`SELECT is_trashed FROM folders WHERE id = ${file.folder_id}`;
                if (!parentFolder || parentFolder.is_trashed) {
                    await logShareAccess(shareLink, req, {
                        success: false,
                        accessReason: "resource_unavailable",
                    });
                    return res.status(404).json({ error: "File is no longer available." });
                }
            }

            const isDownload = shareLink.permission === "download";
            const downloadUrl = await getSignedFileUrl(file.s3_key);

            // Increment access count atomically and record who accessed it
            await sql`UPDATE share_links SET access_count = access_count + 1, updated_at = NOW() WHERE id = ${shareLink.id}`;
            await logShareAccess(shareLink, req, {
                success: true,
                accessReason: isDownload ? "shared_link_download" : "shared_link_view",
            });

            return res.status(200).json({
                resource_type: "file",
                file,
                url: downloadUrl,
                permission: shareLink.permission,
                is_download: isDownload,
                owner,
            });
        }

        // Folder resource
        const [folder] = await sql`SELECT * FROM folders WHERE id = ${shareLink.resource_id}`;
        if (!folder || folder.is_trashed) {
            await logShareAccess(shareLink, req, {
                success: false,
                accessReason: "resource_unavailable",
            });
            return res.status(404).json({ error: "Folder is no longer available." });
        }

        const [subfolders, files] = await Promise.all([
            sql`SELECT id, name, parent_id, created_at FROM folders WHERE parent_id = ${folder.id} AND is_trashed = false`,
            sql`SELECT * FROM files WHERE folder_id = ${folder.id} AND is_trashed = false`,
        ]);

        const filesWithUrls = await Promise.all(
            files.map(async (f) => ({
                ...f,
                url: await getSignedFileUrl(f.s3_key),
            }))
        );

        const isDownload = shareLink.permission === "download";

        await sql`UPDATE share_links SET access_count = access_count + 1, updated_at = NOW() WHERE id = ${shareLink.id}`;
        await logShareAccess(shareLink, req, {
            success: true,
            accessReason: isDownload ? "shared_link_download" : "shared_link_view",
        });

        return res.status(200).json({
            resource_type: "folder",
            folder,
            subfolders,
            files: filesWithUrls,
            permission: shareLink.permission,
            is_download: isDownload,
            owner,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Revoke/delete share link
// DELETE /api/shares/:id
export const deleteShareLink = async (req, res) => {
    try {
        const [shareLink] = await sql`
        DELETE FROM share_links
        WHERE id = ${req.params.id} AND owner_id = ${req.user.id}
        RETURNING id`;

        if (!shareLink) {
            return res.status(404).json({ error: "Share link not found." });
        }

        return res.status(200).json({ message: "Share link revoked successfully." });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Record who accessed a shared resource (logged-in user, or anonymous with IP/UA)
export const logShareAccess = async (shareLink, req, { success = true, accessReason }) => {
    try {
        const ipAddress = getClientIp(req);
        const userAgent = req.get?.("user-agent") || null;
        const userId = req.user?.id || null;
        const viewerName = req.user?.name || req.body?.viewer_name || null;
        const viewerEmail = req.user?.email || req.body?.viewer_email || null;

        await sql`
            INSERT INTO activity_log (
                action, user_id, file_id, folder_id, ip_address, user_agent,
                success, access_reason, share_link_id, share_token,
                resource_type, resource_id, viewer_name, viewer_email
            )
            VALUES (
                'share_access', ${userId},
                ${shareLink.resource_type === "file" ? shareLink.resource_id : null},
                ${shareLink.resource_type === "folder" ? shareLink.resource_id : null},
                ${ipAddress}, ${userAgent}, ${success}, ${accessReason},
                ${shareLink.id}, ${shareLink.token},
                ${shareLink.resource_type}, ${shareLink.resource_id},
                ${viewerName}, ${viewerEmail}
            )
        `;
    } catch (err) {
        // Silently fail - activity logging should not break main flow
        console.debug("Share access log error:", err.message);
    }
};

// Get sharing analytics for the logged-in owner
// GET /api/shares/analytics
export const getShareAnalytics = async (req, res) => {
    try {
        const start = parseDate(req.query.start_date);
        const end = parseDate(req.query.end_date);

        const [stats] = await sql`
          SELECT
            COUNT(*)::int AS total_accesses,
            COUNT(DISTINCT al.share_link_id)::int AS unique_links,
            COUNT(DISTINCT COALESCE(al.user_id::text, al.viewer_email, al.ip_address, 'anonymous'))::int AS unique_viewers,
            COUNT(CASE WHEN al.access_reason = 'shared_link_download' AND al.success THEN 1 END)::int AS downloads,
            COUNT(CASE WHEN al.access_reason = 'shared_link_view' AND al.success THEN 1 END)::int AS views,
            COUNT(CASE WHEN al.success = false THEN 1 END)::int AS failed_attempts
          FROM activity_log al
          JOIN share_links sl ON sl.id = al.share_link_id
          WHERE al.action = 'share_access'
            AND sl.owner_id = ${req.user.id}
            AND (${start}::timestamptz IS NULL OR al.created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR al.created_at <= ${end}::timestamptz)
        `;

        const byResource = await sql`
          SELECT
            al.resource_type,
            COUNT(*)::int AS access_count,
            COUNT(DISTINCT al.resource_id)::int AS unique_resources,
            COUNT(CASE WHEN al.access_reason = 'shared_link_download' AND al.success THEN 1 END)::int AS downloads,
            COUNT(CASE WHEN al.access_reason = 'shared_link_view' AND al.success THEN 1 END)::int AS views
          FROM activity_log al
          JOIN share_links sl ON sl.id = al.share_link_id
          WHERE al.action = 'share_access'
            AND sl.owner_id = ${req.user.id}
            AND (${start}::timestamptz IS NULL OR al.created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR al.created_at <= ${end}::timestamptz)
          GROUP BY al.resource_type
        `;

        const topFiles = await sql`
          SELECT
            f.id, f.name, f.original_name,
            COUNT(al.id)::int AS access_count,
            COUNT(CASE WHEN al.access_reason = 'shared_link_download' AND al.success THEN 1 END)::int AS download_count
          FROM activity_log al
          JOIN share_links sl ON sl.id = al.share_link_id
          JOIN files f ON f.id = al.resource_id
          WHERE al.action = 'share_access'
            AND al.resource_type = 'file'
            AND sl.owner_id = ${req.user.id}
            AND (${start}::timestamptz IS NULL OR al.created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR al.created_at <= ${end}::timestamptz)
          GROUP BY f.id, f.name, f.original_name
          ORDER BY access_count DESC
          LIMIT 10
        `;

        const recentAccesses = await sql`
          SELECT al.*, sl.token,
                 u.name AS user_name, u.email AS user_email,
                 f.name AS file_name, fo.name AS folder_name
          FROM activity_log al
          JOIN share_links sl ON sl.id = al.share_link_id
          LEFT JOIN users u ON al.user_id = u.id
          LEFT JOIN files f ON al.resource_type = 'file' AND f.id = al.resource_id
          LEFT JOIN folders fo ON al.resource_type = 'folder' AND fo.id = al.resource_id
          WHERE al.action = 'share_access'
            AND sl.owner_id = ${req.user.id}
            AND (${start}::timestamptz IS NULL OR al.created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR al.created_at <= ${end}::timestamptz)
          ORDER BY al.created_at DESC
          LIMIT 20
        `;

        const byPermission = await sql`
          SELECT
            al.access_reason,
            COUNT(*)::int AS count,
            COUNT(DISTINCT COALESCE(al.user_id::text, al.viewer_email, al.ip_address, 'anonymous'))::int AS unique_users
          FROM activity_log al
          JOIN share_links sl ON sl.id = al.share_link_id
          WHERE al.action = 'share_access'
            AND sl.owner_id = ${req.user.id}
            AND (${start}::timestamptz IS NULL OR al.created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR al.created_at <= ${end}::timestamptz)
          GROUP BY al.access_reason
          ORDER BY count DESC
        `;

        return res.status(200).json({
            overall: stats,
            by_resource: byResource,
            top_files: topFiles,
            recent_accesses: recentAccesses,
            by_permission: byPermission,
        });
    } catch (error) {
        console.error("Get share analytics error:", error.message);
        return res.status(500).json({ error: "Failed to fetch share analytics." });
    }
};

// Get access history for a specific share link (protected - requires auth)
// GET /api/shares/:id/access-history
export const getShareAccessHistory = async (req, res) => {
    try {
        const shareId = req.params.id;
        const start = parseDate(req.query.start_date);
        const end = parseDate(req.query.end_date);

        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;

        // Only the owner may read the access history
        const [shareLink] = await sql`
          SELECT id, token, resource_type, resource_id, permission, expires_at
          FROM share_links
          WHERE id = ${shareId} AND owner_id = ${req.user.id}
        `;

        if (!shareLink) {
            return res.status(404).json({ error: "Share link not found." });
        }

        const history = await sql`
          SELECT al.*,
                 u.name AS user_name, u.email AS user_email,
                 f.name AS file_name, fo.name AS folder_name
          FROM activity_log al
          LEFT JOIN users u ON al.user_id = u.id
          LEFT JOIN files f ON al.resource_type = 'file' AND f.id = al.resource_id
          LEFT JOIN folders fo ON al.resource_type = 'folder' AND fo.id = al.resource_id
          WHERE al.action = 'share_access'
            AND al.share_link_id = ${shareLink.id}
            AND (${start}::timestamptz IS NULL OR al.created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR al.created_at <= ${end}::timestamptz)
          ORDER BY al.created_at DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `;

        const [summary] = await sql`
          SELECT
            COUNT(*)::int AS total_accesses,
            COUNT(CASE WHEN access_reason = 'shared_link_download' AND success THEN 1 END)::int AS downloads,
            COUNT(CASE WHEN access_reason = 'shared_link_view' AND success THEN 1 END)::int AS views,
            COUNT(CASE WHEN success = false THEN 1 END)::int AS failed_attempts,
            COUNT(DISTINCT COALESCE(user_id::text, viewer_email, ip_address, 'anonymous'))::int AS unique_viewers,
            MAX(created_at) AS last_accessed
          FROM activity_log
          WHERE action = 'share_access'
            AND share_link_id = ${shareLink.id}
            AND (${start}::timestamptz IS NULL OR created_at >= ${start}::timestamptz)
            AND (${end}::timestamptz IS NULL OR created_at <= ${end}::timestamptz)
        `;

        const total = summary.total_accesses;
        const totalPages = Math.ceil(total / limitNum);

        return res.status(200).json({
            share_id: shareId,
            share_link: shareLink,
            summary,
            history,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalItems: total,
                totalPages,
            },
        });
    } catch (error) {
        console.error("Get share access history error:", error.message);
        return res.status(500).json({ error: "Failed to fetch share access history." });
    }
};
