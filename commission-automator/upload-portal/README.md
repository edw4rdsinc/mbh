# Commission Upload Portal

Web interface for uploading commission statements and bank statements. Automatically processes PDFs and emails results.

## Features

- **Two separate upload zones:** Commission statements (multiple PDFs) and bank statement (single PDF)
- **Drag & drop interface:** Easy file uploads
- **Automatic processing:** Triggers Python scripts after upload
- **Email notifications:** Results emailed to jennifer@mybenefitshelp.net
- **Month-based organization:** Files organized by processing month

## Setup

### 1. Install Dependencies

```bash
cd /home/sam/chatbot-platform/mbh/commission-automator/upload-portal
npm install
```

### 2. Start the Server

```bash
npm start
```

Server runs on: `http://localhost:3020`

### 3. Production Deployment

For production, run with PM2:

```bash
pm2 start server.js --name "commission-upload-portal"
pm2 save
```

## Usage

### Customer Workflow

1. Go to: `http://YOUR_IP:3020`
2. Select processing month (e.g., August 2025)
3. Drag commission PDFs to first upload zone (~30 files)
4. Drag bank statement PDF to second upload zone (1 file)
5. Click "Upload & Process"
6. Receive email when processing completes

### What Happens Behind the Scenes

1. **Upload:** Files saved to `/home/sam/commission_automator/data/mbh/{month}/`
   - Commission PDFs → `commission_statements/`
   - Bank PDF → `bank_statement/`

2. **Processing (automatic):**
   - `extract_commissions.py` - Extracts data from all carrier PDFs
   - `generate_state_summary.py` - Aggregates by state
   - `generate_report.py` - Creates reconciliation and emails results

3. **Email sent with attachments:**
   - commission_output.csv
   - state_summary.csv
   - reconciliation.csv

## API Endpoints

### `POST /upload`

Upload commission and bank statement PDFs.

**Request:**
```
Content-Type: multipart/form-data

month: "2025-08" (YYYY-MM format)
commission_statements: [PDF files]
bank_statement: PDF file
```

**Response:**
```json
{
  "success": true,
  "message": "Files uploaded successfully. Processing started...",
  "month": "2025-08",
  "files": {
    "commission_statements": 30,
    "bank_statement": 1
  }
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "Commission Upload Portal",
  "timestamp": "2025-10-21T10:15:30.000Z"
}
```

## Configuration

### Port

Edit `.env` file:
```
PORT=3020
```

### File Limits

Current limits (edit in `server.js` if needed):
- Max file size: 50MB per file
- Max files: 50 total
- File type: PDF only

### Data Directory

Files are saved to: `/home/sam/commission_automator/data/mbh/{month}/`

## Security Notes

### Current Setup
- No authentication (accessible to anyone with URL)
- Suitable for internal network use

### Adding Password Protection (Optional)

1. Install bcrypt:
   ```bash
   npm install bcrypt
   ```

2. Add password check in `server.js`:
   ```javascript
   const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD;

   app.post('/upload', (req, res, next) => {
     if (req.body.password !== UPLOAD_PASSWORD) {
       return res.status(401).json({ success: false, error: 'Invalid password' });
     }
     next();
   });
   ```

3. Add password field to HTML form

### For Production (Public Internet)
- Use HTTPS (SSL certificate)
- Add authentication
- Rate limiting
- File scanning for malware

## Troubleshooting

### Server won't start
- Check port 3020 is not in use: `lsof -i :3020`
- Check logs for errors

### Files not uploading
- Check disk space
- Verify data directory exists and is writable
- Check file size limits

### Processing not running
- Check Python path: `/home/sam/pdfplumber-env/bin/python3`
- Check scripts directory: `/home/sam/chatbot-platform/mbh/commission-automator/src`
- View server logs for errors

### Email not sending
- Check `generate_report.py` configuration
- Verify Resend API key is valid
- Check recipient email: jennifer@mybenefitshelp.net

## Monitoring

### View server logs
```bash
# If running with PM2
pm2 logs commission-upload-portal

# If running directly
# Check console output where server is running
```

### Check processing status
```bash
# View Python script logs
tail -f /home/sam/chatbot-platform/mbh/commission-automator/logs/*.log
```

## Files Created

```
upload-portal/
├── server.js              # Express server
├── package.json           # Dependencies
├── .env                   # Configuration
├── README.md             # This file
└── public/
    └── index.html        # Upload interface
```

## Deployment Checklist

### Phase 1: Local Testing (~30 minutes)

