# Catch Up Prompt - Commission Automator Status

## What You Need to Know

We just finished configuring the Nylas email settings to enable sending emails from Claude Code. Here's where things stand:

---

## Recent Changes (Just Completed)

### 1. Email Permissions Fixed
- **File Modified**: `/home/sam/.claude/settings.json`
- **Changes Made**:
  - ✅ Added `"mcp__*__send_*"` to the allow list (line 18)
  - ✅ Removed `"mcp__resend__*"` from the deny list
- **Status**: User needs to restart Claude Code for changes to take effect

### 2. Nylas Configuration (Already Set Up Previously)
- **Grant ID**: `abbb1aaf-aa8d-4778-b5db-574205f4068a` (sam@edw4rds.com)
- **Configured in**:
  - `/home/sam/.claude/mcp_servers.json` (line 8)
  - `/home/sam/mcp-servers/.env` (line 36)
- **API Key**: Configured and ready

---

## What Needs to Happen Next

### Immediate Task: Send Email to Jennifer

Jennifer needs to be notified about the Google Shared Drive migration that was completed on October 11, 2025.

**Email Details:**
- **To**: jennifer@mybenefitshelp.net
- **CC**: sam@edw4rds.com
- **Subject**: Updated: Commission Statement Upload Location - New Google Shared Drive

**Purpose**: Inform her to stop using the old "Audits" folder and start using the new Shared Drive location.

**Important Context**:
- A previous email from angela@edw4rds.com described the OLD setup
- We've since migrated to a new Google Shared Drive
- This email should apologize for confusion and provide new instructions

**Reference Templates**:
- Full template: `/home/sam/automations/commission_automator/EMAIL_JENNIFER_PROMPT.md`
- Alternative: `/home/sam/automations/commission_automator/EMAIL_TO_JENNIFER_PROMPT.md`

### Steps to Complete:

1. **Verify User Restarted Claude Code**
   - Ask if they've restarted yet
   - If not, remind them to restart for permission changes to take effect

2. **Test Nylas Email Functionality**
   - Send a test email to sam@edw4rds.com first
   - Verify it sends from sam@edw4rds.com (not angela@edw4rds.com)
   - Use tool: `mcp__nylas__send_email` with grant_id `abbb1aaf-aa8d-4778-b5db-574205f4068a`

3. **Send Email to Jennifer**
   - Once test succeeds, send the actual email
   - Use the template from EMAIL_JENNIFER_PROMPT.md
   - Key points to include:
     - Apologize for confusion about old "Audits" folder email
     - Provide new Shared Drive link: https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA
     - Explain monthly upload process (upload to month-specific folders)
     - Reassure that automation still runs on 15th of each month
     - Files should be uploaded by 14th

---

## System Overview (For Context)

### What This System Does
The **Commission Statement Automator** processes insurance commission PDFs monthly:
- Extracts commission data from 6 carrier types
- Matches groups to states using fuzzy matching
- Generates reports and reconciles with bank statements
- Emails results to jennifer@mybenefitshelp.net
- Runs automatically on the 15th of each month at 2:00 AM

### Recent Migration (Oct 11, 2025)
- **From**: My Drive > Audits folder (limited permissions)
- **To**: Google Shared Drive (ID: `0AJ_IbKcKhFkyUk9PVA`)
- **Why**: Service account now has full read/write/upload/delete access
- **Impact**: Better automation, month-based organization through 2026

### Key Files
- Main automation: `/home/sam/automations/commission_automator/run_monthly_processing.sh`
- Sync script: `/home/sam/automations/commission_automator/sync_from_drive.sh`
- Documentation:
  - `/home/sam/automations/commission_automator/README.md` - Technical docs
  - `/home/sam/automations/commission_automator/AUTOMATION.md` - Automation guide
  - `/home/sam/automations/commission_automator/SHARED_DRIVE_MIGRATION.md` - Migration details
  - `/home/sam/automations/commission_automator/SESSION_SUMMARY.md` - Oct 11 session log

---

## Quick Commands

### Test Nylas Email
```bash
# After Claude Code restart, try sending test email via MCP tool
# Tool: mcp__nylas__send_email
# Grant ID: abbb1aaf-aa8d-4778-b5db-574205f4068a
```

### Manual Processing (if needed)
```bash
# Process specific month
/home/sam/automations/commission_automator/run_monthly_processing.sh 2025-09

# Just sync files from Drive
/home/sam/automations/commission_automator/sync_from_drive.sh 2025-09
```

### Check Logs
```bash
tail -100 /home/sam/automations/commission_automator/logs/monthly_processing_*
```

---

## Current Blockers

**None** - Everything is configured and ready. Just waiting for:
1. User to restart Claude Code
2. Send test email to verify Nylas works
3. Send actual email to Jennifer

---

## Success Criteria

- [ ] User confirms Claude Code was restarted
- [ ] Test email sent to sam@edw4rds.com successfully
- [ ] Test email shows "From: sam@edw4rds.com"
- [ ] Final email sent to jennifer@mybenefitshelp.net (CC: sam@edw4rds.com)
- [ ] Email includes new Shared Drive link and upload instructions

---

## If Something Goes Wrong

### Nylas MCP tools not available
- Check `/home/sam/.claude/mcp_servers.json` - verify Nylas is configured
- Check `/home/sam/.claude/settings.json` - verify `mcp__*__send_*` is in allow list
- Restart Claude Code again
- Check MCP server is built: `ls /home/sam/mcp-servers/nylas-mcp/dist/index.js`

### Email sends from wrong account
- Verify grant_id is `abbb1aaf-aa8d-4778-b5db-574205f4068a` in the tool call
- Check `/home/sam/mcp-servers/.env` line 36 has correct NYLAS_GRANT_ID
- Restart Claude Code to reload config

### Can't find email templates
- Full template with Nylas setup: `/home/sam/automations/commission_automator/EMAIL_JENNIFER_PROMPT.md`
- Simpler prompt version: `/home/sam/automations/commission_automator/EMAIL_TO_JENNIFER_PROMPT.md`

---

## Timeline

- **Oct 10, 2025**: Initial commission automation system built
- **Oct 11, 2025**: Migrated to Google Shared Drive
- **Oct 11, 2025**: Updated Nylas grant ID to sam@edw4rds.com
- **Today**: Fixed email permissions in settings.json
- **Next**: Send notification email to Jennifer

---

**Last Updated**: Just now (current session)
**Priority**: Medium - Jennifer needs to know about new upload location before next month's processing
**Urgency**: Not critical - automation will still work, but Jennifer should be informed soon
