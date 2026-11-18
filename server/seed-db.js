
import { sql } from "./config/db.js";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

// Configuration
const NUMBER_OF_USERS = 100;
const PASSWORD = "test12345";

async function seedDatabase() {
    try {
        console.log(`🌱 Starting database seeding... generating ${NUMBER_OF_USERS} users`);

        // Hash password once because all users share the same test password
        const passwordHash = await bcrypt.hash(PASSWORD, 10);

        // Store all created file records for activity logging
        const fileRecords = [];

        // 1. Create 100 users
        for (let i = 0; i < NUMBER_OF_USERS; i++) {

            const name = faker.person.fullName();
            const email = `user${i}@cloudnest.com`;

            const storageLimit = 1073741824; // 1 GB

            await sql`
                INSERT INTO users (
                    name,
                    email,
                    password,
                    storage_used,
                    storage_limit,
                    created_at
                )
                VALUES (
                    ${name},
                    ${email},
                    ${passwordHash},
                    0,
                    ${storageLimit},
                    NOW()
                )
                ON CONFLICT (email) DO NOTHING
            `;
        }

        console.log(`✅ Created/verified ${NUMBER_OF_USERS} users`);


        // 2. Get all seeded users
        const users = await sql`
            SELECT id, email
            FROM users
            WHERE email LIKE 'user%@cloudnest.com'
            ORDER BY email
            LIMIT ${NUMBER_OF_USERS}
        `;

        if (users.length === 0) {
            throw new Error("No users found. Database seeding failed.");
        }


        // 3. Create folders and files for each user
        for (const user of users) {

            const ownerId = user.id;

            // Create 1-3 folders per user
            const folderCount = faker.number.int({
                min: 1,
                max: 3
            });

            const folderIds = [];

            let totalStorageUsed = 0;


            for (let f = 0; f < folderCount; f++) {

                const folderName = faker.system.fileName();

                const [folder] = await sql`
                    INSERT INTO folders (
                        name,
                        owner_id,
                        path,
                        is_trashed,
                        created_at
                    )
                    VALUES (
                        ${folderName},
                        ${ownerId},
                        '{}'::uuid[],
                        false,
                        NOW()
                    )
                    RETURNING id
                `;

                folderIds.push(folder.id);


                // Create 2-5 files per folder
                const fileCount = faker.number.int({
                    min: 2,
                    max: 5
                });


                for (let fi = 0; fi < fileCount; fi++) {

                    const fileName = faker.system.fileName();

                    const fileSize = faker.number.int({
                        min: 1024,
                        max: 10 * 1024 * 1024
                    });

                    const mimeType = faker.system.mimeType();

                    // Generate unique storage key
                    const s3Key = `seed/${ownerId}/${faker.string.uuid()}`;

                    const [file] = await sql`
                        INSERT INTO files (
                            name,
                            original_name,
                            mime_type,
                            size,
                            s3_key,
                            folder_id,
                            owner_id,
                            is_trashed,
                            created_at
                        )
                        VALUES (
                            ${fileName},
                            ${fileName},
                            ${mimeType},
                            ${fileSize},
                            ${s3Key},
                            ${folder.id},
                            ${ownerId},
                            false,
                            NOW()
                        )
                        RETURNING id
                    `;

                    totalStorageUsed += fileSize;

                    // Store actual file ID and its owner
                    fileRecords.push({
                        id: file.id,
                        ownerId,
                        folderId: folder.id
                    });
                }
            }


            // Update user's actual storage usage
            await sql`
                UPDATE users
                SET storage_used = ${totalStorageUsed}
                WHERE id = ${ownerId}
            `;


            // 4. Create 1-2 share links per user
            const shareCount = faker.number.int({
                min: 1,
                max: 2
            });


            for (let s = 0; s < shareCount; s++) {

                const resourceId = faker.helpers.arrayElement(folderIds);

                const permission = faker.helpers.arrayElement([
                    "download",
                    "view"
                ]);

                const expiresAt = faker.date.future();

                await sql`
                    INSERT INTO share_links (
                        token,
                        resource_type,
                        resource_id,
                        owner_id,
                        permission,
                        expires_at,
                        created_at
                    )
                    VALUES (
                        ${faker.string.uuid()},
                        'folder',
                        ${resourceId},
                        ${ownerId},
                        ${permission},
                        ${expiresAt},
                        NOW()
                    )
                    ON CONFLICT (resource_id, owner_id) DO NOTHING
                `;
            }
        }

        console.log("📁 Created folders, files, and share links");


        // 5. Create 500 activity logs
        const actions = [
            "upload",
            "view",
            "download",
            "share",
            "delete"
        ];

        if (fileRecords.length === 0) {
            throw new Error("No files found for activity log generation.");
        }


        for (let a = 0; a < 500; a++) {

            // Pick an actual file record
            const randomFile = faker.helpers.arrayElement(fileRecords);

            const randomAction = faker.helpers.arrayElement(actions);

            const success = faker.datatype.boolean();

            const ipAddress = faker.internet.ip();

            const userAgent = faker.internet.userAgent();


            await sql`
                INSERT INTO activity_log (
                    action,
                    user_id,
                    file_id,
                    folder_id,
                    ip_address,
                    user_agent,
                    success,
                    created_at
                )
                VALUES (
                    ${randomAction},
                    ${randomFile.ownerId},
                    ${randomFile.id},
                    ${randomFile.folderId},
                    ${ipAddress},
                    ${userAgent},
                    ${success},
                    NOW()
                )
            `;
        }

        console.log("📊 Created 500 activity log entries");


        // 6. Final summary
        console.log("\n🎉 Database seeding complete!");

        console.log(`   - ${users.length} users`);
        console.log("   - Folders and files created");
        console.log("   - Share links created");
        console.log("   - 500 activity log entries");
        console.log("   - Storage usage updated");


        process.exit(0);

    } catch (error) {

        console.error("❌ Seeding error:", error);

        process.exit(1);
    }
}


// Execute seeding
seedDatabase();