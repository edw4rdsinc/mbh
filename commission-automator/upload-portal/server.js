#!/usr/bin/env node

/**
 * Commission Upload Portal with Interactive Review
 *
 * Web interface for uploading commission statements with real-time review
 * Allows users to verify/correct fuzzy matches during processing
 */

import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3020;
const server = http.createServer(app);

// Configuration
const BASE_DATA_DIR = '/home/sam/commission_automator/data/mbh';
const PYTHON_PATH = '/home/sam/pdfplumber-env/bin/python3';
const SCRIPTS_DIR = '/home/sam/chatbot-platform/mbh/commission-automator/src';
const LEARNING_DB_PATH = '/home/sam/.commission_learning.json';

// WebSocket server for real-time communication
const wss = new WebSocketServer({ server });

// Active processing sessions
const activeSessions = new Map();

// Learning database for corrections
let learningDB = {};
try {
  if (existsSync(LEARNING_DB_PATH)) {
    learningDB = JSON.parse(readFileSync(LEARNING_DB_PATH, 'utf8'));
  }
} catch (err) {
  console.error('Failed to load learning database:', err);
}

// Serve static files (HTML, CSS, JS)
app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// Redirect /upload to index page
app.get('/upload', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

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

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const sessionId = Date.now().toString();
  console.log(`🔌 WebSocket connected: ${sessionId}`);

  // Store session
  activeSessions.set(sessionId, {
    ws,
    month: null,
    status: 'connected',
    reviewQueue: [],
    currentReview: null
  });

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId,
    message: 'Connected to interactive processor'
  }));

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleClientMessage(sessionId, data);
    } catch (err) {
      console.error('Invalid message:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    console.log(`🔌 WebSocket disconnected: ${sessionId}`);
    activeSessions.delete(sessionId);
  });
});

// Handle client messages
async function handleClientMessage(sessionId, data) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  console.log(`📨 Received message type: ${data.type} from session ${sessionId}`);

  switch (data.type) {
    case 'start_processing':
      console.log(`🚀 Starting processing for month: ${data.month}`);
      session.month = data.month;
      session.status = 'processing';
      await startInteractiveProcessing(sessionId, data.month);
      break;

    case 'review_response':
      console.log(`✅ Review response: ${data.action} for item`);
      await handleReviewResponse(sessionId, data);
      break;

    case 'auto_approve_all':
      console.log(`⏭️  Auto-approving all remaining items`);
      await handleAutoApproveAll(sessionId);
      break;

    default:
      console.log(`❓ Unknown message type: ${data.type}`);
  }
}

// Start interactive processing
async function startInteractiveProcessing(sessionId, month) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    // Phase 1: Extract commission data
    await sendStatus(sessionId, 'Extracting commission data...', {
      phase: 'extraction',
      progress: 0
    });

    // Run extraction script with progress updates
    let progressTimer = setInterval(async () => {
      // Simulate progress during extraction (moves from 0 to 80%)
      const elapsed = Date.now() - (session.extractionStart || Date.now());
      const simulatedProgress = Math.min(80, (elapsed / 1000) * 5); // ~5% per second, max 80%
      await sendStatus(sessionId, 'Processing PDF files...', {
        phase: 'extraction',
        progress: simulatedProgress
      });
    }, 2000);

    session.extractionStart = Date.now();
    const extractResult = await runPythonScript('extract_commissions.py', ['--month', month]);
    clearInterval(progressTimer);

    // Parse extracted data - look in the output directory where the script actually saves it
    const dataPath = join(SCRIPTS_DIR, '..', 'output', month, 'all_commission_data.json');
    const allEntries = JSON.parse(readFileSync(dataPath, 'utf8'));

    await sendStatus(sessionId, `Extracted ${allEntries.length} commission entries`, {
      phase: 'extraction',
      progress: 100,
      total: allEntries.length
    });

    // Phase 2: Categorize by confidence
    await sendStatus(sessionId, 'Analyzing matches...', {
      phase: 'matching',
      progress: 0
    });

    const highConfidence = [];
    const needsReview = [];

    for (const entry of allEntries) {
      // Check learning database first
      const learned = learningDB[entry.group_name];
      if (learned) {
        entry.state = learned;
        entry.confidence = 100;
        entry.learned = true;
        highConfidence.push(entry);
        continue;
      }

      // Check confidence level
      if (entry.confidence >= 80) {
        highConfidence.push(entry);
      } else if (entry.confidence >= 60) {
        needsReview.push(entry);
      } else {
        // Too low confidence - needs manual review
        entry.needsManual = true;
        needsReview.push(entry);
      }
    }

    await sendStatus(sessionId, `Found ${highConfidence.length} auto-matches, ${needsReview.length} need review`, {
      phase: 'review_needed',
      highConfidence: highConfidence.length,
      needsReview: needsReview.length
    });

    // Store review queue
    session.reviewQueue = needsReview;
    session.highConfidence = highConfidence;

    // Phase 3: Start interactive review if needed
    if (needsReview.length > 0) {
      await startReviewProcess(sessionId);
    } else {
      await completeProcessing(sessionId);
    }

  } catch (error) {
    console.error('Processing error:', error);
    await sendStatus(sessionId, 'Error during processing', {
      phase: 'error',
      error: error.message
    });
  }
}

