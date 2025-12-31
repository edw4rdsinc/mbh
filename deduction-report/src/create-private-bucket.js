/**
 * Secure Wasabi Bucket Creation Module
 *
 * This module ensures all new buckets are created with private access by default.
 * Use this module for ALL bucket creation to prevent accidental public exposure.
 */

import {
  S3Client,
  CreateBucketCommand,
  PutBucketAclCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Create a private Wasabi bucket with secure defaults
 *
 * @param {Object} options - Configuration options
 * @param {string} options.bucketName - Name of the bucket to create
 * @param {string} options.region - Wasabi region (default: 'us-west-1')
 * @param {string} options.endpoint - Wasabi endpoint
 * @param {Object} options.credentials - AWS credentials (accessKeyId, secretAccessKey)
 * @param {Array<string>} options.folders - Optional folders to create (e.g., ['inputs/', 'outputs/'])
 * @returns {Promise<Object>} - Bucket creation result
 */
export async function createPrivateBucket({
  bucketName,
  region = 'us-west-1',
  endpoint = 'https://s3.us-west-1.wasabisys.com',
  credentials,
  folders = [],
}) {
  // Validate inputs
  if (!bucketName) {
    throw new Error('bucketName is required');
  }
  if (!credentials || !credentials.accessKeyId || !credentials.secretAccessKey) {
    throw new Error('credentials with accessKeyId and secretAccessKey are required');
  }

  // Create S3 client
  const s3Client = new S3Client({
    region,
    endpoint,
    credentials,
  });

  try {
    console.log(`Creating private bucket "${bucketName}"...`);

    // Step 1: Create the bucket
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
      // Explicitly set ACL to private
      ACL: 'private',
    });

    await s3Client.send(createCommand);
    console.log(`✅ Bucket "${bucketName}" created`);

    // Step 2: Explicitly set bucket ACL to private
    // This ensures the bucket is private even if creation didn't apply it
    const aclCommand = new PutBucketAclCommand({
      Bucket: bucketName,
      ACL: 'private',
    });

    await s3Client.send(aclCommand);
    console.log(`✅ Set bucket ACL to private`);

    // Step 3: Create any requested folders
    if (folders && folders.length > 0) {
      console.log(`\nCreating folders...`);
      for (const folder of folders) {
        // Ensure folder ends with /
        const folderKey = folder.endsWith('/') ? folder : `${folder}/`;

        const folderCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: folderKey,
          Body: '',
        });

        await s3Client.send(folderCommand);
        console.log(`✅ Created ${folderKey} folder`);
      }
    }

    console.log('\n✅ Setup complete!');
    console.log('\n🔒 SECURITY: This bucket is PRIVATE');
    console.log('   - No public access');
    console.log('   - No public policies');
    console.log('   - Private ACL set');
    console.log('\nBucket details:');
    console.log(`  Name: ${bucketName}`);
    console.log(`  Region: ${region}`);
    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  Internal URL: https://${bucketName}.s3.${region}.wasabisys.com`);

    return {
      success: true,
      bucketName,
      region,
      endpoint,
      url: `https://${bucketName}.s3.${region}.wasabisys.com`,
    };

  } catch (error) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`ℹ️  Bucket "${bucketName}" already exists and is owned by you`);
      return {
        success: true,
        bucketName,
        region,
        endpoint,
        url: `https://${bucketName}.s3.${region}.wasabisys.com`,
        alreadyExists: true,
      };
    } else if (error.name === 'BucketAlreadyExists') {
      throw new Error(`Bucket "${bucketName}" already exists and is owned by someone else`);
    } else {
      throw new Error(`Failed to create bucket: ${error.message}`);
    }
  }
}

/**
 * IMPORTANT SECURITY NOTICE:
 *
 * NEVER create buckets with public policies or public ACLs.
 * If you need to share files, use signed URLs instead.
 *
 * BAD - DO NOT DO THIS:
 *   - Setting ACL to 'public-read'
 *   - Adding bucket policies with Principal: '*'
 *   - Using PutBucketPolicyCommand with public access
 *
 * GOOD - DO THIS:
 *   - Always use ACL: 'private'
 *   - Use signed URLs for temporary access
 *   - Use createPrivateBucket() from this module
 */

export default createPrivateBucket;
