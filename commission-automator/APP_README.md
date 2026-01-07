# Commission Automator - Application Status

**Last Updated:** October 21, 2025

## 📊 Application Overview

Automatically extracts commission data from insurance carrier PDF statements, matches group names to states using fuzzy matching, and generates summary reports. Now includes web upload portal for easy customer file submission.

---

## ✅ What's Working (Production Ready)

### **1. Core Processing Pipeline**
**Status:** ✅ 100% Complete and Tested

**What it does:**
- Processes 30+ PDFs from 6 carriers (Allied, Beam, Guardian, Cal Choice, Choice Builder, American Heritage Life)
- Extracts ~343 commission entries per month
- Fuzzy matches groups to states (96%+ accuracy)
- Generates 4 CSV reports
- Emails results automatically

**Location:** `/home/sam/chatbot-platform/mbh/commission-automator/src/`

**Scripts:**
- `extract_commissions.py` (28KB) - Main extraction with 6 carrier parsers
- `generate_state_summary.py` (4KB) - State aggregation
- `generate_report.py` (22KB) - Reconciliation and email

**Outputs:**
1. `commission_output.csv` - All entries with states (22KB)
2. `needs_review.csv` - Low confidence matches (2.8KB)
3. `state_summary.csv` - State totals and percentages (430B)
4. `reconciliation.csv` - Bank vs commission comparison (1.7KB)

**Test Results:**
- Total: $16,974.60 across 343 entries
- Top states: CA (52.57%), MO (14.20%), KS (6.59%)
- 100% state assignment coverage
- 21 states represented

### **2. Google Drive Sync**
**Status:** ✅ Working (Currently in Production)

**What it does:**
- Syncs PDFs from Google Shared Drive to server
- Automatically downloads commission statements and bank statements
- Organizes files by month

**Location:** `sync_from_drive.sh`

**Configuration:**
- Shared Drive ID: `0AJ_IbKcKhFkyUk9PVA`
- Service account: `/home/sam/mcp-servers/gdrive-service-account.json`
- Data directory: `/home/sam/commission_automator/data/mbh/`

**Folder structure:**
```
Google Drive: MBH/
  └── 2025-08/
      ├── commission_statements/   (30 PDFs)
      └── bank_statement/          (1 PDF)
```

### **3. Monthly Automation**
**Status:** ✅ Running via Cron

**Schedule:** 15th of each month at 9 AM

**Cron entry:**
```bash
0 9 15 * * /home/sam/chatbot-platform/mbh/commission-automator/run_monthly_processing.sh
```

**What it does:**
1. Syncs files from Google Drive
2. Extracts commissions
3. Generates state summary
4. Creates reconciliation report
5. Emails results to jennifer@mybenefitshelp.net

**Email includes:**
- commission_output.csv
- state_summary.csv
- reconciliation.csv

---

## 🆕 What's New (Just Built - Testing Needed)

### **4. Web Upload Portal**
**Status:** 🟡 Built, Not Yet Deployed

**Location:** `/home/sam/chatbot-platform/mbh/commission-automator/upload-portal/`

**What it does:**
- Web interface for drag-drop file uploads
- Two separate upload zones:
  - Commission statements (multiple PDFs)
  - Bank statement (single PDF)
- Automatically triggers processing after upload
- Emails results when complete

**Technology:**
- Node.js + Express
- Multer (file uploads)
- Beautiful HTML/CSS interface
- Runs on port 3020

**Customer workflow:**
1. Go to `http://server-ip:3020`
2. Select processing month
3. Drag all commission PDFs (bulk upload)
4. Drag bank statement PDF
5. Click "Upload & Process"
6. Receive email when done

**Why this was built:**
- Customer doesn't want to use Google Drive
- Emailing 30 PDFs individually is a pain
- OneDrive integration would take too long
- Web portal = best user experience

---

## 📋 Next Steps (Deployment Tasks)