**Installation:**
- [x] Portal code created
- [x] Dependencies installed (`npm install`)
- [ ] Server starts successfully (`npm start`)
- [ ] Web interface accessible at http://localhost:3020
- [ ] No console errors

**Testing Upload:**
- [ ] Select test month (e.g., 2025-08)
- [ ] Upload commission PDFs (can reuse from `../output/2025-08/` for testing)
- [ ] Upload bank statement PDF
- [ ] Files saved to `/home/sam/commission_automator/data/mbh/{month}/commission_statements/`
- [ ] Files saved to `/home/sam/commission_automator/data/mbh/{month}/bank_statement/`

**Testing Processing:**
- [ ] Python scripts run automatically (check console logs)
- [ ] `extract_commissions.py` completes successfully
- [ ] `generate_state_summary.py` completes successfully
- [ ] `generate_report.py` completes successfully
- [ ] Output files created in `../output/{month}/`:
  - [ ] commission_output.csv
  - [ ] state_summary.csv
  - [ ] needs_review.csv
  - [ ] reconciliation.csv

**Testing Email:**
- [ ] Email sent to jennifer@mybenefitshelp.net
- [ ] Email contains 3 CSV attachments
- [ ] CSV data looks correct

---

### Phase 2: Production Deployment (~30 minutes)

**PM2 Setup:**
- [ ] Deploy with PM2: `pm2 start server.js --name commission-upload-portal`
- [ ] Save PM2 config: `pm2 save`
- [ ] Set PM2 to start on boot: `pm2 startup`
- [ ] Verify status: `pm2 list`
- [ ] Check logs: `pm2 logs commission-upload-portal`

**Network Configuration:**

Choose one option:

**Option A: Direct Port Access (Quick)**
- [ ] Open firewall port: `sudo ufw allow 3020/tcp`
- [ ] Test access: `http://SERVER_IP:3020`

**Option B: Reverse Proxy with Nginx (Recommended)**
- [ ] Install nginx: `sudo apt install nginx`
- [ ] Create nginx config:
  ```bash
  sudo nano /etc/nginx/sites-available/commissions
  ```
  ```nginx
  server {
      listen 80;
      server_name commissions.mbh.edw4rds.com;

      location / {
          proxy_pass http://localhost:3020;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_cache_bypass $http_upgrade;
      }
  }
  ```
- [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/commissions /etc/nginx/sites-enabled/`
- [ ] Test nginx: `sudo nginx -t`
- [ ] Reload nginx: `sudo systemctl reload nginx`

**Domain Setup (Optional):**
- [ ] Create DNS A record: `commissions.mbh.edw4rds.com` → `SERVER_IP`
- [ ] Wait for DNS propagation (5-30 minutes)
- [ ] Test: `curl http://commissions.mbh.edw4rds.com`

**SSL Certificate (Optional but Recommended):**
- [ ] Install certbot: `sudo apt install certbot python3-certbot-nginx`
- [ ] Get certificate: `sudo certbot --nginx -d commissions.mbh.edw4rds.com`
- [ ] Test auto-renewal: `sudo certbot renew --dry-run`
- [ ] Access via HTTPS: `https://commissions.mbh.edw4rds.com`

**Security (Optional):**
- [ ] Add password protection (see "Adding Password Protection" section)
- [ ] Add rate limiting
- [ ] Configure IP whitelist if needed

---

### Phase 3: Customer Onboarding (~15 minutes)

- [ ] Send customer access URL
- [ ] Walk through demo upload with customer
- [ ] Test end-to-end with real customer data
- [ ] Customer confirms email receipt
- [ ] Document customer workflow for reference
- [ ] Provide support contact information

---

### Phase 4: Monitoring & Maintenance

**Regular Checks:**
- [ ] Monitor disk space (PDFs accumulate)
- [ ] Review PM2 logs weekly: `pm2 logs commission-upload-portal`
- [ ] Check Python processing logs: `tail -f ../logs/*.log`
- [ ] Verify monthly emails are being received
- [ ] Clean up old month data if needed

**Performance:**
- [ ] Monitor upload times
- [ ] Monitor processing times
- [ ] Check email delivery success rate

**Optional: Deprecate Google Drive Sync**
- [ ] Confirm customer is using web portal exclusively
- [ ] Remove Google Drive sync from monthly cron (if desired)
- [ ] Keep `sync_from_drive.sh` as backup option

## Support

For issues, check:
- Server logs (PM2 or console)
- Python script logs in `logs/` directory
- Browser console for frontend errors
