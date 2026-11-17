/**
 * Database Seeding Script
 * 
 * This script seeds the MongoDB database with data from the local JSON files.
 * It's designed to be idempotent - safe to run multiple times.
 * 
 * Run with: npm run db:seed
 */

import { MongoClient, ServerApiVersion } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables for standalone execution
import { config } from 'dotenv';
config({ path: '.env.local' });

if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found. Please check your .env.local file.');
    process.exit(1);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'forthisworld';

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

interface SeedResult {
    collection: string;
    inserted: number;
    updated: number;
}

/**
 * Read JSON file from the data directory
 */
function readJsonFile(filePath: string): unknown {
    const fullPath = path.join(process.cwd(), 'data', filePath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ File not found: ${fullPath}`);
        return null;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
}

/**
 * Recursively read all JSON files in a directory
 */
function readJsonDirectory(dirPath: string): unknown[] {
    const fullPath = path.join(process.cwd(), 'data', dirPath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`⚠️ Directory not found: ${fullPath}`);
        return [];
    }

    const items: unknown[] = [];
    const files = fs.readdirSync(fullPath);

    for (const file of files) {
        const filePath = path.join(fullPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            items.push(...readJsonDirectory(path.join(dirPath, file)));
        } else if (file.endsWith('.json')) {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            const sourceFile = path.join(dirPath, file);

            // Handle arrays - spread into individual items
            if (Array.isArray(data)) {
                for (const item of data) {
                    if (typeof item === 'object' && item !== null) {
                        (item as Record<string, unknown>)._sourceFile = sourceFile;
                    }
                    items.push(item);
                }
            } else {
                // Add source file info for single objects
                if (typeof data === 'object' && data !== null) {
                    (data as Record<string, unknown>)._sourceFile = sourceFile;
                }
                items.push(data);
            }
        }
    }

    return items;
}

/**
 * Seed the countries collection with overview data
 */
async function seedCountries(db: ReturnType<MongoClient['db']>): Promise<SeedResult> {
    const collection = db.collection('countries');
    const result: SeedResult = { collection: 'countries', inserted: 0, updated: 0 };

    // Read overview.json for each country
    const countries = ['in']; // Add more country codes as needed

    for (const countryCode of countries) {
        const data = readJsonFile(`${countryCode}/overview.json`);
        if (data && typeof data === 'object') {
            const doc = data as Record<string, unknown>;
            doc.countryCode = countryCode;
            doc.updatedAt = new Date();

            const updateResult = await collection.updateOne(
                { countryCode },
                { $set: doc, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
            );

            if (updateResult.upsertedCount > 0) result.inserted++;
            else if (updateResult.modifiedCount > 0) result.updated++;
        }
    }

    console.log(`📊 Countries: ${result.inserted} inserted, ${result.updated} updated`);
    return result;
}

/**
 * Seed the info_requests collection
 */
async function seedInfoRequests(db: ReturnType<MongoClient['db']>): Promise<SeedResult> {
    const collection = db.collection('info_requests');
    const result: SeedResult = { collection: 'info_requests', inserted: 0, updated: 0 };

    const countries = ['in'];

    for (const countryCode of countries) {
        const data = readJsonFile(`${countryCode}/info-requests.json`) as Record<string, unknown> | null;
        if (!data) continue;

        // Store the entire info-requests document (config, requests, targets, stats)
        const doc = {
            ...data,
            countryCode,
            updatedAt: new Date(),
        };

        const updateResult = await collection.updateOne(
            { countryCode },
            { $set: doc, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );

        if (updateResult.upsertedCount > 0) result.inserted++;
        else if (updateResult.modifiedCount > 0) result.updated++;
    }

    console.log(`📋 Info Requests: ${result.inserted} inserted, ${result.updated} updated`);
    return result;
}

/**
 * Seed the entities collection (representatives, departments, etc.)
 */
async function seedEntities(db: ReturnType<MongoClient['db']>): Promise<SeedResult> {
    const collection = db.collection('entities');
    const result: SeedResult = { collection: 'entities', inserted: 0, updated: 0 };

    const countries = ['in'];

    for (const countryCode of countries) {
        const entities = readJsonDirectory(`${countryCode}/entities`);

        for (const entity of entities) {
            if (typeof entity !== 'object' || entity === null) continue;

            const doc = entity as Record<string, unknown>;
            doc.countryCode = countryCode;
            doc.updatedAt = new Date();

            // Use a combination of countryCode and entity id for uniqueness
            const entityId = doc.id || doc._sourceFile;

            const updateResult = await collection.updateOne(
                { countryCode, id: entityId },
                { $set: doc, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
            );

            if (updateResult.upsertedCount > 0) result.inserted++;
            else if (updateResult.modifiedCount > 0) result.updated++;
        }
    }

    console.log(`🏛️ Entities: ${result.inserted} inserted, ${result.updated} updated`);
    return result;
}

/**
 * Seed the regions collection (states, districts, etc.)
 * Merges region base data with overview data into single documents
 */
async function seedRegions(db: ReturnType<MongoClient['db']>): Promise<SeedResult> {
    const collection = db.collection('regions');
    const result: SeedResult = { collection: 'regions', inserted: 0, updated: 0 };

    const countries = ['in'];

    for (const countryCode of countries) {
        // Read states.json as the base region list
        const states = readJsonFile(`${countryCode}/regions/states.json`) as Array<Record<string, unknown>> | null;
        if (!states || !Array.isArray(states)) {
            console.warn(`⚠️ No states.json found for ${countryCode}`);
            continue;
        }

        for (const state of states) {
            if (typeof state !== 'object' || state === null) continue;

            const doc = { ...state } as Record<string, unknown>;
            const slug = doc.slug as string;

            if (!slug) {
                console.warn(`⚠️ Region missing slug:`, doc.name);
                continue;
            }

            // Try to load and merge overview data for this region
            const overview = readJsonFile(`${countryCode}/regions/${slug}/overview.json`) as Record<string, unknown> | null;
            if (overview && typeof overview === 'object') {
                // Merge overview fields into the region document
                if (overview.metrics) doc.metrics = overview.metrics;
                if (overview.highlights) doc.highlights = overview.highlights;
                if (overview.quickLinks) doc.quickLinks = overview.quickLinks;
                if (overview.entityId) doc.entityId = overview.entityId;
                if (overview.entityType) doc.entityType = overview.entityType;
            }

            doc.countryCode = countryCode;
            doc.updatedAt = new Date();

            // Use slug as the unique identifier (not _sourceFile or arbitrary id)
            const updateResult = await collection.updateOne(
                { countryCode, slug },
                { $set: doc, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
            );

            if (updateResult.upsertedCount > 0) result.inserted++;
            else if (updateResult.modifiedCount > 0) result.updated++;
        }
    }

    console.log(`🗺️ Regions: ${result.inserted} inserted, ${result.updated} updated`);
    return result;
}

/**
 * Seed the toll_roads collection
 */
async function seedTollRoads(db: ReturnType<MongoClient['db']>): Promise<SeedResult> {
    const collection = db.collection('toll_roads');
    const result: SeedResult = { collection: 'toll_roads', inserted: 0, updated: 0 };

    const countries = ['in'];

    for (const countryCode of countries) {
        const dirPath = path.join(process.cwd(), 'data', countryCode, 'toll-roads');
        if (!fs.existsSync(dirPath)) continue;

        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json') && !f.startsWith('_'));

        for (const file of files) {
            const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
            const road = JSON.parse(content) as Record<string, unknown>;
            if (!road.slug) continue;

            const doc = { ...road, countryCode, updatedAt: new Date() };
            const updateResult = await collection.updateOne(
                { countryCode, slug: road.slug },
                { $set: doc, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
            );

            if (updateResult.upsertedCount > 0) result.inserted++;
            else if (updateResult.modifiedCount > 0) result.updated++;
        }
    }

    console.log(`🛣️ Toll Roads: ${result.inserted} inserted, ${result.updated} updated`);
    return result;
}

/**
 * Main seed function
 */
async function seed(): Promise<void> {
    console.log('🌱 Starting database seed...\n');

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB\n');

        const db = client.db(dbName);

        // Seed all collections
        const results: SeedResult[] = [];
        results.push(await seedCountries(db));
        results.push(await seedInfoRequests(db));
        results.push(await seedEntities(db));
        results.push(await seedRegions(db));
        results.push(await seedTollRoads(db));

        // Summary
        console.log('\n📈 Seed Summary:');
        console.log('─'.repeat(40));
        const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
        const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
        console.log(`   Total inserted: ${totalInserted}`);
        console.log(`   Total updated:  ${totalUpdated}`);
        console.log('─'.repeat(40));
        console.log('\n✅ Database seeding complete!');

    } catch (error) {
        console.error('❌ Error during seeding:', error);
        throw error;
    } finally {
        await client.close();
    }
}

// Run the seed function
seed().catch(console.error);
