/**
 * Database Cleanup Script
 * 
 * Removes orphan documents that don't have a proper slug field.
 * Run with: npx tsx src/lib/db/cleanup.ts
 */

import { MongoClient, ServerApiVersion } from 'mongodb';
import { config } from 'dotenv';
config({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found.');
    process.exit(1);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'forthisworld';

async function cleanup() {
    const client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        },
    });

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');
        const db = client.db(dbName);

        // Delete region documents without a slug (orphan overview.json docs)
        const result1 = await db.collection('regions').deleteMany({
            slug: { $exists: false }
        });
        console.log(`🗑️ Deleted ${result1.deletedCount} orphan documents (no slug)`);

        // Also delete any with path-based IDs (containing backslash)
        const result2 = await db.collection('regions').deleteMany({
            id: { $regex: /\\\\/ }
        });
        console.log(`🗑️ Deleted ${result2.deletedCount} orphan documents (path-based id)`);

        // Count remaining regions
        const remaining = await db.collection('regions').countDocuments();
        console.log(`\n✅ ${remaining} valid region documents remaining`);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await client.close();
    }
}

cleanup().catch(console.error);
