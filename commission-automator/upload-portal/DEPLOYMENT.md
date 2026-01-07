# Commission Portal - Interactive Review System

## 🚀 Quick Start

### Development Mode
```bash
# Start interactive mode
./start-interactive.sh

# Or start with PM2 (recommended)
pm2 start ecosystem.config.js
```

### Production Deployment
```bash
# Deploy with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs commission-portal-interactive

# Restart after changes
pm2 restart commission-portal-interactive

# Stop
pm2 stop commission-portal-interactive
```

## 🔄 Switching Modes

### Interactive Mode (with review)
```bash
# Use interactive server and UI
cp server-interactive.js server.js
cp public/index-interactive.html public/index.html
pm2 restart commission-portal-interactive
```

### Classic Mode (no review)
```bash
# Use original server and UI
cp server-original.js server.js
cp public/index-original.html public/index.html
pm2 restart commission-portal-interactive
```

## 📊 How It Works

### Interactive Review Flow

1. **Upload Phase**
   - User uploads commission PDFs and bank statement
   - Files are saved to `/home/sam/commission_automator/data/mbh/{month}/`

2. **Extraction Phase**
   - System extracts commission data from PDFs
   - Performs fuzzy matching against master contact list
   - Categorizes by confidence level:
     - **High (80-100%)**: Auto-matched
     - **Medium (60-79%)**: Needs review
     - **Low (<60%)**: Requires manual review

3. **Interactive Review Phase**
   - WebSocket connection established
   - User presented with fuzzy matches one at a time
   - Options for each match:
     - ✅ Confirm the suggested state
     - 🔄 Change to different state
     - ⏭️ Skip (use best guess)
     - 🚀 Auto-approve all remaining

4. **Learning Phase**
   - User corrections saved to `~/.commission_learning.json`
   - Future uploads automatically apply learned corrections
   - System gets smarter over time

5. **Report Generation**
   - Generates final CSV with all corrections applied
   - Creates state summary report
   - Emails results to configured recipient

## 🧠 Smart Learning

The system remembers your corrections:
- Stores in `~/.commission_learning.json`
- Format: `{"Company Name": "State"}`
- Applied automatically on future uploads
- Reduces review needs over time

## 📁 File Structure

```
upload-portal/
├── server.js               # Active server (copy of chosen mode)
├── server-original.js      # Classic server (no review)
├── server-interactive.js   # Interactive server (with review)
├── public/
│   ├── index.html         # Active UI (copy of chosen mode)
│   ├── index-original.html # Classic UI
│   ├── index-interactive.html # Interactive UI
│   └── review.html        # Review prototype (reference)
├── ecosystem.config.js    # PM2 configuration
├── start-interactive.sh   # Quick start script
└── package.json          # Dependencies

../src/
├── extract_commissions.py # Main extraction logic
├── interactive_processor.py # Interactive processor (Python)
├── generate_state_summary.py # State report generator
└── generate_report.py     # Final report & email
```

## 🔌 WebSocket API

### Client → Server Messages

```javascript
// Start processing
{
  type: 'start_processing',
  month: '2025-10'
}

// Review response
{
  type: 'review_response',
  action: 'confirm' | 'change' | 'skip',
  state: 'CA',
  new_state: 'TX',  // if action is 'change'
  remember: true    // save to learning DB
}

// Auto-approve all
{
  type: 'auto_approve_all'
}
```

### Server → Client Messages

```javascript
// Status update
{
  type: 'status',
  message: 'Processing...',
  phase: 'extraction' | 'matching' | 'review_needed' | 'complete',
  progress: 75,
  stats: { ... }
}

// Review request
{
  type: 'review_request',
  item: {
    id: 'unique_id',
    carrier: 'Carrier Name',
    group_name: 'Company Name',
    commission: 123.45,
    best_match: {
      state: 'CA',
      confidence: 75,
      matched_name: 'Similar Company'
    },
    alternatives: [...]
  },
  progress: {
    current: 5,
    total: 54,
    remaining: 49
  }
}

// Completion
{
  type: 'complete',
  stats: {
    total: 494,
    auto_matched: 440,
    user_verified: 54,
    learned: 12
  }
}
```

## 🛠️ Configuration

### Environment Variables (.env)
```bash
PORT=3020
NODE_ENV=production
```

### Python Scripts Configuration
- Base directory: `/home/sam/commission_automator/data/mbh/`
- Python environment: `/home/sam/pdfplumber-env/bin/python3`
- Scripts location: `/home/sam/chatbot-platform/mbh/commission-automator/src/`

## 📈 Monitoring

### Check Status
```bash
# Server health
curl http://localhost:3020/health

# Learning statistics
curl http://localhost:3020/stats/learning
```

### PM2 Monitoring
```bash
# Real-time monitoring
pm2 monit

# Process list
pm2 list

# Logs
pm2 logs commission-portal-interactive --lines 100
```

## 🚨 Troubleshooting

### WebSocket Connection Issues
```bash
# Check if server is running
pm2 status

# Check ports
netstat -tulpn | grep 3020

# Restart server
pm2 restart commission-portal-interactive
```

### Processing Errors
```bash
# Check Python logs
tail -f /home/sam/commission_automator/data/mbh/*/logs/*.log

# Check server logs
pm2 logs commission-portal-interactive --err
```

### Reset Learning Database
```bash
# Backup current learning
cp ~/.commission_learning.json ~/.commission_learning.backup.json

# Clear learning (start fresh)
echo '{}' > ~/.commission_learning.json
```

## 🎯 Benefits

1. **User-Friendly**: Non-technical users can verify matches
2. **Time-Saving**: Auto-approval for high-confidence matches
3. **Self-Improving**: Learns from corrections over time
4. **Real-Time**: See progress as processing happens
5. **Accurate**: Human verification ensures correctness
6. **Efficient**: Batch auto-approval when confident

## 📝 Notes

- Always backup before major changes
- Test in development before production deployment
- Monitor learning database size (prune if needed)
- Review logs regularly for errors
- Keep master contact CSV updated for better matches

---

**Support**: For issues or improvements, check logs first, then contact development team.