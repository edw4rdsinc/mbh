# Email Processor - Quick Start

**3 steps to get email automation working:**

---

## Step 1: Add Your Nylas API Key

Edit `.env` file:

```bash
# Find your API key at: https://dashboard.nylas.com/
NYLAS_API_KEY=nyk_v0_YOUR_KEY_HERE
```

**Where to get it:**
1. Go to https://dashboard.nylas.com/
2. Click "API Keys" in sidebar
3. Copy your API key
4. Paste into `.env` file

---

## Step 2: Test It

```bash
npm run check-emails
```

**What happens:**
- Checks your Gmail inbox for unread emails
- Processes any with CSV attachments
- Sends back Excel files
- Marks emails as read

---

## Step 3: Automate It

Set up cron to check every 5 minutes:

```bash
crontab -e
```

Add this line:
```bash
*/5 * * * * cd /home/sam/chatbot-platform/mbh/deduction-report && npm run check-emails >> /tmp/email-processor.log 2>&1
```

---

## Usage

**Customer sends email:**
```
To: your-gmail@gmail.com
Subject: Deduction Report
Attachment: FilteredPolicies.csv
```

**Customer receives (within 5 minutes):**
```
From: your-gmail@gmail.com
Subject: Re: Deduction Report
Body: Your report is ready! 📊
Attachment: Stange Law Firm ME610 - Updated Deduction Summary.xlsx
```

---

## Commands

| Command | Purpose |
|---------|---------|
| `npm run check-emails` | Check inbox and process CSVs |
| `tail -f /tmp/email-processor.log` | Watch live logs |
| `npm start` | Process files from Wasabi (original) |

---

## Troubleshooting

**"No unread messages"**
→ Send yourself a test email with CSV attachment

**"Authentication error"**
→ Check NYLAS_API_KEY in `.env`

**"Failed to process CSV"**
→ Make sure CSV has all required columns from carrier

---

**Need help?** See `EMAIL_SETUP.md` for detailed guide.
