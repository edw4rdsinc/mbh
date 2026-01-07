# Google Shared Drive Migration

## Overview

The commission automation system has been migrated from the old "Audits" folder to a new Google Shared Drive to enable full API access and automation capabilities.

## What Changed

### Old Setup
- **Location**: `My Drive > Audits` folder
- **Limitations**: Service account had read/move permissions only (no upload)
- **Sync Method**: Manual rclone configuration

### New Setup
- **Location**: Shared Drive (ID: `0AJ_IbKcKhFkyUk9PVA`)
- **Permissions**: Full read/write/upload/delete access for service account
- **Sync Method**: Automated Python-based sync using Drive API
- **Link**: https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA

## Folder Structure

```
Shared Drive (0AJ_IbKcKhFkyUk9PVA)/
├── master_data/
│   └── mbh master contacts list.csv
│
├── 2025-01/
│   ├── commission_statements/
│   └── bank_statement/
│
├── 2025-02/
│   ├── commission_statements/
│   └── bank_statement/
│
... (continues through 2025-12)
│
├── 2026-01/
│   ├── commission_statements/
│   └── bank_statement/
│
... (continues through 2026-12)
```

**Total Folders**: 73 (1 master_data + 24 months + 48 subfolders)

## Folder IDs

Key folder IDs for reference:

- **Shared Drive Root**: `0AJ_IbKcKhFkyUk9PVA`
- **master_data**: `1SKTIq24dO4bdzmvn7dB5uD8uuAUOfUlW`
- **2025-08**: `1BHmoogtLCmgG9PcLdUKnETskLnhF6Icn`
  - **commission_statements**: `1jBggZe68P7I_OF3KJpv6aysifmuBZQb3`
  - **bank_statement**: `1FgAbq2xGfKnf4X1gjM0sO9iEdAgz8tL_`

## Migration Process

### 1. Setup Complete (Oct 10, 2025)
✅ Created Google Cloud Service Account
✅ Shared Drive with service account
✅ Created all 73 folders in shared Drive
✅ Copied August 2025 files (15 PDFs + 1 CSV)
✅ Created sync script ([sync_from_drive.sh](sync_from_drive.sh))
✅ Updated automation script to sync before processing
✅ Tested complete workflow successfully

### 2. Files Migrated
All August 2025 files successfully copied:
- 5 carrier PDFs (Allied, Beam, Guardian, Choice Builder, Cal Choice)
- 8 MyAccess PDFs (American Heritage statements)
- 1 bank statement PDF
- 1 master contacts CSV

## How It Works

### Monthly Automation Flow

1. **Sync from Drive** (Step 0 - NEW)
   - Script: `sync_from_drive.sh`
   - Downloads PDFs from `shared_drive/{MONTH}/commission_statements/`
   - Downloads bank statement from `shared_drive/{MONTH}/bank_statement/`
   - Downloads master CSV from `shared_drive/master_data/`
   - Saves to local VPS: `/home/sam/commission_automator/data/mbh/{MONTH}/`

2. **Extract Commissions** (Step 1)
   - Script: `extract_commissions.py`
   - Reads local PDFs from VPS
   - Outputs: `commission_output.csv`, `needs_review.csv`

3. **Generate State Summary** (Step 2)
   - Script: `generate_state_summary.py`
   - Creates state-by-state breakdown

4. **Generate Report** (Step 3)
   - Script: `generate_report.py`
   - Reconciles with bank statement
   - Sends email to Jennifer

### Key Scripts

#### sync_from_drive.sh
```bash
# Usage: ./sync_from_drive.sh [YYYY-MM]
# Downloads all files for a specific month from shared Drive
# Uses Google Drive API via service account (no OAuth)

./sync_from_drive.sh 2025-08
```

#### run_monthly_processing.sh
```bash
# Complete automation (runs on 15th of month via cron)
# Usage: ./run_monthly_processing.sh [YYYY-MM]

# Auto-detect previous month:
./run_monthly_processing.sh

# Manual month:
./run_monthly_processing.sh 2025-08
```

## Service Account

**Email**: `drive-master@mcp-g-drive-474704.iam.gserviceaccount.com`
**Project**: `mcp-g-drive-474704`
**Credentials**: `/home/sam/mcp-servers/gdrive-service-account.json`
**Scope**: `https://www.googleapis.com/auth/drive` (full access)

The service account has Editor permissions on the entire shared Drive.

## File Upload Instructions for Jennifer

Jennifer should upload files to the shared Drive at:
https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA

### For Each Month (e.g., 2025-09):

1. Navigate to the month folder (e.g., `2025-09/`)
2. Upload commission statements:
   - Go to `commission_statements/` folder
   - Upload carrier PDFs: Allied, Beam, Guardian, Choice Builder, Cal Choice
   - If American Heritage statements exist:
     - Create `MyAccess/` subfolder
     - Upload American Heritage PDFs there

3. Upload bank statement:
   - Go to `bank_statement/` folder
   - Upload the monthly USB bank statement PDF

### Master Contacts List:
- Located in `master_data/` folder
- Only needs updating when new groups/states change
- Filename: `mbh master contacts list.csv`

## Automation Schedule

The automation runs automatically on the **15th of each month** at 2:00 AM PST.

**Cron job**:
```bash
0 2 15 * * /home/sam/automations/commission_automator/run_monthly_processing.sh
```

To run manually:
```bash
# Process previous month
/home/sam/automations/commission_automator/run_monthly_processing.sh

# Process specific month
/home/sam/automations/commission_automator/run_monthly_processing.sh 2025-09
```

## Outputs

All outputs are saved to:
```
/home/sam/automations/commission_automator/output/{MONTH}/
├── commission_output.csv          # Main commission data with states
├── needs_review.csv               # Low-confidence matches (if any)
└── state_summary_by_carrier.csv   # State-by-state breakdown
```

**Email Report** is sent to:
- Primary: `jennifer@mybenefitshelp.net`
- CC: `sam@edw4rds.com`

## Logs

Processing logs are saved to:
```
/home/sam/automations/commission_automator/logs/
├── monthly_processing_{MONTH}_{TIMESTAMP}.log
└── extraction_{TIMESTAMP}.log
```

## Benefits of New Setup

✅ **Full API Access**: Can upload, delete, move files programmatically
✅ **No Manual Sync**: Automatic download from Drive before processing
✅ **Better Organization**: Month-based folders for 2025-2026
✅ **Easier Sharing**: Shared Drive easier for multiple collaborators
✅ **Future-Proof**: Room for 24 months of data (through 2026-12)
✅ **Robust Error Handling**: Email notifications on sync/processing failures

## Troubleshooting

### Sync Failed
```bash
# Check service account credentials
ls -la /home/sam/mcp-servers/gdrive-service-account.json

# Test Drive access
~/pdfplumber-env/bin/python3 /home/sam/mcp-servers/test-gdrive-service-account.py

# Manual sync
/home/sam/automations/commission_automator/sync_from_drive.sh 2025-08
```

### Files Not Found
```bash
# Verify month folder exists in shared Drive
# Link: https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA

# Check logs
tail -100 /home/sam/automations/commission_automator/logs/monthly_processing_*
```

### Permission Denied
- Ensure service account email has Editor access to shared Drive
- Check that files were uploaded to correct month folder
- Verify folder IDs match in sync script

## Migration Completion Date

**October 11, 2025** - All systems operational with new shared Drive setup.

---

*For technical details about the service account, see: [/home/sam/mcp-servers/GOOGLE_DRIVE_SERVICE_ACCOUNT.md](/home/sam/mcp-servers/GOOGLE_DRIVE_SERVICE_ACCOUNT.md)*
