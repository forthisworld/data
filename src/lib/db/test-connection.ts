/**
 * Test script for MongoDB connection
 * Run with: npm run db:test
 */

import { testConnection } from './mongodb';

testConnection()
    .then(() => {
        console.log('Connection test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Connection test failed:', error);
        process.exit(1);
    });
