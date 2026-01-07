# Commission Processing Automation

## Overview

The commission processing system automatically runs on the **15th of each month at 9:00 AM** to process the previous month's commission statements and bank reconciliation.

## Folder Structure

### Google Drive (synced to VPS)
```
audits/
├── 2025-08/
│   ├── commission_statements/     ← Drop carrier PDFs here
│   └── bank_statement/             ← Drop US Bank statement here
├── 2025-09/
├── 2025-10/
└── master_data/
    └── mbh_master_contacts_list.csv
```

### VPS Output
```
~/automations/commission_automator/output/
├── 2025-08/
│   ├── commission_output.csv
│   ├── reconciliation.csv
│   ├── state_summary.csv
│   └── needs_review.csv
└── 2025-09/
```

## Automated Workflow

**Every 15th of the month at 9:00 AM:**

1. Auto-detects previous month (e.g., running Sept 15 processes August data)
2. Extracts commission data from all carrier PDFs
3. Generates state summary report
4. Reconciles against bank statement
5. Emails professional HTML report to jennifer@mybenefitshelp.net
6. Sends success/failure notification to sam@edw4rds.com

## Manual Processing

### Process a specific month:
```bash
cd ~/automations/commission_automator
./run_monthly_processing.sh 2025-09
```

### Process previous month (auto-detect):
```bash
cd ~/automations/commission_automator
./run_monthly_processing.sh
```

### Individual steps (for debugging):
```bash
cd ~/automations/commission_automator/src

# Step 1: Extract commissions
~/pdfplumber-env/bin/python3 extract_commissions.py --month 2025-09

# Step 2: Generate state summary
~/pdfplumber-env/bin/python3 generate_state_summary.py --month 2025-09

# Step 3: Generate & email report
~/pdfplumber-env/bin/python3 generate_report.py --month 2025-09
```

## Monthly Checklist for Jennifer

**Before the 15th of each month:**

1. Create new month folder in Google Drive: `audits/YYYY-MM/`
2. Create subfolders:
   - `audits/YYYY-MM/commission_statements/`
   - `audits/YYYY-MM/bank_statement/`
3. Upload all carrier commission PDFs to `commission_statements/`
4. Upload US Bank statement PDF to `bank_statement/`
5. Wait for automated processing on the 15th

**Files sync automatically to VPS** - no manual upload needed!

## Email Notifications

### Success Email
- **To:** sam@edw4rds.com
- **Subject:** ✅ Commission Processing Complete - YYYY-MM
- **Contains:** Confirmation that all steps completed

### Failure Email
- **To:** sam@edw4rds.com
- **Subject:** ❌ Commission Processing FAILED - YYYY-MM
- **Contains:** Error details and recent log output
- **Action:** Check logs and run manually

### Report Email
- **To:** jennifer@mybenefitshelp.net
- **Subject:** Commission Reconciliation Report - YYYY-MM
- **Attachments:**
  - commission_output.csv
  - reconciliation.csv
  - state_summary.csv
- **Contains:**
  - Executive summary
  - State breakdown
  - Carrier reconciliation
  - Items needing review

## Logs

All processing logs saved to:
```
~/automations/commission_automator/logs/
├── monthly_processing_YYYY-MM_TIMESTAMP.log
├── extraction_TIMESTAMP.log
├── report_TIMESTAMP.log
└── cron.log
```

## Cron Schedule

View current schedule:
```bash
crontab -l
```

Expected output:
```
0 9 15 * * /home/sam/automations/commission_automator/run_monthly_processing.sh >> /home/sam/automations/commission_automator/logs/cron.log 2>&1
```

This runs at 9:00 AM on the 15th of every month.

## Troubleshooting

### Processing failed - missing files
**Error:** `Commission statements directory not found`

**Solution:** Check that Google Drive folder exists and files have synced:
```bash
ls ~/commission_automator/data/mbh/YYYY-MM/commission_statements/
ls ~/commission_automator/data/mbh/YYYY-MM/bank_statement/
```

### No email received
**Check:**
1. Spam folder
2. Resend API key still valid
3. Log file for errors:
   ```bash
   tail -50 ~/automations/commission_automator/logs/monthly_processing_*.log
   ```

### Re-run failed month
```bash
cd ~/automations/commission_automator
./run_monthly_processing.sh 2025-09
```

### Disable automation temporarily
```bash
crontab -e
# Comment out the line with # at the beginning
# 0 9 15 * * /home/sam/automations/commission_automator/run_monthly_processing.sh...
```

## API Keys & Credentials

- **Resend API:** Configured in `run_monthly_processing.sh` and `generate_report.py`
- **Claude API:** Set in environment variable `ANTHROPIC_API_KEY`
- **Domain:** updates.edw4rds.com (verified in Resend)

## Files Overview

| File | Purpose |
|------|---------|
| `run_monthly_processing.sh` | Main automation script |
| `extract_commissions.py` | Extract data from PDFs |
| `generate_state_summary.py` | Calculate state totals |
| `generate_report.py` | Bank reconciliation & email |
| `README.md` | Full technical documentation |
| `AUTOMATION.md` | This file - automation guide |

## Support

For issues or questions, contact: sam@edw4rds.com
