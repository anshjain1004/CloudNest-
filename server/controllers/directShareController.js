import { sql } from "../config/db.js";
import { getSignedFileUrl } from "../utils/s3Helper.js";

const getClientIp = (req) => {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || null;
};

// Record that a specific user accessed an item shared directly with them
const logDirectAccess = async (itemShare, req, { accessReason = "direct_view", success = true } = {}) => {
    try {
        await sql`
            INSERT INTO activity_log (
                action, user_id, file_id, folder_id, ip_address, user_agent,
                success, access_reason, item_share_id,
                resource_type, resource_id, viewer_name, viewer_email
            )
            VALUES (
                'share_access', ${req.user?.id || null},
                ${itemShare.resource_type === "file" ? itemShare.resource_id : null},
                ${itemShare.resource_type === "folder" ? itemShare.resource_id : null},
                ${getClientIp(req)}, ${req.get?.("user-agent") || null},
                ${success}, ${accessReason}, ${itemShare.id},
                ${itemShare.resource_type}, ${itemShare.resource_id},
                ${req.user?.name || null}, ${req.user?.email || null}
            )
        `;
    } catch (err) {
        console.debug("Direct share access log error:", err.message);
    }
};

// Share an item directly with a registered user (by email)
// POST /api/shares/direct
export const createDirectShare = async (req, res) => {
    try {
        const resourceType = req.body.resource_type ?? req.body.resourceType;
        const resourceId = req.body.resource_id ?? req.body.resourceId;
        const email = (req.body.email || "").toLowerCase().trim();
        const permission = req.body.permission === "view" ? "view" : "download";

        if (!["file", "folder"].includes(resourceType)) {
            return res.status(400).json({ error: "Resource type must be file or folder." });
        }

        if (!email) {
            return res.status(400).json({ error: "Recipient email is required." });
        }

        const [recipient] = await sql`SELECT id, name, email FROM users WHERE email = ${email}`;

        if (!recipient) {
            return res.status(404).json({
                error: "No account found with this email. They need to register first.",
            });
        }

        if (recipient.id === req.user.id) {
            return res.status(400).json({ error: "You cannot share an item with yourself." });
        }

        // Verify resource exists and belongs to the current user
        const [resource] =
            resourceType === "file"
                ? await sql`SELECT id FROM files WHERE id = ${resourceId} AND owner_id = ${req.user.id} AND is_trashed = false`
                : await sql`SELECT id FROM folders WHERE id = ${resourceId} AND owner_id = ${req.user.id} AND is_trashed = false`;

        if (!resource) {
            return res.status(404).json({ error: `${resourceType} not found.` });
        }

        const [share] = await sql`
            INSERT INTO item_shares (resource_type, resource_id, owner_id, shared_with_id, permission)
            VALUES (${resourceType}, ${resource.id}, ${req.user.id}, ${recipient.id}, ${permission})
            ON CONFLICT (resource_type, resource_id, shared_with_id)
            DO UPDATE SET permission = ${permission}, updated_at = NOW()
            RETURNING *
        `;

        return res.status(201).json({ share, recipient });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// List items the current user has shared directly with other people
// GET /api/shares/direct
export const getDirectShares = async (req, res) => {
    try {
        const resourceType = req.query.resource_type;
        const resourceId = req.query.resource_id;

        const shares = await sql`
            SELECT ish.*,
                CASE
                    WHEN ish.resource_type = 'file' THEN json_build_object('id', f.id, 'name', f.name, 'mime_type', f.mime_type, 'size', f.size)
                    WHEN ish.resource_type = 'folder' THEN json_build_object('id', fo.id, 'name', fo.name)
                END AS resource,
                json_build_object('id', r.id, 'name', r.name, 'email', r.email) AS recipient,
                COALESCE(stats.views, 0) AS view_count,
                COALESCE(stats.downloads, 0) AS download_count,
                stats.last_accessed
            FROM item_shares ish
            JOIN users r ON r.id = ish.shared_with_id
            LEFT JOIN files f ON ish.resource_type = 'file' AND f.id = ish.resource_id AND f.is_trashed = false
            LEFT JOIN folders pf ON f.folder_id = pf.id
            LEFT JOIN folders fo ON ish.resource_type = 'folder' AND fo.id = ish.resource_id AND fo.is_trashed = false
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(CASE WHEN al.access_reason = 'direct_view' AND al.success THEN 1 END)::int AS views,
                    COUNT(CASE WHEN al.access_reason = 'direct_download' AND al.success THEN 1 END)::int AS downloads,
                    MAX(al.created_at) AS last_accessed
                FROM activity_log al
                WHERE al.item_share_id = ish.id
            ) stats ON true
            WHERE ish.owner_id = ${req.user.id}
              AND (${resourceType || null}::text IS NULL OR ish.resource_type = ${resourceType || null})
              AND (${resourceId || null}::uuid IS NULL OR ish.resource_id = ${resourceId || null})
              AND (
                (ish.resource_type = 'file' AND f.id IS NOT NULL AND (f.folder_id IS NULL OR pf.is_trashed = false))
                OR
                (ish.resource_type = 'folder' AND fo.id IS NOT NULL)
              )
            ORDER BY ish.created_at DESC
        `;

        return res.status(200).json({ direct_shares: shares });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Revoke a direct share
// DELETE /api/shares/direct/:id
export const deleteDirectShare = async (req, res) => {
    try {
        const [share] = await sql`
            DELETE FROM item_shares
            WHERE id = ${req.params.id} AND owner_id = ${req.user.id}
            RETURNING id
        `;

        if (!share) {
            return res.status(404).json({ error: "Shared access not found." });
        }

        return res.status(200).json({ message: "Access revoked successfully." });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// List items other people shared directly with the current user
// GET /api/shares/shared-with-me
export const getSharedWithMe = async (req, res) => {
    try {
        const shares = await sql`
            SELECT ish.*,
                CASE
                    WHEN ish.resource_type = 'file' THEN json_build_object('id', f.id, 'name', f.name, 'mime_type', f.mime_type, 'size', f.size, 's3_key', f.s3_key)
                    WHEN ish.resource_type = 'folder' THEN json_build_object('id', fo.id, 'name', fo.name)
                END AS resource,
                json_build_object('id', o.id, 'name', o.name, 'email', o.email) AS owner_info
            FROM item_shares ish
            JOIN users o ON o.id = ish.owner_id
            LEFT JOIN files f ON ish.resource_type = 'file' AND f.id = ish.resource_id AND f.is_trashed = false
            LEFT JOIN folders pf ON f.folder_id = pf.id
            LEFT JOIN folders fo ON ish.resource_type = 'folder' AND fo.id = ish.resource_id AND fo.is_trashed = false
            WHERE ish.shared_with_id = ${req.user.id}
              AND (
                (ish.resource_type = 'file' AND f.id IS NOT NULL AND (f.folder_id IS NULL OR pf.is_trashed = false))
                OR
                (ish.resource_type = 'folder' AND fo.id IS NOT NULL)
              )
            ORDER BY ish.created_at DESC
        `;

        const items = [];

        for (const share of shares) {
            if (share.resource_type === "file") {
                items.push({
                    ...share,
                    url: share.permission === "download" ? await getSignedFileUrl(share.resource.s3_key) : null,
                });
            } else {
                const [files, subfolders] = await Promise.all([
                    sql`SELECT * FROM files WHERE folder_id = ${share.resource_id} AND is_trashed = false ORDER BY name`,
                    sql`SELECT id, name, parent_id FROM folders WHERE parent_id = ${share.resource_id} AND is_trashed = false ORDER BY name`,
                ]);

                items.push({
                    ...share,
                    files: share.permission === "download"
                        ? await Promise.all(files.map(async (f) => ({ ...f, url: await getSignedFileUrl(f.s3_key) })))
                        : files.map((f) => ({ ...f, url: null })),
                    subfolders,
                });
            }

            await logDirectAccess(share, req, { accessReason: "direct_view" });
        }

        return res.status(200).json({ items });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Open/download an item shared directly with the current user
// POST /api/shares/direct/:id/open
export const openDirectShare = async (req, res) => {
    try {
        const [share] = await sql`
            SELECT * FROM item_shares
            WHERE id = ${req.params.id} AND shared_with_id = ${req.user.id}
        `;

        if (!share) {
            return res.status(404).json({ error: "This item is not shared with you." });
        }

        if (share.resource_type === "file") {
            const [file] = await sql`SELECT * FROM files WHERE id = ${share.resource_id}`;

            if (!file || file.is_trashed) {
                await logDirectAccess(share, req, { accessReason: "resource_unavailable", success: false });
                return res.status(404).json({ error: "File is no longer available." });
            }

            if (share.permission !== "download") {
                return res.status(403).json({ error: "This share only allows viewing, not downloading." });
            }

            const url = await getSignedFileUrl(file.s3_key);
            await logDirectAccess(share, req, { accessReason: "direct_download" });

            return res.status(200).json({ resource_type: "file", file, url });
        }

        const [folder] = await sql`SELECT * FROM folders WHERE id = ${share.resource_id}`;

        if (!folder || folder.is_trashed) {
            await logDirectAccess(share, req, { accessReason: "resource_unavailable", success: false });
            return res.status(404).json({ error: "Folder is no longer available." });
        }

        const files = await sql`SELECT * FROM files WHERE folder_id = ${folder.id} AND is_trashed = false ORDER BY name`;
        const filesWithUrls = share.permission === "download"
            ? await Promise.all(files.map(async (f) => ({ ...f, url: await getSignedFileUrl(f.s3_key) })))
            : files.map((f) => ({ ...f, url: null }));

        await logDirectAccess(share, req, {
            accessReason: share.permission === "download" ? "direct_download" : "direct_view",
        });

        return res.status(200).json({
            resource_type: "folder",
            folder,
            files: filesWithUrls,
            permission: share.permission,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// Access history for one direct share (owner only)
// GET /api/shares/direct/:id/access-history
export const getDirectShareAccessHistory = async (req, res) => {
    try {
        const [share] = await sql`
            SELECT ish.*, u.name AS recipient_name, u.email AS recipient_email
            FROM item_shares ish
            JOIN users u ON u.id = ish.shared_with_id
            WHERE ish.id = ${req.params.id} AND ish.owner_id = ${req.user.id}
        `;

        if (!share) {
            return res.status(404).json({ error: "Shared access not found." });
        }

        const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;

        const history = await sql`
            SELECT al.*, u.name AS user_name, u.email AS user_email,
                   f.name AS file_name, fo.name AS folder_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN files f ON al.resource_type = 'file' AND f.id = al.resource_id
            LEFT JOIN folders fo ON al.resource_type = 'folder' AND fo.id = al.resource_id
            WHERE al.action = 'share_access'
              AND al.item_share_id = ${share.id}
            ORDER BY al.created_at DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `;

        const [summary] = await sql`
            SELECT
                COUNT(*)::int AS total_accesses,
                COUNT(CASE WHEN access_reason = 'direct_download' AND success THEN 1 END)::int AS downloads,
                COUNT(CASE WHEN access_reason = 'direct_view' AND success THEN 1 END)::int AS views,
                COUNT(CASE WHEN success = false THEN 1 END)::int AS failed_attempts,
                COUNT(DISTINCT COALESCE(user_id::text, viewer_email, 'anonymous'))::int AS unique_viewers,
                MAX(created_at) AS last_accessed
            FROM activity_log
            WHERE action = 'share_access' AND item_share_id = ${share.id}
        `;

        return res.status(200).json({
            share_id: share.id,
            recipient: { id: share.shared_with_id, name: share.recipient_name, email: share.recipient_email },
            summary,
            history,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalItems: summary.total_accesses,
                totalPages: Math.ceil(summary.total_accesses / limitNum),
            },
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
