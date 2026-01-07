#!/usr/bin/env node

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';

const s3Client = new S3Client({
    region: 'us-west-1',
    endpoint: 'https://s3.us-west-1.wasabisys.com',
    credentials: {
        accessKeyId: '7AELY1Q4S52PLE1ZMING',
        secretAccessKey: 'YkCiFAakdkCDpCt6pAOBE6FwEef5nUMnMAY2VKK9',
    },
});

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function downloadFiles() {
    const bucketName = 'mbh-deduction-report';

    await mkdir('./downloaded', { recursive: true });

    const files = [
        'inputs/FilteredPolicies - 2025-10-14T135049.533.csv',
        'inputs/FilteredPolicies - 2025-10-15T164332.509.csv',
        'outputs/Stange Law Firm ME610 - Updated Deduction Summary.xlsx'
    ];

    for (const key of files) {
        try {
            console.log(`Downloading ${key}...`);
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key,
            });

            const response = await s3Client.send(command);
            const buffer = await streamToBuffer(response.Body);

            const localPath = `./downloaded/${key.split('/')[1]}`;
            await writeFile(localPath, buffer);
            console.log(`  ✓ Saved to ${localPath}`);
        } catch (error) {
            console.error(`  ✗ Error downloading ${key}:`, error.message);
        }
    }
}

downloadFiles();
