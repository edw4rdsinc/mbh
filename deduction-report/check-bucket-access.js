import { S3Client, ListBucketsCommand, GetBucketAclCommand, GetBucketPolicyCommand, GetPublicAccessBlockCommand } from '@aws-sdk/client-s3';
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

async function checkBucketAccess() {
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

    let hasPublicBuckets = false;

    // Check each bucket
    for (const bucket of Buckets) {
      const bucketName = bucket.Name;
      console.log(`\n📦 Checking bucket: ${bucketName}`);
      console.log('─'.repeat(60));

      let isPublic = false;

      // Check Public Access Block
      try {
        const blockCommand = new GetPublicAccessBlockCommand({ Bucket: bucketName });
        const blockConfig = await s3Client.send(blockCommand);
        const config = blockConfig.PublicAccessBlockConfiguration;

        console.log('  Public Access Block Configuration:');
        console.log(`    Block Public ACLs: ${config.BlockPublicAcls}`);
        console.log(`    Ignore Public ACLs: ${config.IgnorePublicAcls}`);
        console.log(`    Block Public Policy: ${config.BlockPublicPolicy}`);
        console.log(`    Restrict Public Buckets: ${config.RestrictPublicBuckets}`);

        // Note: Wasabi doesn't support Public Access Block, so undefined is normal
        if (config.BlockPublicAcls === undefined) {
          console.log('  ℹ️  Note: Wasabi does not support Public Access Block (this is normal)');
        } else if (!config.BlockPublicAcls || !config.IgnorePublicAcls ||
                   !config.BlockPublicPolicy || !config.RestrictPublicBuckets) {
          console.log('  ⚠️  WARNING: Public access block not fully enabled!');
          isPublic = true;
        }
      } catch (error) {
        if (error.name === 'NoSuchPublicAccessBlockConfiguration') {
          console.log('  ℹ️  Note: Wasabi does not support Public Access Block (this is normal)');
        } else {
          console.log(`  ❌ Error checking Public Access Block: ${error.message}`);
        }
      }

      // Check ACL
      try {
        const aclCommand = new GetBucketAclCommand({ Bucket: bucketName });
        const { Grants } = await s3Client.send(aclCommand);

        console.log('\n  Access Control List (ACL):');
        for (const grant of Grants) {
          const grantee = grant.Grantee;
          const permission = grant.Permission;

          if (grantee.Type === 'Group') {
            console.log(`    ${grantee.URI} - ${permission}`);

            // Check for public access
            if (grantee.URI?.includes('AllUsers') || grantee.URI?.includes('AuthenticatedUsers')) {
              console.log(`    ⚠️  WARNING: Bucket has public ${permission} access!`);
              isPublic = true;
            }
          } else {
            console.log(`    ${grantee.DisplayName || grantee.ID} - ${permission}`);
          }
        }
      } catch (error) {
        console.log(`  ❌ Error checking ACL: ${error.message}`);
      }

      // Check Bucket Policy
      try {
        const policyCommand = new GetBucketPolicyCommand({ Bucket: bucketName });
        const { Policy } = await s3Client.send(policyCommand);

        console.log('\n  Bucket Policy:');
        const policyObj = JSON.parse(Policy);

        // Check for public statements
        for (const statement of policyObj.Statement) {
          if (statement.Principal === '*' ||
              (statement.Principal?.AWS === '*') ||
              (Array.isArray(statement.Principal) && statement.Principal.includes('*'))) {
            console.log(`    ⚠️  WARNING: Policy has public statement!`);
            console.log(`    Effect: ${statement.Effect}`);
            console.log(`    Actions: ${JSON.stringify(statement.Action)}`);
            isPublic = true;
          }
        }

        console.log(`    ${policyObj.Statement.length} statement(s) in policy`);
      } catch (error) {
        if (error.name === 'NoSuchBucketPolicy') {
          console.log('  ✓ No bucket policy (good for private bucket)');
        } else {
          console.log(`  ❌ Error checking policy: ${error.message}`);
        }
      }

      // Final verdict
      if (isPublic) {
        console.log('\n  🔴 VERDICT: This bucket may be publicly accessible!');
        hasPublicBuckets = true;
      } else {
        console.log('\n  ✅ VERDICT: This bucket appears to be private');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (hasPublicBuckets) {
      console.log('⚠️  SECURITY ALERT: Some buckets may have public access!');
      console.log('Please review the warnings above and secure your buckets.');
    } else {
      console.log('✅ All buckets appear to be private and secure.');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

checkBucketAccess();
