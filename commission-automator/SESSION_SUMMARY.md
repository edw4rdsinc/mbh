# Commission Automation - Session Summary
## Date: October 11, 2025

## Overview
This session completed the migration from the old "Audits" folder to a new Google Shared Drive, enabling full automation capabilities for the commission processing system.

---

## ✅ Completed Tasks

### 1. Google Shared Drive Setup
- **Created 73 folders** in shared Drive (ID: `0AJ_IbKcKhFkyUk9PVA`)
  - 1 `master_data/` folder
  - 24 monthly folders (2025-01 through 2026-12)
  - 48 subfolders (commission_statements + bank_statement for each month)

### 2. File Migration
Migrated all August 2025 files to new location:
- ✅ 5 carrier commission PDFs (Allied, Beam, Guardian, Choice Builder, Cal Choice)
- ✅ 8 American Heritage/MyAccess PDFs
- ✅ 1 bank statement PDF (2025-08-31 Statement - USB MBH 7587.pdf)
- ✅ 1 master contacts CSV (mbh master contacts list.csv)

**Total: 15 files successfully copied**

### 3. Automation Scripts Updated

#### Created: `sync_from_drive.sh`
- Downloads files from Google Drive using service account API
- Supports any month: `./sync_from_drive.sh 2025-09`
- Downloads commission PDFs, bank statement, and master CSV
- No manual rclone configuration needed

#### Updated: `run_monthly_processing.sh`
- Added **Step 0**: Sync files from Google Drive before processing
- Complete workflow now:
  1. **Step 0**: Sync from Drive
  2. **Step 1**: Extract commissions
  3. **Step 2**: Generate state summary
  4. **Step 3**: Generate report & send email

### 4. Testing
✅ **Complete workflow tested successfully** for August 2025
- All files synced from shared Drive
- Commission extraction completed (extracted data from all carriers)
- State summary generated
- Bank reconciliation completed
- Email report sent successfully

### 5. Documentation Created

#### `SHARED_DRIVE_MIGRATION.md` (6.5KB)
Complete migration guide covering:
- Folder structure
- Migration process
- How the automation works
- Upload instructions for Jennifer
- Troubleshooting guide

#### `GOOGLE_DRIVE_SERVICE_ACCOUNT.md` (13KB)
Technical documentation for service account:
- Setup instructions
- Python/Node.js code examples
- Drive API query syntax
- Security best practices

### 6. Nylas Email Configuration
✅ **Updated Nylas MCP to use sam@edw4rds.com**
- Old Grant ID: `26423f3f-d743-48f7-8c53-2d7e4ba05359` (angela@edw4rds.com)
- New Grant ID: `abbb1aaf-aa8d-4778-b5db-574205f4068a` (sam@edw4rds.com)
- Configuration updated in `/home/sam/mcp-servers/.env`
- Change will take effect on next MCP server restart

---

## 📁 File Structure

### Google Shared Drive
```
https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA

Shared Drive (0AJ_IbKcKhFkyUk9PVA)/
├── master_data/
│   └── mbh master contacts list.csv
├── 2025-01/ through 2025-12/
│   ├── commission_statements/
│   │   ├── Allied.pdf
│   │   ├── Beam.pdf
│   │   ├── Guardian.pdf
│   │   ├── Choice Builder.pdf
│   │   ├── Cal Choice.pdf
│   │   └── MyAccess/
│   │       └── (American Heritage PDFs)
│   └── bank_statement/
│       └── (USB bank statement PDF)
└── 2026-01/ through 2026-12/
    └── (same structure)
```

### Local VPS (After Sync)
```
/home/sam/commission_automator/data/mbh/
├── master_data/
│   └── mbh master contacts list.csv
└── YYYY-MM/
    ├── commission_statements/
    │   └── (PDFs downloaded from Drive)
    └── bank_statement/
        └── (PDF downloaded from Drive)
```

### Automation Scripts
```
/home/sam/automations/commission_automator/
├── sync_from_drive.sh          ← NEW: Downloads from Drive
├── run_monthly_processing.sh   ← UPDATED: Added sync step
├── src/
│   ├── extract_commissions.py
│   ├── generate_state_summary.py
│   └── generate_report.py
├── output/
│   └── YYYY-MM/
│       ├── commission_output.csv
│       ├── needs_review.csv
│       └── state_summary_by_carrier.csv
├── logs/
├── SHARED_DRIVE_MIGRATION.md   ← NEW: Migration guide
└── SESSION_SUMMARY.md          ← This file
```

---

## 🔑 Key Information

### Service Account
- **Email**: `drive-master@mcp-g-drive-474704.iam.gserviceaccount.com`
- **Project**: `mcp-g-drive-474704`
- **Credentials**: `/home/sam/mcp-servers/gdrive-service-account.json`
- **Permissions**: Editor access on entire shared Drive

