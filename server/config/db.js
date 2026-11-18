
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

// Check database connection string
if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is missing. Please check your server/.env file."
    );
}

export const sql = neon(process.env.DATABASE_URL);


export async function initDB() {
    try {

        await sql.transaction([

            // Users table
            sql`
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    storage_used BIGINT NOT NULL DEFAULT 0,
                    storage_limit BIGINT NOT NULL DEFAULT 1073741824,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,

            // Folders table
            sql`
                CREATE TABLE IF NOT EXISTS folders (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    parent_id UUID REFERENCES folders(id) ON DELETE SET NULL DEFAULT NULL,
                    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    path UUID[] NOT NULL DEFAULT '{}'::uuid[],
                    is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
                    trashed_at TIMESTAMPTZ DEFAULT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,

            // Files table
            sql`
                CREATE TABLE IF NOT EXISTS files (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(255) NOT NULL,
                    original_name VARCHAR(255) NOT NULL,
                    mime_type VARCHAR(128) NOT NULL,
                    size BIGINT NOT NULL,
                    s3_key VARCHAR(512) UNIQUE NOT NULL,
                    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL DEFAULT NULL,
                    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    is_trashed BOOLEAN NOT NULL DEFAULT FALSE,
                    trashed_at TIMESTAMPTZ DEFAULT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,

            // Share links table
            sql`
                CREATE TABLE IF NOT EXISTS share_links (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    token VARCHAR(64) UNIQUE NOT NULL,
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id UUID NOT NULL,
                    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    permission VARCHAR(20) NOT NULL DEFAULT 'download',
                    expires_at TIMESTAMPTZ DEFAULT NULL,
                    access_count INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT unique_resource_owner UNIQUE (resource_id, owner_id)
                )
            `,

            // Folder indexes
            sql`CREATE INDEX IF NOT EXISTS idx_folders_owner_parent ON folders (owner_id, parent_id, is_trashed)`,
            sql`CREATE INDEX IF NOT EXISTS idx_folders_owner_trashed ON folders (owner_id, is_trashed)`,
            sql`CREATE INDEX IF NOT EXISTS idx_folders_path ON folders USING GIN (path)`,

            // File indexes
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_folder ON files (owner_id, folder_id, is_trashed)`,
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_trashed_date ON files (owner_id, is_trashed, created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_files_owner_trashed_name ON files (owner_id, is_trashed, name)`,

            // Share indexes
            sql`CREATE INDEX IF NOT EXISTS idx_shares_owner ON share_links (owner_id, created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_shares_resource ON share_links (resource_id)`,

            // Direct shares (item shared with a specific registered user by email)
            sql`
                CREATE TABLE IF NOT EXISTS item_shares (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    resource_type VARCHAR(20) NOT NULL,
                    resource_id UUID NOT NULL,
                    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    shared_with_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    permission VARCHAR(20) NOT NULL DEFAULT 'download',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT unique_item_share UNIQUE (resource_type, resource_id, shared_with_id)
                )
            `,
            sql`CREATE INDEX IF NOT EXISTS idx_item_shares_recipient ON item_shares (shared_with_id, created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_item_shares_owner ON item_shares (owner_id, created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_item_shares_resource ON item_shares (resource_type, resource_id)`,

            // Activity log table
            sql`
                CREATE TABLE IF NOT EXISTS activity_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    action VARCHAR(50) NOT NULL,
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    file_id UUID REFERENCES files(id) ON DELETE SET NULL,
                    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    success BOOLEAN NOT NULL DEFAULT TRUE,
                    access_reason VARCHAR(255),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `,

            // Share access tracking columns (safe to run on existing databases)
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS share_link_id UUID REFERENCES share_links(id) ON DELETE SET NULL`,
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS share_token VARCHAR(64)`,
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS resource_type VARCHAR(20)`,
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS resource_id UUID`,
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS viewer_name VARCHAR(255)`,
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS viewer_email VARCHAR(255)`,
            sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS item_share_id UUID REFERENCES item_shares(id) ON DELETE SET NULL`,

            // Activity indexes
            sql`CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log (user_id)`,
            sql`CREATE INDEX IF NOT EXISTS idx_activity_file ON activity_log (file_id)`,
            sql`CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log (action)`,
            sql`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at DESC)`,
            sql`CREATE INDEX IF NOT EXISTS idx_activity_share_link ON activity_log (share_link_id)`,
            sql`CREATE INDEX IF NOT EXISTS idx_activity_resource ON activity_log (resource_type, resource_id)`,
            sql`CREATE INDEX IF NOT EXISTS idx_activity_item_share ON activity_log (item_share_id)`


        ]);

        console.log("Database initialized successfully!");

    } catch (error) {

        console.error("Database initialization failed:", error);
        throw error;

    }
}
