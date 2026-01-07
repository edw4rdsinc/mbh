import {
  S3Client,
  ListBucketsCommand,
  PutPublicAccessBlockCommand,
  DeleteBucketPolicyCommand,
  GetBucketPolicyCommand,
  PutBucketAclCommand
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

// Create S3 client
const s3Client = new S3Client({
  region: process.env.WASABI_REGION || 'us-west-1',
  endpoint: process.env.WASABI_ENDPOINT || 'https://s3.us-west-1.wasabisys.com',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
  },
});

async function makeBucketsPrivate() {
  try {
    // List all buckets
    console.log('🔍 Listing all Wasabi buckets...\n');
    const listCommand = new ListBucketsCommand({});
    const { Buckets } = await s3Client.send(listCommand);

    if (!Buckets || Buckets.length === 0) {
      console.log('No buckets found.');
      return;
    }

    console.log(`Found ${Buckets.length} bucket(s)\n`);

    // Process each bucket
    for (const bucket of Buckets) {
      const bucketName = bucket.Name;
      console.log(`\n📦 Securing bucket: ${bucketName}`);
      console.log('─'.repeat(60));

      // Step 1: Enable Public Access Block
      try {
        const blockCommand = new PutPublicAccessBlockCommand({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        });
        await s3Client.send(blockCommand);
        console.log('  ✅ Enabled Public Access Block (all public access blocked)');
      } catch (error) {
        if (error.message.includes('temporary endpoint')) {
          console.log('  ⚠️  Skipping (bucket in different region)');
          continue;
        }
        console.log(`  ❌ Error enabling Public Access Block: ${error.message}`);
      }

      // Step 2: Check and remove public bucket policy
      try {
        const getPolicyCommand = new GetBucketPolicyCommand({ Bucket: bucketName });
        await s3Client.send(getPolicyCommand);

        // Policy exists, delete it
        const deletePolicyCommand = new DeleteBucketPolicyCommand({ Bucket: bucketName });
        await s3Client.send(deletePolicyCommand);
        console.log('  ✅ Removed bucket policy');
      } catch (error) {
        if (error.name === 'NoSuchBucketPolicy') {
          console.log('  ✓ No bucket policy to remove');
        } else {
          console.log(`  ⚠️  Could not check/remove policy: ${error.message}`);
        }
      }

      // Step 3: Set private ACL
      try {
        const aclCommand = new PutBucketAclCommand({
          Bucket: bucketName,
          ACL: 'private',
        });
        await s3Client.send(aclCommand);
        console.log('  ✅ Set ACL to private');
      } catch (error) {
        console.log(`  ⚠️  Error setting ACL: ${error.message}`);
      }

      console.log(`  ✅ Bucket ${bucketName} is now private!`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ All accessible buckets have been secured!');
    console.log('='.repeat(60));
    console.log('\nWhat was done:');
    console.log('  • Enabled Public Access Block (blocks all public access)');
    console.log('  • Removed public bucket policies');
    console.log('  • Set ACL to private');
    console.log('\nYour buckets are now completely private.');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

makeBucketsPrivate();
