# Prompt for Next Claude Instance

## Context
We've completed migrating the commission automation system from the old "Audits" folder to a new Google Shared Drive. Jennifer needs to be informed about the change and given clear instructions on where to upload files going forward.

## Your Task
Draft and send an email to Jennifer explaining the new setup.

## Email Details

**To:** jennifer@mybenefitshelp.net
**CC:** sam@edw4rds.com
**Subject:** Updated: Commission Statement Upload Location - New Google Shared Drive

## Key Points to Include

1. **Apologize for the confusion** - Explain that the previous email (sent from angela@edw4rds.com) described the old "Audits" folder setup, but we've since upgraded to a better system.

2. **Explain the change** - We've moved to a dedicated Google Shared Drive for better automation and organization.

3. **Provide the new link:**
   - **Shared Drive Link:** https://drive.google.com/drive/folders/0AJ_IbKcKhFkyUk9PVA
   - Emphasize this is the ONLY location she should use going forward

4. **Upload instructions for each month:**
   - Navigate to the specific month folder (e.g., `2025-09/`)
   - Upload commission PDFs to `commission_statements/` subfolder
     - Allied.pdf, Beam.pdf, Guardian.pdf, Choice Builder.pdf, Cal Choice.pdf
     - If American Heritage statements exist, create `MyAccess/` subfolder inside commission_statements
   - Upload bank statement to `bank_statement/` subfolder
   - Master contacts CSV stays in `master_data/` folder (only update when needed)

5. **Emphasize the automation:**
   - System still runs automatically on the 15th of each month
   - Report still emails to her automatically
   - No action needed from her except uploading files to the new location

6. **Benefits of new setup:**
   - Better organized (month-based folders through 2026)
   - Easier to find historical data
   - More reliable automation

7. **Deadline reminder:**
   - Files should be uploaded by the 14th of each month
   - Automation runs on the 15th

## Tone
- Professional but friendly
- Clear and concise
- Apologetic about the confusion
- Reassuring that the process is still simple

## Before Sending
- Use Nylas MCP to send from sam@edw4rds.com
- Verify the grant ID is set to: `abbb1aaf-aa8d-4778-b5db-574205f4068a`
- If email sends from wrong account, note it and recommend restarting the MCP server

## Files for Reference
- Migration details: `/home/sam/automations/commission_automator/SHARED_DRIVE_MIGRATION.md`
- Session summary: `/home/sam/automations/commission_automator/SESSION_SUMMARY.md`
