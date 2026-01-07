#!/bin/bash
###############################################################################
# Monthly Commission Processing Automation
# Runs on the 15th of each month to process previous month's data
###############################################################################

set -e  # Exit on error

# Configuration
PYTHON="/home/sam/pdfplumber-env/bin/python3"
SRC_DIR="/home/sam/chatbot-platform/mbh/commission-automator/src"
SYNC_SCRIPT="/home/sam/chatbot-platform/mbh/commission-automator/sync_from_drive.sh"
LOG_DIR="/home/sam/chatbot-platform/mbh/commission-automator/logs"
ADMIN_EMAIL="sam@edw4rds.com"
RESEND_API_KEY="re_JgqiiJdh_5SBPNDVZEmK5acfWdp2kLm8M"

# Calculate previous month (YYYY-MM format)
if [ -z "$1" ]; then
    # Auto-detect previous month
    PROCESS_MONTH=$(date -d "last month" +%Y-%m)
    echo "Auto-detected processing month: $PROCESS_MONTH"
else
    # Use manually specified month
    PROCESS_MONTH="$1"
    echo "Processing specified month: $PROCESS_MONTH"
fi

# Create timestamped log file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/monthly_processing_${PROCESS_MONTH}_${TIMESTAMP}.log"
mkdir -p "$LOG_DIR"

# Function to send error notification email
send_error_notification() {
    local error_message="$1"
    local error_log="$2"

    echo "Sending error notification to $ADMIN_EMAIL..."

    # Create JSON payload for Resend API
    cat > /tmp/error_email.json <<EOF
{
  "from": "reports@updates.edw4rds.com",
  "to": ["$ADMIN_EMAIL"],
  "subject": "❌ Commission Processing FAILED - $PROCESS_MONTH",
  "html": "<html><body style='font-family: Arial, sans-serif;'><h2 style='color: #e74c3c;'>Commission Processing Failed</h2><p><strong>Month:</strong> $PROCESS_MONTH</p><p><strong>Date:</strong> $(date)</p><p><strong>Error:</strong></p><pre style='background: #f5f5f5; padding: 15px; border-left: 4px solid #e74c3c;'>$error_message</pre><p><strong>Recent Log Output:</strong></p><pre style='background: #f5f5f5; padding: 15px; border: 1px solid #ddd; max-height: 300px; overflow-y: auto;'>$error_log</pre><p>Please check the logs and retry manually if needed.</p></body></html>"
}
EOF

    curl -X POST 'https://api.resend.com/emails' \
        -H "Authorization: Bearer $RESEND_API_KEY" \
        -H 'Content-Type: application/json' \
        -d @/tmp/error_email.json

    rm -f /tmp/error_email.json
}

# Function to log with timestamp
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Start processing
log "=========================================="
log "Monthly Commission Processing Started"
log "Month: $PROCESS_MONTH"
log "=========================================="

# Trap errors and send notification
trap 'ERROR_MSG="Script failed at line $LINENO"; ERROR_LOG=$(tail -50 "$LOG_FILE"); send_error_notification "$ERROR_MSG" "$ERROR_LOG"; exit 1' ERR

# Step 0: Sync files from Google Drive
log "Step 0: Syncing files from Google Drive..."
if ! "$SYNC_SCRIPT" "$PROCESS_MONTH" >> "$LOG_FILE" 2>&1; then
    ERROR_MSG="Google Drive sync failed for $PROCESS_MONTH"
    ERROR_LOG=$(tail -50 "$LOG_FILE")
    send_error_notification "$ERROR_MSG" "$ERROR_LOG"
    exit 1
fi
log "✓ Files synced from Drive"

# Step 1: Extract commissions
log "Step 1: Extracting commission data..."
if ! $PYTHON "$SRC_DIR/extract_commissions.py" --month "$PROCESS_MONTH" >> "$LOG_FILE" 2>&1; then
    ERROR_MSG="Commission extraction failed for $PROCESS_MONTH"
    ERROR_LOG=$(tail -50 "$LOG_FILE")
    send_error_notification "$ERROR_MSG" "$ERROR_LOG"
    exit 1
fi
log "✓ Commission extraction completed"

# Step 2: Generate state summary
log "Step 2: Generating state summary..."
if ! $PYTHON "$SRC_DIR/generate_state_summary.py" --month "$PROCESS_MONTH" >> "$LOG_FILE" 2>&1; then
    ERROR_MSG="State summary generation failed for $PROCESS_MONTH"
    ERROR_LOG=$(tail -50 "$LOG_FILE")
    send_error_notification "$ERROR_MSG" "$ERROR_LOG"
    exit 1
fi
log "✓ State summary generated"

# Step 3: Generate and send report
log "Step 3: Generating reconciliation report and sending email..."
if ! $PYTHON "$SRC_DIR/generate_report.py" --month "$PROCESS_MONTH" >> "$LOG_FILE" 2>&1; then
    ERROR_MSG="Report generation/email failed for $PROCESS_MONTH"
    ERROR_LOG=$(tail -50 "$LOG_FILE")
    send_error_notification "$ERROR_MSG" "$ERROR_LOG"
    exit 1
fi
log "✓ Report generated and emailed"

# Success!
log "=========================================="
log "Monthly Commission Processing Completed Successfully"
log "All outputs saved to: /home/sam/chatbot-platform/mbh/commission-automator/output/$PROCESS_MONTH/"
log "=========================================="

# Send success notification
log "Sending success notification..."
cat > /tmp/success_email.json <<EOF
{
  "from": "reports@updates.edw4rds.com",
  "to": ["$ADMIN_EMAIL"],
  "subject": "✅ Commission Processing Complete - $PROCESS_MONTH",
  "html": "<html><body style='font-family: Arial, sans-serif;'><h2 style='color: #27ae60;'>Commission Processing Successful</h2><p><strong>Month:</strong> $PROCESS_MONTH</p><p><strong>Completed:</strong> $(date)</p><p>The monthly commission processing completed successfully. Report has been sent to jennifer@mybenefitshelp.net.</p><p><strong>Outputs:</strong></p><ul><li>Commission data extracted</li><li>State summary generated</li><li>Bank reconciliation completed</li><li>Email report sent</li></ul></body></html>"
}
EOF

curl -X POST 'https://api.resend.com/emails' \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H 'Content-Type: application/json' \
    -d @/tmp/success_email.json >> "$LOG_FILE" 2>&1

rm -f /tmp/success_email.json

log "✓ Success notification sent to $ADMIN_EMAIL"
log "Processing complete!"

exit 0