### **Phase 1: Install & Test Upload Portal** (30 minutes)

**Tasks:**
1. ✅ Portal code created
2. ⏳ Install dependencies
   ```bash
   cd /home/sam/chatbot-platform/mbh/commission-automator/upload-portal
   npm install
   ```
3. ⏳ Test locally
   ```bash
   npm start
   # Opens on http://localhost:3020
   ```
4. ⏳ Upload test PDFs (use sample data from output/2025-08/)
5. ⏳ Verify files saved to correct directories
6. ⏳ Verify processing runs automatically
7. ⏳ Verify email sent successfully

### **Phase 2: Production Deployment** (30 minutes)

**Tasks:**
1. ⏳ Deploy with PM2
   ```bash
   pm2 start server.js --name "commission-upload-portal"
   pm2 save
   ```
2. ⏳ Configure firewall (open port 3020 or use reverse proxy)
3. ⏳ Optional: Set up domain (e.g., commissions.mbh.edw4rds.com)
4. ⏳ Optional: Add SSL certificate (HTTPS)
5. ⏳ Optional: Add password protection

### **Phase 3: Customer Onboarding** (15 minutes)

**Tasks:**
1. ⏳ Send customer the URL
2. ⏳ Walk through demo upload
3. ⏳ Document customer workflow
4. ⏳ Set up support contact

### **Phase 4: Deprecate Google Drive** (Optional)

**Tasks:**
1. ⏳ Migrate customer to web portal
2. ⏳ Remove Google Drive sync from cron (if no longer needed)
3. ⏳ Keep sync script as backup option

---

## 🗂️ Directory Structure

```
/home/sam/chatbot-platform/mbh/commission-automator/
├── src/                              # Processing scripts
│   ├── extract_commissions.py        # Main extraction (6 carriers)
│   ├── generate_state_summary.py     # State aggregation
│   └── generate_report.py            # Reconciliation + email
│
├── upload-portal/                    # 🆕 Web interface
│   ├── server.js                     # Express server
│   ├── package.json                  # Dependencies
│   ├── .env                          # Config (PORT=3020)
│   ├── README.md                     # Portal documentation
│   └── public/
│       └── index.html                # Upload interface
│
├── output/                           # Generated reports
│   └── {YYYY-MM}/                    # Month-specific outputs
│       ├── commission_output.csv
│       ├── needs_review.csv
│       ├── state_summary.csv
│       └── reconciliation.csv
│
├── logs/                             # Processing logs
│   ├── extraction_*.log
│   ├── monthly_processing_*.log
│   └── cron.log
│
├── data/                             # Empty (actual data in ~/commission_automator/)
├── brand_assets/                     # Carrier logos/branding
├── venv/                             # Python virtual environment
│
├── sync_from_drive.sh                # Google Drive sync
├── run_monthly_processing.sh         # Main automation script
├── retrieve_brand_assets.sh          # Download carrier assets
├── check_folder_access.py            # Drive permissions check
├── get_brand_assets.py               # Asset downloader
├── generate_brand_config.py          # Brand config generator
│
├── README.md                         # Original technical docs
├── AUTOMATION.md                     # Automation setup guide
└── APP_README.md                     # 👈 This file (status tracker)
```

**Note:** Data files actually stored in `/home/sam/commission_automator/data/mbh/` for historical reasons.

---

## 🔧 Configuration

### **Email Settings** (in generate_report.py)
```python
FROM_EMAIL = "reports@updates.edw4rds.com"
TO_EMAIL = "jennifer@mybenefitshelp.net"
RESEND_API_KEY = "re_JgqiiJdh_5SBPNDVZEmK5acfWdp2kLm8M"
```

### **Python Environment**
```bash
PYTHON_PATH = "/home/sam/pdfplumber-env/bin/python3"
```

