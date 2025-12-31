import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import config from './config.js';

// Create S3 client
const s3Client = new S3Client({
  region: config.wasabi.region,
  endpoint: config.wasabi.endpoint,
  credentials: config.wasabi.credentials,
});

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * List files in a folder
 * @param {string} prefix - Folder prefix (e.g., 'inputs/')
 * @returns {Promise<Array>} - Array of file objects
 */
export async function listFiles(prefix = 'inputs/') {
  try {
    const command = new ListObjectsV2Command({
      Bucket: config.wasabi.bucketName,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    if (!response.Contents) {
      return [];
    }

    // Filter out folder markers (objects ending with /)
    return response.Contents.filter(obj => !obj.Key.endsWith('/'));
  } catch (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Download file from Wasabi
 * @param {string} key - File key (e.g., 'inputs/file.csv')
 * @returns {Promise<Buffer>} - File buffer
 */
export async function downloadFile(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: config.wasabi.bucketName,
      Key: key,
    });

    const response = await s3Client.send(command);
    return await streamToBuffer(response.Body);
  } catch (error) {
    throw new Error(`Failed to download file ${key}: ${error.message}`);
  }
}

/**
 * Upload file to Wasabi
 * @param {string} key - File key (e.g., 'outputs/file.xlsx')
 * @param {Buffer} buffer - File buffer
 * @returns {Promise<void>}
 */
export async function uploadFile(key, buffer) {
  try {
    const command = new PutObjectCommand({
      Bucket: config.wasabi.bucketName,
      Key: key,
      Body: buffer,
    });

    await s3Client.send(command);
  } catch (error) {
    throw new Error(`Failed to upload file ${key}: ${error.message}`);
  }
}

export default {
  listFiles,
  downloadFile,
  uploadFile,
};
