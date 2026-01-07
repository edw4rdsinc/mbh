#!/usr/bin/env node

import { S3Client, CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: 'us-west-1',
    endpoint: 'https://s3.us-west-1.wasabisys.com',
    credentials: {
        accessKeyId: '7AELY1Q4S52PLE1ZMING',
        secretAccessKey: 'YkCiFAakdkCDpCt6pAOBE6FwEef5nUMnMAY2VKK9',
    },
});

async function setupBucket() {
    const bucketName = 'dev-files';

    try {
        console.log(`Creating bucket "${bucketName}"...`);
        const createCommand = new CreateBucketCommand({
            Bucket: bucketName,
        });

        await s3Client.send(createCommand);
        console.log(`✓ Bucket "${bucketName}" created successfully!`);

        // Create folder structure
        const folders = ['dns/', 'configs/', 'exports/', 'misc/'];

        for (const folder of folders) {
            const folderCommand = new PutObjectCommand({
                Bucket: bucketName,
                Key: folder,
                Body: '',
            });
            await s3Client.send(folderCommand);
            console.log(`✓ Created ${folder} folder`);
        }

        console.log('\n✓ Setup complete!');
        console.log('\nBucket details:');
        console.log(`  Name: ${bucketName}`);
        console.log(`  Region: us-west-1`);
        console.log(`  Endpoint: https://s3.us-west-1.wasabisys.com`);
        console.log(`  Base URL: https://${bucketName}.s3.us-west-1.wasabisys.com`);

    } catch (error) {
        if (error.name === 'BucketAlreadyOwnedByYou') {
            console.log(`✓ Bucket "${bucketName}" already exists and is owned by you.`);
        } else if (error.name === 'BucketAlreadyExists') {
            console.log(`⚠️  Bucket "${bucketName}" already exists (owned by someone else).`);
        } else {
            console.error('Error:', error.message);
            process.exit(1);
        }
    }
}

setupBucket();
