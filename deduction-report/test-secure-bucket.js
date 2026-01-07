#!/usr/bin/env node

/**
 * Test the secure bucket creation module
 * This creates a test bucket to verify the security settings
 */

import { createPrivateBucket } from './src/create-private-bucket.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSecureBucket() {
    try {
        console.log('Testing secure bucket creation...\n');

        const result = await createPrivateBucket({
            bucketName: 'test-secure-bucket-' + Date.now(),
            region: process.env.WASABI_REGION || 'us-west-1',
            endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-west-1.wasabisys.com',
            credentials: {
                accessKeyId: process.env.WASABI_ACCESS_KEY,
                secretAccessKey: process.env.WASABI_SECRET_KEY,
            },
            folders: ['test-folder/'],
        });

        console.log('\n✅ Test successful!');
        console.log('Result:', result);

        console.log('\n⚠️  NOTE: This created a test bucket. You may want to delete it manually.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testSecureBucket();
