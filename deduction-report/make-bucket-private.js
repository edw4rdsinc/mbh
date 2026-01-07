#!/usr/bin/env node

import { S3Client, DeleteBucketPolicyCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: 'us-west-1',
    endpoint: 'https://s3.us-west-1.wasabisys.com',
    credentials: {
        accessKeyId: '7AELY1Q4S52PLE1ZMING',
        secretAccessKey: 'YkCiFAakdkCDpCt6pAOBE6FwEef5nUMnMAY2VKK9',
    },
});

async function makePrivate() {
    const bucketName = 'mbh-deduction-report';

    try {
        console.log(`Making bucket "${bucketName}" private...`);

        const command = new DeleteBucketPolicyCommand({
            Bucket: bucketName,
        });

        await s3Client.send(command);
        console.log(`✓ Bucket policy removed - "${bucketName}" is now private`);
        console.log('\nOnly requests with valid AWS credentials can now access this bucket.');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

makePrivate();
