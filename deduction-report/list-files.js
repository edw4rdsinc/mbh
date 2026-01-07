#!/usr/bin/env node

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
    region: 'us-west-1',
    endpoint: 'https://s3.us-west-1.wasabisys.com',
    credentials: {
        accessKeyId: '7AELY1Q4S52PLE1ZMING',
        secretAccessKey: 'YkCiFAakdkCDpCt6pAOBE6FwEef5nUMnMAY2VKK9',
    },
});

async function listFiles() {
    const bucketName = 'mbh-deduction-report';

    try {
        // List files in inputs/
        console.log('Files in inputs/:');
        const inputsCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'inputs/',
        });
        const inputsResponse = await s3Client.send(inputsCommand);
        if (inputsResponse.Contents) {
            inputsResponse.Contents.forEach(obj => {
                if (obj.Key !== 'inputs/') {
                    console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
                }
            });
        }

        // List files in outputs/
        console.log('\nFiles in outputs/:');
        const outputsCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: 'outputs/',
        });
        const outputsResponse = await s3Client.send(outputsCommand);
        if (outputsResponse.Contents) {
            outputsResponse.Contents.forEach(obj => {
                if (obj.Key !== 'outputs/') {
                    console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
                }
            });
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

listFiles();