// Start the review process
async function startReviewProcess(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || session.reviewQueue.length === 0) {
    return await completeProcessing(sessionId);
  }

  // Get next item to review
  const item = session.reviewQueue.shift();
  session.currentReview = item;

  // Get alternative matches
  const alternatives = await getAlternativeMatches(item.group_name);

  // Send review request to client
  await session.ws.send(JSON.stringify({
    type: 'review_request',
    item: {
      id: `${item.carrier}_${item.group_name}_${item.commission}`,
      carrier: item.carrier,
      group_name: item.group_name,
      commission: item.commission,
      best_match: {
        state: item.state || 'Unknown',
        confidence: item.confidence,
        matched_name: item.matched_name
      },
      alternatives: alternatives,
      needsManual: item.needsManual
    },
    progress: {
      current: session.highConfidence.length + 1,
      total: session.highConfidence.length + session.reviewQueue.length + 1,
      remaining: session.reviewQueue.length
    }
  }));
}

// Handle review response from client
async function handleReviewResponse(sessionId, data) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.currentReview) return;

  const item = session.currentReview;
  const groupName = item.group_name;

  // Apply the user's decision
  switch (data.action) {
    case 'confirm':
      item.state = data.state || item.state;
      item.user_verified = true;
      break;

    case 'change':
      item.state = data.new_state;
      item.user_verified = true;
      break;

    case 'skip':
      // Keep as-is but mark as skipped
      item.user_skipped = true;
      break;
  }

  // Save to learning database if requested
  if (data.remember && data.action !== 'skip') {
    learningDB[item.group_name] = item.state;
    saveLearningDB();
  }

  // Add to processed list
  session.highConfidence.push(item);
  session.currentReview = null;

  // FIX #1: Apply this correction to ALL remaining items with the same group_name
  if (data.action !== 'skip') {
    const correctedState = item.state;
    const duplicates = [];

    // Normalize group name for comparison (trim and uppercase)
    const normalizedGroupName = groupName.trim().toUpperCase();
    console.log(`🔍 Looking for duplicates of "${groupName}" in ${session.reviewQueue.length} remaining items...`);

    // Find and remove all duplicates from review queue
    session.reviewQueue = session.reviewQueue.filter(entry => {
      const normalizedEntryName = (entry.group_name || '').trim().toUpperCase();
      if (normalizedEntryName === normalizedGroupName) {
        console.log(`  ✓ Found duplicate: "${entry.group_name}" (${entry.carrier}, $${entry.commission})`);
        entry.state = correctedState;
        entry.user_verified = true;
        entry.auto_applied = true; // Mark as auto-applied from user correction
        duplicates.push(entry);
        return false; // Remove from queue
      }
      return true; // Keep in queue
    });

    // Add duplicates to high confidence list
    if (duplicates.length > 0) {
      console.log(`✨ Auto-applied correction to ${duplicates.length} duplicate entries for "${groupName}"`);
      session.highConfidence.push(...duplicates);

      // Notify client
      await sendStatus(sessionId, `Applied to ${duplicates.length + 1} entries with name "${groupName}"`, {
        phase: 'reviewing',
        duplicatesApplied: duplicates.length
      });
    } else {
      console.log(`  ℹ️  No duplicates found for "${groupName}"`);
    }
  }

  // Continue with next review or complete
  await startReviewProcess(sessionId);
}

// Auto-approve all remaining items
async function handleAutoApproveAll(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  // Add all remaining items with best match
  while (session.reviewQueue.length > 0) {
    const item = session.reviewQueue.shift();
    item.auto_approved = true;
    session.highConfidence.push(item);
  }

  await completeProcessing(sessionId);
}

