/**
 * Email Processing Configuration
 *
 * Controls which emails get processed by the automation
 */

export const emailConfig = {

  // FILTER BY SUBJECT LINE (optional)
  // If set, only process emails with these keywords in subject
  // Leave empty array [] to disable subject filtering
  subjectKeywords: [
    'deduction report',  // Case-insensitive matching
  ],

  // FILTER BY SENDER (optional)
  // If set, only process emails from these domains or addresses
  // Leave empty array [] to disable sender filtering
  allowedSenders: [
    // Examples (uncomment to enable):
    // '@mbhbenefits.com',        // Allow any email from this domain
    // 'customer@company.com',     // Allow specific email address
    // '@gmail.com',               // Allow all Gmail
  ],

  // FILTER BY RECIPIENT (optional)
  // If you want a dedicated address like reports+deduction@edw4rds.com
  // Leave empty string '' to disable recipient filtering
  requiredRecipient: '',
  // Example: 'reports+deduction@edw4rds.com'

  // AUTO-REPLY SETTINGS
  replyOptions: {
    // Include original CSV in reply? (for record-keeping)
    attachOriginalCSV: false,

    // CC anyone on replies?
    ccAddresses: [
      // Examples:
      // 'admin@yourcompany.com',
      // 'accounting@yourcompany.com',
    ],

    // Custom signature for reply emails
    signature: `
Best regards,
MBH Reports Automation
    `.trim(),
  },

  // PROCESSING OPTIONS
  processing: {
    // Mark emails as read after processing?
    markAsRead: true,

    // Move to a specific folder after processing? (leave empty to keep in inbox)
    moveToFolder: '', // Example: 'Processed Reports'

    // Apply a label after processing?
    applyLabel: '', // Example: 'Deduction Reports/Processed'

    // Skip emails older than X days?
    skipOlderThanDays: 7, // Only process emails from last 7 days
  },

  // ERROR HANDLING
  errors: {
    // Send error emails back to sender?
    sendErrorNotification: true,

    // Also notify admins of errors?
    notifyAdmins: false,
    adminEmails: [
      // 'admin@yourcompany.com',
    ],
  },
};

/**
 * Check if email should be processed based on filters
 */
export function shouldProcessEmail(message) {
  const subject = message.subject?.toLowerCase() || '';
  const fromEmail = message.from?.[0]?.email?.toLowerCase() || '';
  const toEmail = message.to?.[0]?.email?.toLowerCase() || '';

  // Check subject filter
  if (emailConfig.subjectKeywords.length > 0) {
    const matchesSubject = emailConfig.subjectKeywords.some(keyword =>
      subject.includes(keyword.toLowerCase())
    );
    if (!matchesSubject) {
      return {
        shouldProcess: false,
        reason: `Subject doesn't contain required keywords`
      };
    }
  }

  // Check sender filter
  if (emailConfig.allowedSenders.length > 0) {
    const matchesSender = emailConfig.allowedSenders.some(allowed =>
      fromEmail.includes(allowed.toLowerCase()) ||
      fromEmail.endsWith(allowed.toLowerCase())
    );
    if (!matchesSender) {
      return {
        shouldProcess: false,
        reason: `Sender ${fromEmail} not in allowed list`
      };
    }
  }

  // Check recipient filter
  if (emailConfig.requiredRecipient) {
    if (!toEmail.includes(emailConfig.requiredRecipient.toLowerCase())) {
      return {
        shouldProcess: false,
        reason: `Not sent to ${emailConfig.requiredRecipient}`
      };
    }
  }

  // Check age filter
  if (emailConfig.processing.skipOlderThanDays > 0) {
    const messageDate = new Date(message.date * 1000);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - emailConfig.processing.skipOlderThanDays);

    if (messageDate < cutoffDate) {
      return {
        shouldProcess: false,
        reason: `Email is older than ${emailConfig.processing.skipOlderThanDays} days`
      };
    }
  }

  return { shouldProcess: true };
}

export default emailConfig;
