#!/usr/bin/env node

/**
 * Nylas Email Processor for Deduction Reports
 *
 * Checks for unread emails with CSV attachments, processes them,
 * and sends back formatted Excel files.
 *
 * Run manually: node email-processor.js
 * Run via cron: (every 5 min) cd /home/sam/chatbot-platform/mbh/deduction-report && node email-processor.js
 */

import Nylas from 'nylas';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { processLocalFile } from './src/index.js';
import { uploadFile, downloadFile } from './src/wasabi-client.js';
import { emailConfig, shouldProcessEmail } from './email-config.js';
import dotenv from 'dotenv';

// Get the directory of this script for loading .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Initialize Nylas client
const nylas = new Nylas({
  apiKey: process.env.NYLAS_API_KEY,
  apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
});

const GRANT_ID = process.env.NYLAS_GRANT_ID;

/**
 * Main function to check and process emails
 */
async function processIncomingEmails() {
  console.log('\n🔍 Checking for new emails with CSV attachments...');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log('='.repeat(80));

  try {
    // Get unread messages from inbox
    const messages = await nylas.messages.list({
      identifier: GRANT_ID,
      queryParams: {
        in: 'INBOX',
        unread: true,
        limit: 20,
      },
    });

    console.log(`📬 Found ${messages.data.length} unread messages in inbox`);

    if (messages.data.length === 0) {
      console.log('✅ No unread messages. Nothing to do.\n');
      return;
    }

    let processedCount = 0;
    let skippedCount = 0;

    for (const message of messages.data) {
      try {
        // Get full message details
        const fullMessage = await nylas.messages.find({
          identifier: GRANT_ID,
          messageId: message.id,
        });

        // Check if email should be processed based on filters
        const filterResult = shouldProcessEmail(fullMessage.data);
        if (!filterResult.shouldProcess) {
          console.log(`  ⏭️  Skipping: "${fullMessage.data.subject}" (${filterResult.reason})`);
          skippedCount++;
          continue;
        }

        // Check for CSV attachments
        const csvAttachments = fullMessage.data.attachments?.filter(att =>
          att.filename?.toLowerCase().endsWith('.csv')
        ) || [];

        if (csvAttachments.length === 0) {
          console.log(`  ⏭️  Skipping: "${fullMessage.data.subject}" (no CSV attachment)`);
          skippedCount++;
          continue;
        }

        console.log(`\n📧 Processing Email:`);
        console.log(`   Subject: ${fullMessage.data.subject}`);
        console.log(`   From: ${fullMessage.data.from[0].email}`);
        console.log(`   CSV Files: ${csvAttachments.length}`);

        // Process each CSV attachment
        for (const csvFile of csvAttachments) {
          await processCSVAttachment(fullMessage.data, csvFile, message.id);
        }

        // Mark message as read (if configured)
        if (emailConfig.processing.markAsRead) {
          await nylas.messages.update({
            identifier: GRANT_ID,
            messageId: message.id,
            requestBody: {
              unread: false,
            },
          });
          console.log(`   ✓ Marked as read`);
        }

        processedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing message "${message.subject}":`, error.message);
        console.error(error.stack);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 Summary: ${processedCount} processed, ${skippedCount} skipped`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error checking emails:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Process a CSV attachment from an email
 */
async function processCSVAttachment(message, attachment, messageId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

  console.log(`\n   📎 Processing attachment: ${attachment.filename}`);

  try {
    // Download attachment using Nylas v3 API
    // Based on docs: GET /v3/grants/{grant_id}/attachments/{attachment_id}?message_id={message_id}
    console.log(`   1️⃣  Downloading CSV from Nylas...`);

    const fetch = (await import('node-fetch')).default;
    const downloadUrl = `https://api.us.nylas.com/v3/grants/${GRANT_ID}/attachments/${attachment.id}/download?message_id=${messageId}`;

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.NYLAS_API_KEY}`,
        'Accept': 'application/octet-stream',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to download attachment (${response.status}): ${errorText}`);
    }

    const attachmentData = Buffer.from(await response.arrayBuffer());

    // Save temporarily
    const tempInputPath = `/tmp/input-${Date.now()}.csv`;
    const tempOutputPath = `/tmp/output-${Date.now()}.xlsx`;

    writeFileSync(tempInputPath, attachmentData);
    console.log(`   ✓ Downloaded ${attachmentData.length} bytes`);

    // Process with existing automation
    console.log(`   2️⃣  Processing CSV...`);
    const result = await processLocalFile(tempInputPath, tempOutputPath);
    console.log(`   ✓ Generated Excel with ${result.stats.outputRows} rows`);

    // Upload to Wasabi (optional - for backup/archive)
    const wasabiKey = `outputs/${result.outputFile.split('/').pop()}`;
    const excelBuffer = readFileSync(tempOutputPath);

    console.log(`   3️⃣  Uploading to Wasabi...`);
    await uploadFile(wasabiKey, excelBuffer);
    console.log(`   ✓ Uploaded to: ${wasabiKey}`);

    // Send reply email with Excel attachment
    console.log(`   4️⃣  Sending reply email...`);
    await sendReplyWithAttachment(message, tempOutputPath, result, excelBuffer);
    console.log(`   ✅ Reply sent with Excel attachment!`);

    // Cleanup temp files
    unlinkSync(tempInputPath);
    unlinkSync(tempOutputPath);

  } catch (error) {
    console.error(`   ❌ Failed to process attachment: ${error.message}`);

    // Send error email to sender
    try {
      await sendErrorEmail(message, error);
      console.log(`   📧 Error notification sent to sender`);
    } catch (emailError) {
      console.error(`   ❌ Failed to send error email:`, emailError.message);
    }

    throw error;
  }
}

/**
 * Send reply email with Excel attachment
 */
async function sendReplyWithAttachment(originalMessage, excelFilePath, result, excelBuffer) {
  const excelFilename = result.outputFile ? result.outputFile.split('/').pop() : 'Deduction-Report.xlsx';

  // Send the message with attachment inline (base64)
  const sentMessage = await nylas.messages.send({
    identifier: GRANT_ID,
    requestBody: {
      to: originalMessage.from,
      subject: `Re: ${originalMessage.subject}`,
      body: `Hello!

Your deduction report has been processed successfully! 📊

Please find the formatted Excel file attached.

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Input rows: ${result.stats.inputRows}
• Output rows: ${result.stats.outputRows} (including subtotals)
• File: ${excelFilename}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The report includes:
✓ Filtered active employees
✓ Name formatting
✓ Pre-tax calculations
✓ Semi-monthly deductions
✓ Grouped by payor with subtotals
✓ Professional Excel formatting

If you have any questions or need assistance, please let me know!

${emailConfig.replyOptions.signature}
      `,
      attachments: [{
        filename: excelFilename,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: excelBuffer.toString('base64'),
        size: excelBuffer.length,
      }],
      cc: emailConfig.replyOptions.ccAddresses.length > 0
        ? emailConfig.replyOptions.ccAddresses.map(email => ({ email }))
        : undefined,
    },
  });

  return sentMessage;
}

/**
 * Send error notification email
 */
async function sendErrorEmail(originalMessage, error) {
  await nylas.messages.send({
    identifier: GRANT_ID,
    requestBody: {
      to: originalMessage.from,
      subject: `Re: ${originalMessage.subject} - Processing Error`,
      body: `Hello,

We encountered an error while processing your deduction report.

Error Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${error.message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please check the following:
• The CSV file is from the carrier website
• The file contains all required columns
• The file is not corrupted

If the problem persists, please contact support with the original CSV file.

Best regards,
MBH Reports Automation
      `,
    },
  });
}

// Run the processor
if (import.meta.url === `file://${process.argv[1]}`) {
  processIncomingEmails()
    .then(() => {
      console.log('✅ Email processing complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Email processing failed:', error);
      process.exit(1);
    });
}

export { processIncomingEmails };
