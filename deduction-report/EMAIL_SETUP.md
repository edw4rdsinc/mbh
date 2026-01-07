# Email Processor Setup Guide

Automated email processing for deduction reports using Nylas.

---

## Quick Start

### 1. Install Dependencies

```bash
cd /home/sam/chatbot-platform/mbh/deduction-report
npm install
```

This will install the Nylas SDK (`nylas` package).

---

### 2. Get Nylas API Credentials

You already have Nylas configured! Just need to get your API key.

**Where to find your credentials:**

1. Go to https://dashboard.nylas.com/
2. Navigate to **App Settings** → **API Keys**
3. Copy your **API Key** (starts with `nyk_...`)
4. Your Grant ID is already in `.env`: `abbb1aaf-aa8d-4778-b5db-574205f4068a`

---

### 3. Update .env File

Edit `/home/sam/chatbot-platform/mbh/deduction-report/.env`:

```bash
# Replace this line:
NYLAS_API_KEY=your_nylas_api_key_here

# With your actual API key:
NYLAS_API_KEY=nyk_v0_abc123xyz...
```

The Grant ID is already set correctly.

---

### 4. Test It Manually

```bash
cd /home/sam/chatbot-platform/mbh/deduction-report
npm run check-emails
```

**What it does:**
1. Checks your inbox for unread emails
2. Looks for CSV attachments
3. Processes them through the automation
4. Sends back formatted Excel files
5. Marks emails as read

---

### 5. Set Up Automated Checking (Cron)

**Option A: Every 5 minutes**

```bash
# Edit crontab
crontab -e

# Add this line:
*/5 * * * * cd /home/sam/chatbot-platform/mbh/deduction-report && npm run check-emails >> /tmp/email-processor.log 2>&1
```

**Option B: Every hour**

```bash
0 * * * * cd /home/sam/chatbot-platform/mbh/deduction-report && npm run check-emails >> /tmp/email-processor.log 2>&1
```

**Option C: Business hours only (9 AM - 5 PM, Mon-Fri)**

```bash
0 9-17 * * 1-5 cd /home/sam/chatbot-platform/mbh/deduction-report && npm run check-emails >> /tmp/email-processor.log 2>&1
```

---

## How Customers Use It

### Customer Workflow

1. **Download CSV** from carrier website
2. **Email CSV** to your Gmail address (the one connected to Nylas)
3. **Subject line:** "Deduction Report - [Company Name]" (optional, any subject works)
4. **Attach:** The CSV file
5. **Wait:** ~30 seconds to 5 minutes (depending on cron schedule)
6. **Receive:** Reply email with formatted Excel file

---

## Email Format

**Customer sends:**
```
To: your-email@gmail.com
Subject: Deduction Report - Stange Law Firm
Attachments: FilteredPolicies.csv
```

**Customer receives:**
```
From: your-email@gmail.com
Subject: Re: Deduction Report - Stange Law Firm
Body: Your deduction report has been processed successfully! 📊

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Input rows: 85
• Output rows: 102 (including subtotals)
• File: Stange Law Firm ME610 - Updated Deduction Summary.xlsx
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Attachments: Stange Law Firm ME610 - Updated Deduction Summary.xlsx
```

---

## Monitoring

### Check Logs

```bash
# View recent activity
tail -f /tmp/email-processor.log

# View last run
tail -50 /tmp/email-processor.log
```

### Manual Run (Testing)

```bash
cd /home/sam/chatbot-platform/mbh/deduction-report
npm run check-emails
```

You'll see output like:
```
🔍 Checking for new emails with CSV attachments...
================================================================================
Time: 10/21/2025, 10:30:00 AM
================================================================================
📬 Found 3 unread messages in inbox

📧 Processing Email:
   Subject: Deduction Report - Stange Law Firm
   From: customer@example.com
   CSV Files: 1

   📎 Processing attachment: FilteredPolicies.csv
   1️⃣  Downloading CSV from Nylas...
   ✓ Downloaded 45678 bytes
   2️⃣  Processing CSV...
   ✓ Generated Excel with 102 rows
   3️⃣  Uploading to Wasabi...
   ✓ Uploaded to: outputs/Stange Law Firm ME610 - Updated Deduction Summary.xlsx
   4️⃣  Sending reply email...
   ✅ Reply sent with Excel attachment!
   ✓ Marked as read

================================================================================
📊 Summary: 1 processed, 2 skipped
================================================================================
```

---

## Troubleshooting

### Issue: "No unread messages"

**Solution:** The script only processes unread emails. Either:
- Send a new test email
- Mark an existing email as unread to test again

### Issue: "Failed to download attachment"

**Solution:** Check your Nylas API key in `.env`:
```bash
# Verify it starts with "nyk_"
cat .env | grep NYLAS_API_KEY
```

### Issue: "CSV parsing error"

**Solution:**
- Make sure CSV is from the carrier website
- Check that it has all required columns
- Try processing it manually first:
  ```bash
  npm start -- --local /path/to/file.csv /path/to/output.xlsx
  ```

### Issue: "Error sending reply email"

**Solution:**
- Verify Nylas has send permissions for your email account
- Check that your grant hasn't expired (re-authenticate if needed)

---

## Advanced Configuration

### Filter Emails by Subject

Edit `email-processor.js` and add filtering:

```javascript
// Only process emails with "Deduction Report" in subject
if (!fullMessage.data.subject?.includes('Deduction Report')) {
  console.log(`  ⏭️  Skipping: "${fullMessage.data.subject}" (subject filter)`);
  continue;
}
```

### Filter Emails by Sender

```javascript
// Only process from specific domain
const allowedDomains = ['@example.com', '@company.com'];
const fromEmail = fullMessage.data.from[0].email;

if (!allowedDomains.some(domain => fromEmail.endsWith(domain))) {
  console.log(`  ⏭️  Skipping: From ${fromEmail} (not allowed)`);
  continue;
}
```

### Process Multiple CSV Files

Already supported! If an email has multiple CSV attachments, it processes all of them.

---

## Security Notes

1. **API Key Protection:** Never commit `.env` to git (already in `.gitignore`)
2. **Email Filtering:** Consider adding sender whitelist for production
3. **File Validation:** Script validates CSV structure before processing
4. **Error Handling:** Failed processing sends error email instead of silent failure

---

## Switching to Webhooks Later

When you're ready for instant processing (no polling delay):

1. Deploy webhook endpoint (can use same server, or serverless)
2. Register webhook URL with Nylas
3. Remove cron job
4. Email processing becomes instant instead of every 5 minutes

Let me know if you want help with webhook setup!

---

## Support

### Test the Complete Flow

1. Send yourself an email with a CSV attachment
2. Wait for cron to run (or run manually: `npm run check-emails`)
3. Check that you received the reply with Excel
4. Verify Excel is formatted correctly

### Need Help?

Check the logs:
```bash
tail -100 /tmp/email-processor.log
```

Run manually to see detailed output:
```bash
cd /home/sam/chatbot-platform/mbh/deduction-report
npm run check-emails
```

---

**Status:** ✅ Ready to Use

**Last Updated:** October 21, 2025
