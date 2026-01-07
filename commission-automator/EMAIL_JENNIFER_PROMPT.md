# Email Jennifer About New Commission Upload Location

## Context
We've successfully migrated the commission automation system from the old "Audits" folder to a new Google Shared Drive. Jennifer needs to be informed about this change and given clear instructions on where to upload files going forward.

## Background
- Previous email from angela@edw4rds.com described the OLD "Audits" folder setup
- We've since upgraded to a better system using a dedicated Google Shared Drive
- The automation still works the same way, just with a new upload location
- Grant ID `abbb1aaf-aa8d-4778-b5db-574205f4068a` is configured for sam@edw4rds.com

## Your Task
Draft and send an email to Jennifer explaining the new setup using the Nylas MCP server.

## Important Setup Notes
1. **MCP Server Configuration**: The Nylas MCP server should be configured in `/home/sam/.claude/mcp_servers.json`
2. **Permissions**: Verify that `mcp__*__send_*` is NOT in the deny list in `/home/sam/.claude/settings.json`
3. **Grant ID**: Always use `abbb1aaf-aa8d-4778-b5db-574205f4068a` (sam@edw4rds.com)
4. **Test First**: Send a test email to sam@edw4rds.com before sending to Jennifer

## Email Details

**To:** jennifer@mybenefitshelp.net
**CC:** sam@edw4rds.com
**Subject:** Updated: Commission Statement Upload Location - New Google Shared Drive

## Email Content Structure

### 1. Opening & Apology
- Apologize for any confusion
- Explain that the previous email from angela@edw4rds.com described the old "Audits" folder setup
- Mention we've upgraded to a better system

### 2. What's Changed
- We've migrated to a dedicated Google Shared Drive
- Better organization with month-based folders
- More reliable automation

### 3. New Upload Location (CRITICAL)
**Shared Drive Link:** https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA

⚠️ Emphasize this is the ONLY location to use going forward

### 4. Monthly Upload Instructions

For each month (e.g., "2025-09/"):

1. **Navigate to the month folder**
2. **Upload commission PDFs to `commission_statements/` subfolder:**
   - Allied.pdf
   - Beam.pdf
   - Guardian.pdf
   - Choice Builder.pdf
   - Cal Choice.pdf
   - If American Heritage statements exist, create `MyAccess/` subfolder inside commission_statements
3. **Upload bank statement to `bank_statement/` subfolder**
4. **Master contacts CSV** stays in `master_data/` folder (only update when needed)

### 5. Reassurance - Nothing Else Changes
- System still runs automatically on the 15th of each month
- Report still emails to her automatically
- No action needed except uploading files to the new location
- Files should be uploaded by the 14th of each month

### 6. Benefits of New Setup
- Better organized with pre-created monthly folders through 2026
- Easier to find historical data
- More reliable automation

### 7. Closing
- Offer to help if she has questions
- Thank her for patience during the transition
- Professional but friendly sign-off from Sam

## Nylas MCP Command

Use the `mcp__nylas__send_email` tool with these parameters:

```json
{
  "grant_id": "abbb1aaf-aa8d-4778-b5db-574205f4068a",
  "to": [{"email": "jennifer@mybenefitshelp.net"}],
  "cc": [{"email": "sam@edw4rds.com"}],
  "subject": "Updated: Commission Statement Upload Location - New Google Shared Drive",
  "body": "[Full email body as described above]"
}
```

## Testing Protocol

1. **First, send test email to sam@edw4rds.com** to verify it sends from the correct account
2. **Verify the "From" address** is sam@edw4rds.com (not angela@edw4rds.com)
3. **If it sends from wrong account:**
   - Note the issue
   - Recommend restarting Claude Code
   - Verify the grant_id in mcp_servers.json is correct
4. **Once confirmed working**, send the actual email to Jennifer

## Troubleshooting

### If `mcp__nylas__send_email` tool is not available:
1. Check `/home/sam/.claude/settings.json` - ensure `mcp__*__send_*` is NOT in deny list
2. Check `/home/sam/.claude/mcp_servers.json` exists and has Nylas configuration
3. Restart Claude Code completely (not just the window)
4. Verify the Nylas MCP server is built: `ls /home/sam/mcp-servers/nylas-mcp/dist/index.js`

### If email sends from wrong account:
1. Verify grant_id is `abbb1aaf-aa8d-4778-b5db-574205f4068a`
2. Restart Claude Code to reload MCP configuration
3. Check `/home/sam/mcp-servers/.env` - verify NYLAS_GRANT_ID is correct

## Reference Files
- Migration details: `/home/sam/automations/commission_automator/SHARED_DRIVE_MIGRATION.md`
- Session summary: `/home/sam/automations/commission_automator/SESSION_SUMMARY.md`
- Nylas documentation: `/home/sam/mcp-servers-docs/nylas-mcp.md`
- MCP config: `/home/sam/.claude/mcp_servers.json`
- Permissions: `/home/sam/.claude/settings.json`

## Full Email Template

```
Hi Jennifer,

I wanted to reach out about an important update to our commission statement upload process.

First, I apologize for any confusion. The previous email from angela@edw4rds.com described our old "Audits" folder setup, but we've since upgraded to a better system that will make everything more organized and reliable.

**What's Changed:**
We've migrated to a dedicated Google Shared Drive for the commission automation system. This new setup provides better organization with month-based folders and more reliable automation.

**IMPORTANT - New Upload Location:**
Please use this link for ALL future uploads:
https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA

This is the ONLY location you should use going forward.

**How to Upload Files Each Month:**

1. Navigate to the specific month folder (e.g., "2025-09/")
2. Upload commission PDFs to the "commission_statements/" subfolder:
   - Allied.pdf
   - Beam.pdf
   - Guardian.pdf
   - Choice Builder.pdf
   - Cal Choice.pdf
   - If you have American Heritage statements, create a "MyAccess/" subfolder inside commission_statements and place them there
3. Upload the bank statement to the "bank_statement/" subfolder
4. The master contacts CSV stays in the "master_data/" folder (only update when needed)

**Good News - Everything Else Stays the Same:**
- The system still runs automatically on the 15th of each month
- The report still emails to you automatically
- No action needed from you except uploading files to the new location
- Please continue to upload files by the 14th of each month

**Benefits of the New Setup:**
- Better organized with pre-created monthly folders through 2026
- Easier to find historical data
- More reliable automation

If you have any questions or run into any issues with the new setup, please don't hesitate to reach out.

Thank you for your patience during this transition!

Best regards,
Sam
```

## Success Criteria
- [ ] Test email sent to sam@edw4rds.com successfully
- [ ] Test email shows "From: sam@edw4rds.com" (not angela@edw4rds.com)
- [ ] Final email sent to jennifer@mybenefitshelp.net with CC to sam@edw4rds.com
- [ ] Email includes all key points listed above
- [ ] Email tone is professional, friendly, and apologetic for confusion
