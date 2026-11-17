/**
 * MongoDB Connection Utility
 * 
 * This module provides a singleton MongoDB client for use in the application.
 * It uses connection caching to optimize for serverless/edge environments.
 * 
 * Environment Variables Required:
 * - MONGODB_URI: MongoDB connection string
 * - MONGODB_DB_NAME: Database name (default: 'forthisworld')
 */

import { MongoClient, ServerApiVersion, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'forthisworld';

const options = {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    // Connection Pool Settings
    maxPoolSize: 10, // Maximum connections in the pool
    minPoolSize: 2, // Minimum connections to maintain
    maxIdleTimeMS: 30000, // Close connections idle for 30 seconds
    waitQueueTimeoutMS: 5000, // Timeout for connection requests
    // Performance Settings
    retryWrites: true,
    retryReads: true,
};

// Global variable to cache the client promise across hot reloads in development
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

/**
 * Create and connect the client lazily on first use.
 * A failed connection resets the cached promise so later requests can retry,
 * and rejections are surfaced to callers instead of crashing the process
 * as an unhandledRejection.
 */
function connectClient(): Promise<MongoClient> {
    client = new MongoClient(uri, options);
    const promise = client.connect();
    // Prevent an unhandled rejection from killing the server; the original
    // error is still thrown to whoever awaits getClient()/getDatabase().
    promise.catch(() => {});
    return promise;
}

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
        globalWithMongo._mongoClientPromise = connectClient();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    clientPromise = connectClient();
}

/**
 * Get the database instance
 * @returns Promise<Db> - The MongoDB database instance
 */
export async function getDatabase(): Promise<Db> {
    try {
        const client = await getClient();
        return client.db(dbName);
    } catch (error) {
        resetConnection();
        throw error;
    }
}

/**
 * Get the MongoDB client
 * @returns Promise<MongoClient> - The MongoDB client instance
 */
export async function getClient(): Promise<MongoClient> {
    try {
        return await clientPromise;
    } catch (error) {
        resetConnection();
        throw error;
    }
}

/**
 * Discard the current connection attempt so the next request retries fresh.
 */
function resetConnection(): void {
    if (process.env.NODE_ENV === 'development') {
        const globalWithMongo = global as typeof globalThis & {
            _mongoClientPromise?: Promise<MongoClient>;
        };
        if (globalWithMongo._mongoClientPromise === clientPromise) {
            globalWithMongo._mongoClientPromise = undefined;
            clientPromise = connectClient();
        }
    } else {
        clientPromise = connectClient();
    }
}

/**
 * Test the database connection
 * Run with: npx tsx -e "import('./src/lib/db/mongodb.js').then(m => m.testConnection())"
 */
export async function testConnection(): Promise<void> {
    try {
        const client = await clientPromise;
        await client.db('admin').command({ ping: 1 });
        console.log('✅ Pinged your deployment. You successfully connected to MongoDB!');
    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        throw error;
    }
}

// Export the client promise for direct use if needed
export { clientPromise };