// Complete processing and generate report
async function completeProcessing(sessionId) {
  console.log(`📊 ====== COMPLETE PROCESSING CALLED FOR SESSION ${sessionId} ======`);
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.error(`❌ Session ${sessionId} not found in completeProcessing!`);
    return;
  }

  console.log(`📦 Session has ${session.highConfidence.length} entries to process`);

  try {
    await sendStatus(sessionId, 'Generating final report...', {
      phase: 'report',
      progress: 90
    });
    console.log(`📤 Sent "Generating final report" status`);

    // Save processed data - save to output directory
    const outputDir = join(SCRIPTS_DIR, '..', 'output', session.month);
    mkdirSync(outputDir, { recursive: true });
    const processedPath = join(outputDir, 'processed_commission_data.json');
    writeFileSync(processedPath, JSON.stringify(session.highConfidence, null, 2));

    // FIX #2: Generate updated CSV files from processed data for the report
    const csvPath = join(outputDir, 'commission_output.csv');
    const needsReviewPath = join(outputDir, 'needs_review.csv');

    // Create CSV from processed data
    const csvLines = ['carrier,group_name,commission,state'];
    const reviewLines = ['carrier,group_name,commission,state,match_confidence'];

    let skippedCount = 0;
    let processedCount = 0;

    for (const entry of session.highConfidence) {
      // Add all entries to main CSV
      csvLines.push(`${entry.carrier},"${entry.group_name}",${entry.commission},${entry.state}`);
      processedCount++;

      // Only add skipped items to needs_review (confidence < 80 and user_skipped)
      if (entry.user_skipped) {
        reviewLines.push(`${entry.carrier},"${entry.group_name}",${entry.commission},${entry.state},${entry.confidence || 0}`);
        skippedCount++;
      }
    }

    writeFileSync(csvPath, csvLines.join('\n'));
    console.log(`✅ Wrote ${processedCount} entries to commission_output.csv`);

    writeFileSync(needsReviewPath, reviewLines.join('\n'));
    console.log(`📋 Wrote ${skippedCount} entries to needs_review.csv (user skipped items only)`);

    // Verify the files were written
    if (existsSync(csvPath) && existsSync(needsReviewPath)) {
      console.log(`✓ CSV files successfully overwritten with corrected data`);
      console.log(`  - commission_output.csv: ${processedCount} entries`);
      console.log(`  - needs_review.csv: ${skippedCount} entries`);
    } else {
      console.error(`❌ ERROR: CSV files were not written!`);
    }

    // Generate state summary
    await runPythonScript('generate_state_summary.py', ['--month', session.month]);

    // Generate report and send email
    await runPythonScript('generate_report.py', ['--month', session.month]);

    // Send completion message
    const userVerifiedCount = session.highConfidence.filter(e => e.user_verified).length;
    const skippedCount = session.highConfidence.filter(e => e.user_skipped).length;
    const autoAppliedCount = session.highConfidence.filter(e => e.auto_applied).length;

    await sendStatus(sessionId, 'Processing complete!', {
      phase: 'complete',
      progress: 100,
      stats: {
        total: session.highConfidence.length,
        auto_matched: session.highConfidence.filter(e => !e.user_verified && !e.auto_approved && !e.learned).length,
        user_verified: userVerifiedCount,
        auto_applied: autoAppliedCount,
        auto_approved: session.highConfidence.filter(e => e.auto_approved).length,
        learned: session.highConfidence.filter(e => e.learned).length,
        needs_review: skippedCount  // FIX #3: Show actual count of items still needing review
      }
    });

  } catch (error) {
    console.error('Completion error:', error);
    await sendStatus(sessionId, 'Error generating report', {
      phase: 'error',
      error: error.message
    });
  }
}

// Send status update to client
async function sendStatus(sessionId, message, extra = {}) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.ws) return;

  try {
    await session.ws.send(JSON.stringify({
      type: 'status',
      message,
      ...extra
    }));
  } catch (err) {
    console.error('Failed to send status:', err);
  }
}

// Get alternative state matches
async function getAlternativeMatches(groupName) {
  // This would normally call fuzzy matching logic
  // For now, return common alternatives
  const states = ['CA', 'TX', 'FL', 'NY', 'WA', 'OR', 'AZ', 'NV'];
  return states.slice(0, 3).map(state => ({
    state,
    confidence: Math.floor(Math.random() * 30) + 50,
    name: `${groupName} (${state})`
  }));
}

// Save learning database
function saveLearningDB() {
  try {
    writeFileSync(LEARNING_DB_PATH, JSON.stringify(learningDB, null, 2));
    console.log(`💾 Saved ${Object.keys(learningDB).length} learned corrections`);
  } catch (err) {
    console.error('Failed to save learning database:', err);
  }
}

// Upload endpoint with WebSocket session ID
app.post('/upload', upload.fields([
  { name: 'commission_statements', maxCount: 50 },
  { name: 'bank_statement', maxCount: 1 }
]), async (req, res) => {
  try {
    const month = req.body.month;
    const sessionId = req.body.sessionId;

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

    // Send response
    res.json({
      success: true,
      message: 'Files uploaded successfully. Connect WebSocket to start interactive processing.',
      month: month,
      files: {
        commission_statements: commissionFiles.length,
        bank_statement: bankFiles.length
      },
      websocketUrl: `ws://localhost:${PORT}`
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
    service: 'Commission Upload Portal - Interactive',
    timestamp: new Date().toISOString(),
    sessions: activeSessions.size,
    learned: Object.keys(learningDB).length
  });
});

// Get learning statistics
app.get('/stats/learning', (req, res) => {
  res.json({
    total: Object.keys(learningDB).length,
    entries: Object.entries(learningDB).map(([name, state]) => ({
      name,
      state
    }))
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
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Commission Upload Portal - Interactive Review Mode`);
  console.log(`${'='.repeat(80)}`);
  console.log(`🌐 Server running on: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`📁 Data directory: ${BASE_DATA_DIR}`);
  console.log(`🐍 Python path: ${PYTHON_PATH}`);
  console.log(`📜 Scripts directory: ${SCRIPTS_DIR}`);
  console.log(`🧠 Learning database: ${Object.keys(learningDB).length} entries`);
  console.log(`${'='.repeat(80)}\n`);
});