### Shared Drive
- **ID**: `0AJ_IbKcKhFkyUk9PVA`
- **Link**: https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA
- **Access**: Shared with service account and Jennifer

### Key Folder IDs
- Shared Drive Root: `0AJ_IbKcKhFkyUk9PVA`
- master_data: `1SKTIq24dO4bdzmvn7dB5uD8uuAUOfUlW`
- 2025-08: `1BHmoogtLCmgG9PcLdUKnETskLnhF6Icn`

---

## 🚀 How to Use

### For Jennifer (Uploading Files)
1. Navigate to: https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA
2. Open the month folder (e.g., `2025-09/`)
3. Upload commission PDFs to `commission_statements/`
4. Upload bank statement to `bank_statement/`

### For Automation (Automatic on 15th)
The system runs automatically on the **15th of each month at 2:00 AM PST**.

Cron job:
```bash
0 2 15 * * /home/sam/automations/commission_automator/run_monthly_processing.sh
```

### For Manual Processing
```bash
# Process previous month (auto-detect)
/home/sam/automations/commission_automator/run_monthly_processing.sh

# Process specific month
/home/sam/automations/commission_automator/run_monthly_processing.sh 2025-09
```

### For Manual Sync Only
```bash
# Sync files for a specific month
/home/sam/automations/commission_automator/sync_from_drive.sh 2025-09
```

---

## 📧 Email Configuration

### Report Recipients
- **Primary**: jennifer@mybenefitshelp.net
- **CC**: sam@edw4rds.com
- **From**: reports@updates.edw4rds.com (via Resend API)

### Notification Emails
- **Success/Failure notifications to**: sam@edw4rds.com
- **From**: reports@updates.edw4rds.com

### Nylas MCP (for future email features)
- **Configured account**: sam@edw4rds.com
- **Grant ID**: abbb1aaf-aa8d-4778-b5db-574205f4068a
- Note: Will take effect on next MCP restart

---

## 🎯 Benefits of New Setup

| Feature | Old Setup | New Setup |
|---------|-----------|-----------|
| **Location** | My Drive > Audits | Shared Drive (dedicated) |
| **Service Account Access** | Read/Move only | Full read/write/upload/delete |
| **Sync Method** | Manual rclone | Automated Python API |
| **Organization** | Single folder | Month-based folders through 2026 |
| **Collaboration** | Harder to share | Easy shared Drive access |
| **Automation** | Required manual setup | Fully automated sync |

---

## 📊 Migration Statistics

- **Folders created**: 73
- **Files migrated**: 15
- **Scripts created**: 1 (sync_from_drive.sh)
- **Scripts updated**: 1 (run_monthly_processing.sh)
- **Documentation pages**: 2 (SHARED_DRIVE_MIGRATION.md + GOOGLE_DRIVE_SERVICE_ACCOUNT.md)
- **Total documentation**: ~20KB
- **Test runs**: 1 complete successful workflow

---

## ✨ What's Different Now

### Before
1. Jennifer uploads to "Audits" folder
2. Manual rclone sync (or periodic cron)
3. Process local files
4. Email report

### After
1. Jennifer uploads to Shared Drive (month-specific folders)
2. **Auto-sync from Drive** ← NEW STEP
3. Process local files (same)
4. Email report (same)

**Key Improvement**: The sync is now part of the automated workflow and uses the Drive API directly instead of rclone.

---

## 🔧 Troubleshooting

### If sync fails:
```bash
# Test service account access
~/pdfplumber-env/bin/python3 /home/sam/mcp-servers/test-gdrive-service-account.py

# Manual sync
/home/sam/automations/commission_automator/sync_from_drive.sh 2025-08

# Check logs
tail -100 /home/sam/automations/commission_automator/logs/monthly_processing_*
```

### If files not found:
- Verify files are in correct month folder in shared Drive
- Check folder names match exactly: `YYYY-MM` format
- Ensure subfolders are named: `commission_statements` and `bank_statement`

### If email fails:
- Check Resend API key is valid
- Verify recipient email addresses
- Check logs for detailed error messages

---

## 📝 Next Steps (Future Enhancements)

- [ ] Set up email forwarding rules for Jennifer
- [ ] Create dashboard for viewing historical commission data
- [ ] Add automated backup of processed data
- [ ] Consider storing outputs back to Google Drive
- [ ] Add Slack notifications option

---

## ✅ Migration Status

**COMPLETE** - October 11, 2025

All systems operational with new shared Drive setup. Ready for September 2025 processing on the 15th.

---

*For detailed technical information, see:*
- *Migration Guide: [SHARED_DRIVE_MIGRATION.md](SHARED_DRIVE_MIGRATION.md)*
- *Service Account Docs: [/home/sam/mcp-servers/GOOGLE_DRIVE_SERVICE_ACCOUNT.md](/home/sam/mcp-servers/GOOGLE_DRIVE_SERVICE_ACCOUNT.md)*
