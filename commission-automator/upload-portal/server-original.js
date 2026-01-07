#!/usr/bin/env node

/**
 * Commission Upload Portal
 *
 * Web interface for uploading commission statements and bank statements
 * Automatically processes PDFs and emails results
 */

import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3020;

// Configuration
const BASE_DATA_DIR = '/home/sam/commission_automator/data/mbh';
const PYTHON_PATH = '/home/sam/pdfplumber-env/bin/python3';
const SCRIPTS_DIR = '/home/sam/chatbot-platform/mbh/commission-automator/src';

// Serve static files (HTML, CSS, JS)
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const month = req.body.month || req.query.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return cb(new Error('Invalid month format. Use YYYY-MM'));
    }

    // Determine upload type from field name
    const uploadType = file.fieldname; // 'commission_statements' or 'bank_statement'
    const uploadDir = join(BASE_DATA_DIR, month, uploadType);

    // Create directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});

// File filter - only PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max per file
    files: 50 // Max 50 files total
  }
});

// Upload endpoint
app.post('/upload', upload.fields([
  { name: 'commission_statements', maxCount: 50 },
  { name: 'bank_statement', maxCount: 1 }
]), async (req, res) => {
  try {
    const month = req.body.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month format. Use YYYY-MM (e.g., 2025-08)'
      });
    }

    const commissionFiles = req.files['commission_statements'] || [];
    const bankFiles = req.files['bank_statement'] || [];

    console.log(`📁 Upload received for ${month}`);
    console.log(`   Commission statements: ${commissionFiles.length} files`);
    console.log(`   Bank statement: ${bankFiles.length} files`);

    // Validate uploads
    if (commissionFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No commission statement PDFs uploaded'
      });
    }

    if (bankFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No bank statement PDF uploaded'
      });
    }

    // Send immediate response
    res.json({
      success: true,
      message: 'Files uploaded successfully. Processing started...',
      month: month,
      files: {
        commission_statements: commissionFiles.length,
        bank_statement: bankFiles.length
      }
    });

    // Process in background (don't wait for completion)
    processCommissions(month).catch(err => {
      console.error('❌ Processing failed:', err);
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process commission PDFs and generate reports
 */
async function processCommissions(month) {
  console.log(`\n🔄 Starting processing for ${month}...`);
  console.log('='.repeat(80));

  try {
    // Step 1: Extract commissions
    console.log('Step 1: Extracting commission data...');
    await runPythonScript('extract_commissions.py', ['--month', month]);
    console.log('✓ Extraction complete');

    // Step 2: Generate state summary
    console.log('Step 2: Generating state summary...');
    await runPythonScript('generate_state_summary.py', ['--month', month]);
    console.log('✓ State summary complete');

    // Step 3: Generate report and send email
    console.log('Step 3: Generating report and sending email...');
    await runPythonScript('generate_report.py', ['--month', month]);
    console.log('✓ Report generated and emailed');

    console.log('='.repeat(80));
    console.log(`✅ Processing complete for ${month}`);
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error(`❌ Processing failed for ${month}:`, error.message);
    console.error(error.stderr || error.stack);
    throw error;
  }
}

/**
 * Run a Python script and return a promise
 */
function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(SCRIPTS_DIR, scriptName);
    const process = spawn(PYTHON_PATH, [scriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
    });

    process.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output.trim());
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Script ${scriptName} exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Commission Upload Portal',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 50MB per file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 50 files.'
      });
    }
  }

  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Commission Upload Portal`);
  console.log(`${'='.repeat(80)}`);
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`📁 Data directory: ${BASE_DATA_DIR}`);
  console.log(`🐍 Python path: ${PYTHON_PATH}`);
  console.log(`📜 Scripts directory: ${SCRIPTS_DIR}`);
  console.log(`${'='.repeat(80)}\n`);
});