### **Data Directories**
```bash
BASE_DATA_DIR = "/home/sam/commission_automator/data/mbh"
# Structure: {BASE_DATA_DIR}/{YYYY-MM}/commission_statements/
#            {BASE_DATA_DIR}/{YYYY-MM}/bank_statement/
#            {BASE_DATA_DIR}/master_data/mbh master contacts list.csv
```

### **Upload Portal**
```bash
PORT = 3020 (default)
```

---

## 🎯 Success Metrics

### **Current Performance:**
- ✅ 343 entries processed per month
- ✅ 6 carriers supported (100% coverage)
- ✅ 96%+ state matching accuracy
- ✅ 100% state assignment (no blanks)
- ✅ ~$17K monthly commissions tracked
- ✅ Zero API costs (dedicated extractors)

### **Future Goals:**
- 🎯 Sub-5 minute customer upload time (web portal)
- 🎯 Zero manual intervention required
- 🎯 Same-day processing turnaround

---

## 🐛 Known Issues

1. **needs_review.csv not emailed**
   - Currently 40 entries (11.7%) need manual review
   - File saved locally but not sent in email
   - Low priority - these are borderline fuzzy matches

2. **Data directory split**
   - Code in `/home/sam/chatbot-platform/mbh/commission-automator/`
   - Data in `/home/sam/commission_automator/data/mbh/`
   - Works fine, just confusing organization

3. **No duplicate month detection**
   - System doesn't prevent processing same month twice
   - Could create duplicate entries if run multiple times

---

## 📞 Support & Maintenance

### **Logs Location:**
```bash
/home/sam/chatbot-platform/mbh/commission-automator/logs/
```

### **View Recent Logs:**
```bash
tail -f /home/sam/chatbot-platform/mbh/commission-automator/logs/*.log
```

### **Cron Status:**
```bash
crontab -l | grep commission
```

### **Manual Run:**
```bash
cd /home/sam/chatbot-platform/mbh/commission-automator
./run_monthly_processing.sh 2025-08
```

### **Web Portal Status (when deployed):**
```bash
pm2 list
pm2 logs commission-upload-portal
```

---

## 🔐 Security Considerations

### **Current State:**
- ✅ Service account auth for Google Drive (secure)
- ✅ Email via Resend API (secure)
- ⚠️ Web portal has NO authentication (pending deployment)

### **Before Public Deployment:**
- [ ] Add password protection to upload portal
- [ ] Set up HTTPS/SSL certificate
- [ ] Configure firewall rules
- [ ] Add rate limiting
- [ ] Consider IP whitelist

---

## 📚 Related Documentation

- **Technical README:** `README.md` (original, comprehensive)
- **Portal Setup:** `upload-portal/README.md` (deployment guide)
- **Automation Guide:** `AUTOMATION.md` (cron setup)
- **Email Prompts:** `EMAIL_JENNIFER_PROMPT.md`

---

## 🚀 Quick Commands

```bash
# Test processing manually
/home/sam/pdfplumber-env/bin/python3 src/extract_commissions.py --month 2025-08
/home/sam/pdfplumber-env/bin/python3 src/generate_state_summary.py --month 2025-08
/home/sam/pdfplumber-env/bin/python3 src/generate_report.py --month 2025-08

# Start upload portal (development)
cd upload-portal && npm start

# Start upload portal (production)
cd upload-portal && pm2 start server.js --name commission-upload-portal

# View outputs
ls -lh output/2025-08/

# Check cron
crontab -l

# View Drive sync status
./sync_from_drive.sh 2025-08
```

---

## 📈 Version History

- **v1.0** (Oct 10, 2025) - Initial release with 6 carrier extractors
- **v1.1** (Oct 11, 2025) - Added monthly automation via cron
- **v1.2** (Oct 21, 2025) - Moved to MBH directory, updated all paths
- **v1.3** (Oct 21, 2025) - **Built web upload portal** ⭐ NEW

---

**Status:** Ready for upload portal deployment and testing.
**Next Action:** Install dependencies and test upload portal locally.
