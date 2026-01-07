# Wasabi Security Guidelines

## Overview

All Wasabi buckets MUST be created as **private** by default to prevent data leaks and unauthorized access.

## Creating New Buckets - SECURE METHOD

### Use the `createPrivateBucket` Module

**ALWAYS** use the secure bucket creation module when creating new buckets:

```javascript
import { createPrivateBucket } from './src/create-private-bucket.js';

await createPrivateBucket({
  bucketName: 'my-bucket-name',
  region: 'us-west-1',
  endpoint: 'https://s3.us-west-1.wasabisys.com',
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY,
  },
  folders: ['inputs/', 'outputs/'], // Optional
});
```

This module automatically:
- ✅ Sets ACL to `private`
- ✅ Prevents public policies
- ✅ Creates folders if needed
- ✅ Validates all inputs

## What NOT to Do

### ❌ NEVER Create Public Buckets

**DO NOT** use any of these approaches:

```javascript
// ❌ BAD - Public ACL
new CreateBucketCommand({
  Bucket: bucketName,
  ACL: 'public-read', // NEVER DO THIS
});

// ❌ BAD - Public bucket policy
new PutBucketPolicyCommand({
  Bucket: bucketName,
  Policy: JSON.stringify({
    Statement: [{
      Effect: 'Allow',
      Principal: '*', // NEVER DO THIS
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${bucketName}/*`]
    }]
  })
});

// ❌ BAD - Public ACL on bucket
new PutBucketAclCommand({
  Bucket: bucketName,
  ACL: 'public-read', // NEVER DO THIS
});
```

## Sharing Files Securely

If you need to share files from a private bucket, use **signed URLs** (also called pre-signed URLs):

```javascript
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Generate a temporary signed URL (expires in 1 hour)
const command = new GetObjectCommand({
  Bucket: 'my-bucket',
  Key: 'path/to/file.pdf',
});

const signedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: 3600, // 1 hour
});

// Share this URL - it will work for 1 hour only
console.log(signedUrl);
```

## Security Checklist

Before deploying any code that creates or modifies buckets:

- [ ] Bucket is created with `ACL: 'private'`
- [ ] No public bucket policies are applied
- [ ] Using `createPrivateBucket` module from `src/create-private-bucket.js`
- [ ] Credentials are stored in environment variables, not hardcoded
- [ ] If file sharing is needed, using signed URLs instead of public access

## Verifying Bucket Security

Run the security check script to verify all buckets are private:

```bash
node check-bucket-access.js
```

This will scan all buckets and report any public access issues.

## Making Buckets Private

If a bucket accidentally becomes public, run:

```bash
node make-buckets-private.js
```

This will:
1. Remove all public bucket policies
2. Set all buckets to private ACL
3. Verify the changes

## Notes

- Wasabi does not support AWS S3's "Public Access Block" feature
- Security relies on ACL and bucket policies only
- Always use private ACLs and avoid public policies
- Regularly audit buckets using `check-bucket-access.js`

## Questions?

If you need to make files publicly accessible:
1. **DON'T** make the bucket public
2. **DO** use signed URLs with expiration times
3. Consider using a CDN with authentication if permanent public access is needed
