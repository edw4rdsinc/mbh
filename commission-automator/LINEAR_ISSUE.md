# Linear Issue: Deploy Commission Upload Portal

**Copy this content to create a Linear issue**

---

## Title
Deploy Commission Upload Portal for MBH

## Description

Web portal has been built to replace Google Drive file submission for monthly commission processing. Need to install dependencies, test, and deploy to production.

### Background
- Customer doesn't want to use Google Drive
- Needs to upload ~30 commission PDFs + 1 bank statement PDF per month
- Web portal provides drag-drop interface with automatic processing

### What's Built
✅ Express server with file upload handling
✅ Beautiful HTML/CSS drag-drop interface
✅ Automatic processing trigger (runs Python scripts)
✅ Email notification on completion
✅ Documentation and README

### What's Needed
⏳ Install Node.js dependencies
⏳ Test with sample data
⏳ Deploy to production with PM2
⏳ Configure networking (port/domain)
⏳ Customer onboarding

---

## Acceptance Criteria

**Phase 1: Local Testing** ✅
- [ ] Dependencies installed (`npm install`)
- [ ] Server starts successfully on port 3020
- [ ] Can access web interface at http://localhost:3020
- [ ] Can upload test PDFs (commission + bank statement)
- [ ] Files saved to correct directories
- [ ] Python processing runs automatically
- [ ] Email sent with CSV attachments

**Phase 2: Production Deployment** 🚀
- [ ] Deployed with PM2 (`pm2 start server.js`)
- [ ] Service auto-restarts on failure
- [ ] Port 3020 accessible (or configured reverse proxy)
- [ ] Optional: Domain configured (e.g., commissions.mbh.edw4rds.com)
- [ ] Optional: SSL certificate installed (HTTPS)
- [ ] Optional: Password protection added

**Phase 3: Customer Onboarding** 👤
- [ ] Customer has access URL
- [ ] Customer tested upload workflow
- [ ] Customer received test email successfully
- [ ] Support documentation shared

---

## Technical Details

### Location
`/home/sam/chatbot-platform/mbh/commission-automator/upload-portal/`

### Stack
- Node.js + Express
- Multer (file uploads)
- HTML/CSS/Vanilla JS frontend
- Python processing scripts (existing)

### Install Command
```bash
cd /home/sam/chatbot-platform/mbh/commission-automator/upload-portal
npm install
```

### Start Command
```bash
# Development
npm start

# Production
pm2 start server.js --name commission-upload-portal
pm2 save
```

### Port
3020 (configurable in `.env`)

### Processing Flow
1. Customer uploads PDFs via web
2. Files saved to `/home/sam/commission_automator/data/mbh/{month}/`
3. Backend runs 3 Python scripts:
   - `extract_commissions.py`
   - `generate_state_summary.py`
   - `generate_report.py`
4. Email sent to jennifer@mybenefitshelp.net with 3 CSV attachments

---

## Files Modified/Created

**New files:**
- `upload-portal/server.js` (Express server)
- `upload-portal/package.json` (dependencies)
- `upload-portal/public/index.html` (web interface)
- `upload-portal/.env` (configuration)
- `upload-portal/README.md` (setup guide)

**Updated files:**
- `APP_README.md` (comprehensive status doc)

---

## Testing Checklist

### Local Testing
1. Start server: `cd upload-portal && npm start`
2. Open browser: http://localhost:3020
3. Select month: "2025-08"
4. Upload commission PDFs (can reuse existing from `output/2025-08/`)
5. Upload bank statement PDF
6. Click "Upload & Process"
7. Check terminal for processing logs
8. Verify files in `/home/sam/commission_automator/data/mbh/2025-08/`
9. Check email received at jennifer@mybenefitshelp.net
10. Verify CSV attachments are correct

### Production Testing
1. Access via server IP/domain
2. Complete upload workflow
3. Monitor PM2 logs: `pm2 logs commission-upload-portal`
4. Check processing completes successfully
5. Verify email delivery
6. Test error handling (upload without bank statement, etc.)

---

## Documentation

**Main docs:** `/home/sam/chatbot-platform/mbh/commission-automator/APP_README.md`
**Portal setup:** `/home/sam/chatbot-platform/mbh/commission-automator/upload-portal/README.md`

---

## Dependencies

### Node.js Packages (to be installed)
- express@^4.18.2
- multer@^1.4.5-lts.1
- dotenv@^16.3.1

### System Requirements
- Node.js (already installed)
- Python 3 with pdfplumber (already installed)
- Existing commission processing scripts (already working)

---

## Security Considerations

### Current State
- No authentication (anyone with URL can upload)
- HTTP only (no HTTPS)
- No rate limiting

### Recommendations
**For internal use (current):**
- ✅ Current setup is fine
- Run on internal network or VPN

**For public internet:**
- Add password protection
- Install SSL certificate (HTTPS)
- Add rate limiting
- Consider IP whitelist

---

## Estimated Time

- **Install & Test:** 30 minutes
- **Production Deploy:** 30 minutes
- **Customer Onboarding:** 15 minutes
- **Total:** ~1.5 hours

---

## Priority
High - Customer actively needs this for monthly workflow

## Labels
- `mbh`
- `automation`
- `deployment`
- `commission-processing`

## Project
MBH Automation Tools

## Assignee
(Assign to person handling deployment)

---

## Notes

- Portal replaces Google Drive sync workflow
- Google Drive sync still available as backup option
- Monthly cron still runs on 15th (can be adjusted after portal is live)
- Processing scripts unchanged (just different file input method)

## Related Issues
- Original commission automator build (completed Oct 10)
- MBH directory reorganization (completed Oct 21)

---

**Created:** October 21, 2025
**Status:** Ready for deployment
**Blocked by:** None
