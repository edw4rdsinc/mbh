#!/usr/bin/env node

/**
 * SECURE Wasabi Bucket Setup
 *
 * This script creates a PRIVATE bucket using the secure createPrivateBucket module.
 * All new buckets should be created using this approach.
 */

import { createPrivateBucket } from './src/create-private-bucket.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupBucket() {
    try {
        await createPrivateBucket({
            bucketName: 'mbh-deduction-report',
            region: process.env.WASABI_REGION || 'us-west-1',
            endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-west-1.wasabisys.com',
            credentials: {
                accessKeyId: process.env.WASABI_ACCESS_KEY,
                secretAccessKey: process.env.WASABI_SECRET_KEY,
            },
            folders: ['inputs/', 'outputs/'],
        });

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

setupBucket();
