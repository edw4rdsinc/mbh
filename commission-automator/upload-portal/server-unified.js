#!/usr/bin/env node

/**
 * Unified MBH Tools API Server
 *
 * Serves both Commission Report and Deduction Report APIs
 * with Supabase JWT authentication and CORS for the MBH website.
 */

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import http from 'http';
import { randomUUID } from 'crypto';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5011;
const server = http.createServer(app);

// ============================================
// Configuration
// ============================================

const CONFIG = {
  // Commission automator paths
  commission: {
    dataDir: '/home/sam/commission_automator/data/mbh',
    pythonPath: '/home/sam/pdfplumber-env/bin/python3',
    scriptsDir: '/home/sam/chatbot-platform/mbh/commission-automator/src',
    outputDir: '/home/sam/chatbot-platform/mbh/commission-automator/output',
    learningDbPath: '/home/sam/.commission_learning.json'
  },
  // Deduction report paths
  deduction: {
    scriptsDir: '/home/sam/chatbot-platform/mbh/deduction-report/src',
    tempDir: '/tmp/mbh-deduction'
  },
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || 'https://exzeayeoosiabwhgyquq.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET
  },
  // CORS
  allowedOrigins: [
    'https://www.mybenefitshelp.net',
    'https://mybenefitshelp.net',
    'http://localhost:3000',
    'http://localhost:5173'
  ]
};

// Create temp directory for deduction reports
if (!existsSync(CONFIG.deduction.tempDir)) {
  mkdirSync(CONFIG.deduction.tempDir, { recursive: true });
}

// Temporary file storage for commission report downloads
const commissionFiles = new Map();

// Supabase client for auth validation
const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey || 'dummy');

// ============================================
// Middleware
// ============================================

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (CONFIG.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow for now during development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Auth middleware - validates Supabase JWT
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user is whitelisted
    const { data: whitelisted } = await supabase
      .from('mbh_tool_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (!whitelisted) {
      return res.status(403).json({ error: 'User not authorized' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// ============================================
// WebSocket for Commission Report (Interactive)
// ============================================

const wss = new WebSocketServer({ server });
const activeSessions = new Map();

// Learning database for corrections
let learningDB = {};
try {
  if (existsSync(CONFIG.commission.learningDbPath)) {
    learningDB = JSON.parse(readFileSync(CONFIG.commission.learningDbPath, 'utf8'));
  }
} catch (err) {
  console.error('Failed to load learning database:', err);
}

// State Attribution sessions (defined before WebSocket handler)
const stateAttributionSessions = new Map();

wss.on('connection', async (ws, req) => {
  // Extract token and path from query string
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const isStateAttribution = url.pathname === '/state-attribution';

  if (!token) {
    ws.close(1008, 'Missing token');
    return;
  }

  // Validate token
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      ws.close(1008, 'Invalid token');
      return;
    }

    // Check whitelist
    const { data: whitelisted } = await supabase
      .from('mbh_tool_users')
      .select('email')
      .eq('email', user.email)
      .single();

    if (!whitelisted) {
      ws.close(1008, 'User not authorized');
      return;
    }

    // Route to State Attribution or legacy Commission handler
    if (isStateAttribution) {
      const sessionId = `sa_${Date.now()}`;
      console.log(`🔌 State Attribution connected: ${sessionId} (${user.email})`);

      stateAttributionSessions.set(sessionId, {
        ws,
        user,
        month: null,
        status: 'connected',
        reviewQueue: [],
        currentReview: null,
        highConfidence: []
      });

      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        message: 'Connected to state attribution processor'
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleStateAttributionMessage(sessionId, data);
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log(`🔌 State Attribution disconnected: ${sessionId}`);
        stateAttributionSessions.delete(sessionId);
      });

    } else {
      // Legacy commission handler
      const sessionId = Date.now().toString();
      console.log(`🔌 WebSocket connected: ${sessionId} (${user.email})`);

      activeSessions.set(sessionId, {
        ws,
        user,
        month: null,
        status: 'connected',
        reviewQueue: [],
        currentReview: null,
        highConfidence: []
      });

      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        message: 'Connected to interactive processor'
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleClientMessage(sessionId, data);
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket disconnected: ${sessionId}`);
        activeSessions.delete(sessionId);
      });
    }

  } catch (err) {
    console.error('WebSocket auth error:', err);
    ws.close(1008, 'Authentication failed');
  }
});

// Include all the commission processing functions from original server
// (handleClientMessage, startInteractiveProcessing, etc.)
// ... [These are copied from the original server-interactive.js]

async function handleClientMessage(sessionId, data) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  console.log(`📨 Received: ${data.type} from ${sessionId}`);

  switch (data.type) {
    case 'start_processing':
      session.month = data.month;
      session.status = 'processing';
      await startInteractiveProcessing(sessionId, data.month);
      break;

    case 'review_response':
      await handleReviewResponse(sessionId, data);
      break;

    case 'auto_approve_all':
      await handleAutoApproveAll(sessionId);
      break;
  }
}

async function startInteractiveProcessing(sessionId, month) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    await sendStatus(sessionId, 'Extracting commission data...', { phase: 'extraction', progress: 0 });

    // Run extraction with progress simulation
    let progressTimer = setInterval(async () => {
      const elapsed = Date.now() - (session.extractionStart || Date.now());
      const simulatedProgress = Math.min(80, (elapsed / 1000) * 5);
      await sendStatus(sessionId, 'Processing PDF files...', { phase: 'extraction', progress: simulatedProgress });
    }, 2000);

    session.extractionStart = Date.now();
    await runPythonScript('extract_commissions.py', ['--month', month]);
    clearInterval(progressTimer);

    // Parse extracted data
    const dataPath = join(CONFIG.commission.outputDir, month, 'all_commission_data.json');
    const allEntries = JSON.parse(readFileSync(dataPath, 'utf8'));

    await sendStatus(sessionId, `Extracted ${allEntries.length} entries`, { phase: 'extraction', progress: 100 });

    // Categorize by confidence
    const highConfidence = [];
    const needsReview = [];

    for (const entry of allEntries) {
      const learned = learningDB[entry.group_name];
      if (learned) {
        entry.state = learned;
        entry.confidence = 100;
        entry.learned = true;
        highConfidence.push(entry);
      } else if (entry.confidence >= 80) {
        highConfidence.push(entry);
      } else {
        needsReview.push(entry);
      }
    }

    await sendStatus(sessionId, `${highConfidence.length} auto-matched, ${needsReview.length} need review`, {
      phase: 'review_needed',
      highConfidence: highConfidence.length,
      needsReview: needsReview.length
    });

    session.reviewQueue = needsReview;
    session.highConfidence = highConfidence;

    if (needsReview.length > 0) {
      await startReviewProcess(sessionId);
    } else {
      await completeProcessing(sessionId);
    }

  } catch (error) {
    console.error('Processing error:', error);
    await sendStatus(sessionId, 'Error during processing', { phase: 'error', error: error.message });
  }
}

async function startReviewProcess(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || session.reviewQueue.length === 0) {
    return await completeProcessing(sessionId);
  }

  const item = session.reviewQueue.shift();
  session.currentReview = item;

  const states = ['CA', 'TX', 'FL', 'NY', 'WA', 'OR', 'AZ', 'NV'];
  const alternatives = states.slice(0, 3).map(state => ({
    state,
    confidence: Math.floor(Math.random() * 30) + 50,
    name: `${item.group_name} (${state})`
  }));

  session.ws.send(JSON.stringify({
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
      alternatives
    },
    progress: {
      current: session.highConfidence.length + 1,
      total: session.highConfidence.length + session.reviewQueue.length + 1,
      remaining: session.reviewQueue.length
    }
  }));
}

async function handleReviewResponse(sessionId, data) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.currentReview) return;

  const item = session.currentReview;
  const groupName = item.group_name;

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
      item.user_skipped = true;
      break;
  }

  if (data.remember && data.action !== 'skip') {
    learningDB[item.group_name] = item.state;
    saveLearningDB();
  }

  session.highConfidence.push(item);
  session.currentReview = null;

  // Apply to duplicates
  if (data.action !== 'skip') {
    const normalizedName = groupName.trim().toUpperCase();
    const duplicates = [];

    session.reviewQueue = session.reviewQueue.filter(entry => {
      if ((entry.group_name || '').trim().toUpperCase() === normalizedName) {
        entry.state = item.state;
        entry.user_verified = true;
        entry.auto_applied = true;
        duplicates.push(entry);
        return false;
      }
      return true;
    });

    if (duplicates.length > 0) {
      session.highConfidence.push(...duplicates);
      await sendStatus(sessionId, `Applied to ${duplicates.length + 1} entries`, { phase: 'reviewing' });
    }
  }

  await startReviewProcess(sessionId);
}

async function handleAutoApproveAll(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  while (session.reviewQueue.length > 0) {
    const item = session.reviewQueue.shift();
    item.auto_approved = true;
    session.highConfidence.push(item);
  }

  await completeProcessing(sessionId);
}

async function completeProcessing(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    await sendStatus(sessionId, 'Generating final report...', { phase: 'report', progress: 90 });

    const outputDir = join(CONFIG.commission.outputDir, session.month);
    mkdirSync(outputDir, { recursive: true });

    // Save processed data
    writeFileSync(
      join(outputDir, 'processed_commission_data.json'),
      JSON.stringify(session.highConfidence, null, 2)
    );

    // Generate CSVs
    const csvLines = ['carrier,group_name,commission,state'];
    const reviewLines = ['carrier,group_name,commission,state,match_confidence'];

    for (const entry of session.highConfidence) {
      csvLines.push(`${entry.carrier},"${entry.group_name}",${entry.commission},${entry.state}`);
      if (entry.user_skipped) {
        reviewLines.push(`${entry.carrier},"${entry.group_name}",${entry.commission},${entry.state},${entry.confidence || 0}`);
      }
    }

    writeFileSync(join(outputDir, 'commission_output.csv'), csvLines.join('\n'));
    writeFileSync(join(outputDir, 'needs_review.csv'), reviewLines.join('\n'));

    // Run report generation
    await runPythonScript('generate_state_summary.py', ['--month', session.month]);
    await runPythonScript('generate_report.py', ['--month', session.month]);

    // Generate Excel report for download
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MBH Commission Report';
    workbook.created = new Date();

    // State Summary sheet
    const stateSummaryPath = join(outputDir, 'state_summary.csv');
    if (existsSync(stateSummaryPath)) {
      const stateSummarySheet = workbook.addWorksheet('State Summary');
      const stateSummaryContent = readFileSync(stateSummaryPath, 'utf-8');
      const stateRows = stateSummaryContent.split('\n').filter(r => r.trim());
      stateRows.forEach((row, i) => {
        const cells = row.split(',').map(c => c.replace(/^"|"$/g, ''));
        const excelRow = stateSummarySheet.addRow(cells);
        if (i === 0) {
          excelRow.font = { bold: true };
          excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
      });
      stateSummarySheet.columns.forEach(col => { col.width = 15; });
    }

    // Commission Details sheet
    const commissionSheet = workbook.addWorksheet('Commission Details');
    const commHeaders = ['Carrier', 'Group Name', 'Commission', 'State'];
    const headerRow = commissionSheet.addRow(commHeaders);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const entry of session.highConfidence) {
      commissionSheet.addRow([entry.carrier, entry.group_name, entry.commission, entry.state]);
    }
    commissionSheet.getColumn(3).numFmt = '$#,##0.00';
    commissionSheet.columns.forEach(col => { col.width = 20; });

    // Needs Review sheet
    const needsReviewEntries = session.highConfidence.filter(e => e.user_skipped);
    if (needsReviewEntries.length > 0) {
      const reviewSheet = workbook.addWorksheet('Needs Review');
      const reviewHeaderRow = reviewSheet.addRow(['Carrier', 'Group Name', 'Commission', 'State', 'Confidence']);
      reviewHeaderRow.font = { bold: true };
      reviewHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
      for (const entry of needsReviewEntries) {
        reviewSheet.addRow([entry.carrier, entry.group_name, entry.commission, entry.state, entry.confidence || 0]);
      }
      reviewSheet.getColumn(3).numFmt = '$#,##0.00';
      reviewSheet.columns.forEach(col => { col.width = 20; });
    }

    // Store for download
    const buffer = await workbook.xlsx.writeBuffer();
    const [year, month] = session.month.split('-');
    const fileId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = `Commission_Report_${month}-${year.slice(2)}.xlsx`;

    commissionFiles.set(fileId, { buffer: Buffer.from(buffer), fileName });
    setTimeout(() => commissionFiles.delete(fileId), 30 * 60 * 1000);

    const stats = {
      total: session.highConfidence.length,
      auto_matched: session.highConfidence.filter(e => !e.user_verified && !e.auto_approved && !e.learned).length,
      user_verified: session.highConfidence.filter(e => e.user_verified).length,
      auto_applied: session.highConfidence.filter(e => e.auto_applied).length,
      learned: session.highConfidence.filter(e => e.learned).length,
      needs_review: session.highConfidence.filter(e => e.user_skipped).length
    };

    await sendStatus(sessionId, 'Processing complete!', { phase: 'complete', progress: 100, stats, fileId, fileName });

  } catch (error) {
    console.error('Completion error:', error);
    await sendStatus(sessionId, 'Error generating report', { phase: 'error', error: error.message });
  }
}

async function sendStatus(sessionId, message, extra = {}) {
  const session = activeSessions.get(sessionId);
  if (!session?.ws) return;

  session.ws.send(JSON.stringify({ type: 'status', message, ...extra }));
}

function saveLearningDB() {
  try {
    writeFileSync(CONFIG.commission.learningDbPath, JSON.stringify(learningDB, null, 2));
  } catch (err) {
    console.error('Failed to save learning DB:', err);
  }
}

function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(CONFIG.commission.scriptsDir, scriptName);
    const proc = spawn(CONFIG.commission.pythonPath, [scriptPath, ...args]);

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; console.log(d.toString().trim()); });
    proc.stderr.on('data', d => { stderr += d; console.error(d.toString().trim()); });

    proc.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Script ${scriptName} exited with code ${code}`));
    });

    proc.on('error', reject);
  });
}

// ============================================
// Commission Report API Routes
// ============================================

const commissionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const month = req.body.month;
      const type = file.fieldname;
      const dir = join(CONFIG.commission.dataDir, month, type);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
  limits: { fileSize: 50 * 1024 * 1024, files: 50 }
});

app.post('/api/commission/upload',
  authMiddleware,
  commissionUpload.fields([
    { name: 'commission_statements', maxCount: 50 },
    { name: 'bank_statement', maxCount: 1 }
  ]),
  (req, res) => {
    const month = req.body.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format' });
    }

    const commissionFiles = req.files['commission_statements'] || [];
    const bankFiles = req.files['bank_statement'] || [];

    if (commissionFiles.length === 0) {
      return res.status(400).json({ error: 'No commission statements uploaded' });
    }

    if (bankFiles.length === 0) {
      return res.status(400).json({ error: 'No bank statement uploaded' });
    }

    console.log(`📁 Commission upload: ${month} by ${req.user.email}`);
    console.log(`   Commission: ${commissionFiles.length}, Bank: ${bankFiles.length}`);

    res.json({
      success: true,
      message: 'Files uploaded. Connect WebSocket to start processing.',
      month,
      files: {
        commission_statements: commissionFiles.length,
        bank_statement: bankFiles.length
      }
    });
  }
);

// Commission report download endpoint
app.get('/api/commission/download/:fileId', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const fileData = commissionFiles.get(req.params.fileId);

    if (!fileData) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.buffer);

  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ============================================
// State Attribution API Routes (Decoupled from Bank Reconciliation)
// ============================================

const stateAttributionFiles = new Map();

async function handleStateAttributionMessage(sessionId, data) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session) return;

  console.log(`📨 State Attribution: ${data.type} from ${sessionId}`);

  switch (data.type) {
    case 'start_processing':
      session.month = data.month;
      session.status = 'processing';
      await startStateAttributionProcessing(sessionId, data.month);
      break;

    case 'review_response':
      await handleStateAttributionReview(sessionId, data);
      break;

    case 'auto_approve_all':
      await handleStateAttributionAutoApprove(sessionId);
      break;
  }
}

async function startStateAttributionProcessing(sessionId, month) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session) return;

  try {
    await sendStateAttributionStatus(sessionId, 'Extracting commission data...', { phase: 'extraction', progress: 0 });

    // Run extraction
    await runPythonScript('extract_commissions.py', ['--month', month]);

    // Parse extracted data
    const dataPath = join(CONFIG.commission.outputDir, month, 'all_commission_data.json');
    const allEntries = JSON.parse(readFileSync(dataPath, 'utf8'));

    await sendStateAttributionStatus(sessionId, `Extracted ${allEntries.length} entries`, { phase: 'extraction', progress: 100 });

    // Categorize by confidence
    const highConfidence = [];
    const needsReview = [];

    for (const entry of allEntries) {
      const learned = learningDB[entry.group_name];
      if (learned) {
        entry.state = learned;
        entry.confidence = 100;
        entry.learned = true;
        highConfidence.push(entry);
      } else if (entry.confidence >= 80) {
        highConfidence.push(entry);
      } else {
        needsReview.push(entry);
      }
    }

    await sendStateAttributionStatus(sessionId, `${highConfidence.length} auto-matched, ${needsReview.length} need review`, {
      phase: 'review_needed',
      highConfidence: highConfidence.length,
      needsReview: needsReview.length
    });

    session.reviewQueue = needsReview;
    session.highConfidence = highConfidence;

    if (needsReview.length > 0) {
      await startStateAttributionReview(sessionId);
    } else {
      await completeStateAttribution(sessionId);
    }

  } catch (error) {
    console.error('State Attribution error:', error);
    await sendStateAttributionStatus(sessionId, 'Error during processing', { phase: 'error', error: error.message });
  }
}

async function startStateAttributionReview(sessionId) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session || session.reviewQueue.length === 0) {
    return await completeStateAttribution(sessionId);
  }

  const item = session.reviewQueue.shift();
  session.currentReview = item;

  session.ws.send(JSON.stringify({
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
      }
    },
    progress: {
      current: session.highConfidence.length + 1,
      total: session.highConfidence.length + session.reviewQueue.length + 1,
      remaining: session.reviewQueue.length
    }
  }));
}

async function handleStateAttributionReview(sessionId, data) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session || !session.currentReview) return;

  const item = session.currentReview;

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
      item.user_skipped = true;
      break;
  }

  if (data.remember && data.action !== 'skip') {
    learningDB[item.group_name] = item.state;
    saveLearningDB();
  }

  session.highConfidence.push(item);
  session.currentReview = null;

  // Apply to duplicates
  if (data.action !== 'skip') {
    const normalizedName = item.group_name.trim().toUpperCase();
    session.reviewQueue = session.reviewQueue.filter(entry => {
      if ((entry.group_name || '').trim().toUpperCase() === normalizedName) {
        entry.state = item.state;
        entry.user_verified = true;
        entry.auto_applied = true;
        session.highConfidence.push(entry);
        return false;
      }
      return true;
    });
  }

  await startStateAttributionReview(sessionId);
}

async function handleStateAttributionAutoApprove(sessionId) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session) return;

  while (session.reviewQueue.length > 0) {
    const item = session.reviewQueue.shift();
    item.auto_approved = true;
    session.highConfidence.push(item);
  }

  await completeStateAttribution(sessionId);
}

async function completeStateAttribution(sessionId) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session) return;

  try {
    await sendStateAttributionStatus(sessionId, 'Generating state attribution report...', { phase: 'report', progress: 90 });

    const outputDir = join(CONFIG.commission.outputDir, session.month);
    mkdirSync(outputDir, { recursive: true });

    // Save processed data
    writeFileSync(
      join(outputDir, 'processed_commission_data.json'),
      JSON.stringify(session.highConfidence, null, 2)
    );

    // Generate CSV
    const csvLines = ['carrier,group_name,commission,state'];
    for (const entry of session.highConfidence) {
      csvLines.push(`${entry.carrier},"${entry.group_name}",${entry.commission},${entry.state}`);
    }
    writeFileSync(join(outputDir, 'commission_output.csv'), csvLines.join('\n'));

    // Run state summary generation
    await runPythonScript('generate_state_summary.py', ['--month', session.month]);

    // Generate Excel report
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MBH State Attribution';
    workbook.created = new Date();

    // State Summary sheet
    const stateSummaryPath = join(outputDir, 'state_summary.csv');
    if (existsSync(stateSummaryPath)) {
      const stateSummarySheet = workbook.addWorksheet('State Summary');
      const stateSummaryContent = readFileSync(stateSummaryPath, 'utf-8');
      const stateRows = stateSummaryContent.split('\n').filter(r => r.trim());
      stateRows.forEach((row, i) => {
        const cells = row.split(',').map(c => c.replace(/^"|"$/g, ''));
        const excelRow = stateSummarySheet.addRow(cells);
        if (i === 0) {
          excelRow.font = { bold: true };
          excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
      });
      stateSummarySheet.columns.forEach(col => { col.width = 15; });
    }

    // Commission Details sheet - grouped by state with subtotals
    const commissionSheet = workbook.addWorksheet('Commission Details');
    const commHeaders = ['State', 'Carrier', 'Group Name', 'Commission'];
    const headerRow = commissionSheet.addRow(commHeaders);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    // Group entries by state
    const byState = {};
    for (const entry of session.highConfidence) {
      const state = entry.state || 'Unknown';
      if (!byState[state]) byState[state] = [];
      byState[state].push(entry);
    }

    // Sort states alphabetically
    const sortedStates = Object.keys(byState).sort();
    let grandTotal = 0;

    for (const state of sortedStates) {
      const entries = byState[state];
      // Sort entries by group name within each state
      entries.sort((a, b) => (a.group_name || '').localeCompare(b.group_name || ''));

      let stateTotal = 0;
      for (const entry of entries) {
        const commission = parseFloat(entry.commission) || 0;
        stateTotal += commission;
        commissionSheet.addRow([state, entry.carrier, entry.group_name, commission]);
      }

      // Add subtotal row for this state
      const subtotalRow = commissionSheet.addRow([`${state} Subtotal`, '', '', stateTotal]);
      subtotalRow.font = { bold: true };
      subtotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

      // Add empty row for spacing
      commissionSheet.addRow([]);

      grandTotal += stateTotal;
    }

    // Add grand total row
    const grandTotalRow = commissionSheet.addRow(['GRAND TOTAL', '', '', grandTotal]);
    grandTotalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    grandTotalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };

    commissionSheet.getColumn(4).numFmt = '$#,##0.00';
    commissionSheet.getColumn(1).width = 18;
    commissionSheet.getColumn(2).width = 18;
    commissionSheet.getColumn(3).width = 35;
    commissionSheet.getColumn(4).width = 15;

    // Store for download
    const buffer = await workbook.xlsx.writeBuffer();
    const [year, month] = session.month.split('-');
    const fileId = `sa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fileName = `State_Attribution_${month}-${year.slice(2)}.xlsx`;

    stateAttributionFiles.set(fileId, { buffer: Buffer.from(buffer), fileName });
    setTimeout(() => stateAttributionFiles.delete(fileId), 30 * 60 * 1000);

    const stats = {
      total: session.highConfidence.length,
      auto_matched: session.highConfidence.filter(e => !e.user_verified && !e.auto_approved && !e.learned).length,
      user_verified: session.highConfidence.filter(e => e.user_verified).length,
      learned: session.highConfidence.filter(e => e.learned).length
    };

    // Build results data for display on page
    const resultsData = {
      byState: {},
      grandTotal: grandTotal
    };
    for (const state of sortedStates) {
      const entries = byState[state];
      const stateTotal = entries.reduce((sum, e) => sum + (parseFloat(e.commission) || 0), 0);
      resultsData.byState[state] = {
        entries: entries.map(e => ({
          carrier: e.carrier,
          group_name: e.group_name,
          commission: parseFloat(e.commission) || 0
        })),
        total: stateTotal
      };
    }

    await sendStateAttributionStatus(sessionId, 'State attribution complete!', { phase: 'complete', progress: 100, stats, fileId, fileName, resultsData });

  } catch (error) {
    console.error('State Attribution completion error:', error);
    await sendStateAttributionStatus(sessionId, 'Error generating report', { phase: 'error', error: error.message });
  }
}

async function sendStateAttributionStatus(sessionId, message, extra = {}) {
  const session = stateAttributionSessions.get(sessionId);
  if (!session?.ws) return;
  session.ws.send(JSON.stringify({ type: 'status', message, ...extra }));
}

// State Attribution upload endpoint
const stateAttributionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const month = req.body.month;
      const dir = join(CONFIG.commission.dataDir, month, 'commission_statements');
      // Clear existing files before new upload (only on first file of batch)
      if (!req._dirCleared) {
        if (existsSync(dir)) {
          const files = readdirSync(dir);
          for (const f of files) {
            unlinkSync(join(dir, f));
          }
          console.log(`🗑️  Cleared ${files.length} old files from ${dir}`);
        }
        req._dirCleared = true;
      }
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
  limits: { fileSize: 50 * 1024 * 1024, files: 50 }
});

app.post('/api/state-attribution/upload',
  authMiddleware,
  stateAttributionUpload.array('commission_statements', 50),
  (req, res) => {
    const month = req.body.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No commission statements uploaded' });
    }

    console.log(`📁 State Attribution upload: ${month} by ${req.user.email} (${files.length} files)`);

    res.json({
      success: true,
      message: 'Files uploaded. Connect WebSocket to start processing.',
      month,
      files: files.length
    });
  }
);

app.get('/api/state-attribution/download/:fileId', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const fileData = stateAttributionFiles.get(req.params.fileId);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.buffer);

  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ============================================
// Bank Reconciliation API Routes (Decoupled)
// ============================================

const bankReconciliationFiles = new Map();

const bankReconciliationUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const month = req.body.month;
      const type = file.fieldname === 'bank_statement' ? 'bank_statement' : 'commission_statements';
      const dir = join(CONFIG.commission.dataDir, month, type);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype === 'application/pdf'),
  limits: { fileSize: 50 * 1024 * 1024, files: 51 }
});

app.post('/api/bank-reconciliation/process',
  authMiddleware,
  bankReconciliationUpload.fields([
    { name: 'commission_statements', maxCount: 50 },
    { name: 'bank_statement', maxCount: 1 }
  ]),
  async (req, res) => {
    const month = req.body.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Invalid month format' });
    }

    const commissionFiles = req.files['commission_statements'] || [];
    const bankFiles = req.files['bank_statement'] || [];

    if (commissionFiles.length === 0) {
      return res.status(400).json({ error: 'No commission statements uploaded' });
    }

    if (bankFiles.length === 0) {
      return res.status(400).json({ error: 'No bank statement uploaded' });
    }

    console.log(`🏦 Bank Reconciliation: ${month} by ${req.user.email}`);
    console.log(`   Commission: ${commissionFiles.length}, Bank: ${bankFiles.length}`);

    try {
      // Step 1: Extract commissions from PDFs
      await runPythonScript('extract_commissions.py', ['--month', month]);

      // Step 2: Generate state summary
      await runPythonScript('generate_state_summary.py', ['--month', month]);

      // Step 3: Run the reconciliation report generator
      await runPythonScript('generate_report.py', ['--month', month]);

      // Generate Excel report
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MBH Bank Reconciliation';
      workbook.created = new Date();

      const outputDir = join(CONFIG.commission.outputDir, month);

      // Load reconciliation data
      const reconciliationPath = join(outputDir, 'reconciliation.csv');
      if (existsSync(reconciliationPath)) {
        const reconcSheet = workbook.addWorksheet('Reconciliation');
        const reconcContent = readFileSync(reconciliationPath, 'utf-8');
        const reconcRows = reconcContent.split('\n').filter(r => r.trim());

        let matched = 0, variances = 0, unmatchedComm = 0, unmatchedBank = 0;

        reconcRows.forEach((row, i) => {
          const cells = row.split(',').map(c => c.replace(/^"|"$/g, ''));
          const excelRow = reconcSheet.addRow(cells);
          if (i === 0) {
            excelRow.font = { bold: true };
            excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          } else {
            // Count stats based on row data
            const status = cells[cells.length - 1] || '';
            if (status.includes('matched') || status.includes('Matched')) matched++;
            else if (status.includes('variance') || status.includes('Variance')) variances++;
            else if (status.includes('unmatched') && status.toLowerCase().includes('commission')) unmatchedComm++;
            else if (status.includes('unmatched') && status.toLowerCase().includes('bank')) unmatchedBank++;
          }
        });
        reconcSheet.columns.forEach(col => { col.width = 18; });

        // Store stats
        const stats = { matched, variances, unmatchedCommission: unmatchedComm, unmatchedBank };

        // Store for download
        const buffer = await workbook.xlsx.writeBuffer();
        const [year, monthNum] = month.split('-');
        const fileId = `br_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `Bank_Reconciliation_${monthNum}-${year.slice(2)}.xlsx`;

        bankReconciliationFiles.set(fileId, { buffer: Buffer.from(buffer), fileName });
        setTimeout(() => bankReconciliationFiles.delete(fileId), 30 * 60 * 1000);

        res.json({
          success: true,
          fileId,
          fileName,
          stats
        });
      } else {
        res.status(500).json({ error: 'Reconciliation output not found' });
      }

    } catch (error) {
      console.error('Bank Reconciliation error:', error);
      res.status(500).json({ error: error.message || 'Reconciliation failed' });
    }
  }
);

app.get('/api/bank-reconciliation/download/:fileId', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const fileData = bankReconciliationFiles.get(req.params.fileId);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.xlsx');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.buffer);

  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ============================================
// Deduction Report API Routes
// ============================================

// Temporary file storage for downloads
const deductionFiles = new Map();

const deductionUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    cb(null, file.originalname.toLowerCase().endsWith('.csv'));
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 20 }
});

app.post('/api/deduction/process',
  authMiddleware,
  deductionUpload.array('files', 20),
  async (req, res) => {
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No CSV files uploaded' });
    }

    // Parse settings from form data
    let settings = {
      frequency: 'semi-monthly',
      contributionType: 'none',
      contributionValue: 0
    };

    if (req.body.settings) {
      try {
        settings = { ...settings, ...JSON.parse(req.body.settings) };
      } catch (e) {
        console.warn('Failed to parse settings, using defaults');
      }
    }

    console.log(`📋 Deduction processing: ${files.length} files by ${req.user.email}`);
    console.log(`   Settings: frequency=${settings.frequency}, contribution=${settings.contributionType} ${settings.contributionValue}`);

    // Column mapping from user
    const columnMapping = settings.columnMapping || {};
    const columnDefaults = settings.columnDefaults || {};
    const columnSpecial = settings.columnSpecial || {};  // FROM_FILENAME, LEAVE_BLANK
    const payorNameOverride = settings.payorNameOverride || null;

    // Parse filenames from form data
    let filenames = [];
    try {
      if (req.body.filenames) {
        filenames = JSON.parse(req.body.filenames);
      }
    } catch (e) {
      // Fall back to file.originalname
    }

    console.log(`   Column mapping:`, columnMapping);
    console.log(`   Special handling:`, columnSpecial);
    if (payorNameOverride) {
      console.log(`   Payor override: ${payorNameOverride}`);
    }

    try {
      // Import deduction report modules dynamically
      const { parseCSVWithMapping } = await import('/home/sam/chatbot-platform/mbh/deduction-report/src/csv-parser.js');
      const { transform } = await import('/home/sam/chatbot-platform/mbh/deduction-report/src/data-transformer.js');
      const { createWorkbook, getWorkbookBuffer } = await import('/home/sam/chatbot-platform/mbh/deduction-report/src/excel-generator.js');
      const config = (await import('/home/sam/chatbot-platform/mbh/deduction-report/src/config.js')).default;

      // Parse all CSV files and combine rows
      let combinedRows = [];
      let accountNumber = '';
      let accountName = '';
      let totalInputRows = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = filenames[i] || file.originalname;

        // Always extract product type from filename (for auto-detection or explicit FROM_FILENAME)
        // e.g., "dental.csv" -> "Dental", "Vision_2025.csv" -> "Vision", "misc-input.csv" -> "Misc"
        let filenameProductType = null;
        const baseName = filename.replace(/\.csv$/i, '').replace(/[_\-\d]+/g, ' ').trim();
        const words = baseName.split(/\s+/);
        if (words.length > 0) {
          filenameProductType = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
        }

        const csvData = parseCSVWithMapping(file.buffer, columnMapping, columnDefaults, columnSpecial, payorNameOverride, filenameProductType);
        console.log(`   Parsed ${csvData.rows.length} rows from ${filename}${filenameProductType ? ` (Product: ${filenameProductType})` : ''}`);
        totalInputRows += csvData.rows.length;
        combinedRows = combinedRows.concat(csvData.rows);

        // Use account info from first file (or last non-empty)
        if (csvData.accountNumber) accountNumber = csvData.accountNumber;
        if (csvData.accountName) accountName = csvData.accountName;
      }

      // Use payor name as account name if provided and no account name found
      const combinedData = {
        accountNumber: accountNumber || 'COMBINED',
        accountName: accountName || payorNameOverride || 'Combined Report',
        rows: combinedRows
      };

      console.log(`   Combined total: ${combinedRows.length} rows`);

      // Transform with user settings
      const transformedData = transform(combinedData, config, settings);
      console.log(`   Transformed to ${transformedData.rows.length} rows`);

      // Generate Excel
      const workbook = await createWorkbook(transformedData, config);
      const excelBuffer = await getWorkbookBuffer(workbook);

      // Store for download
      const fileId = randomUUID();
      const now = new Date();
      const runDate = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)}`;
      const fileName = `${runDate}-${transformedData.accountName}-deduction-report.xlsx`;

      deductionFiles.set(fileId, {
        buffer: excelBuffer,
        fileName,
        createdAt: Date.now(),
        user: req.user.email
      });

      // Clean up old files after 1 hour
      setTimeout(() => deductionFiles.delete(fileId), 60 * 60 * 1000);

      res.json({
        success: true,
        fileId,
        fileName,
        stats: {
          inputRows: totalInputRows,
          outputRows: transformedData.rows.length,
          filesProcessed: files.length
        }
      });

    } catch (error) {
      console.error('Deduction processing error:', error);
      res.status(500).json({ error: error.message || 'Processing failed' });
    }
  }
);

app.get('/api/deduction/download/:fileId', async (req, res) => {
  const token = req.query.token;

  // Validate token
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const fileData = deductionFiles.get(req.params.fileId);

    if (!fileData) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.buffer);

  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ============================================
// Nicole's Deduction Report API Routes
// ============================================

// Temporary file storage for Nicole's report downloads
const nicoleDeductionFiles = new Map();

const nicoleDeductionUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    cb(null, file.originalname.toLowerCase().endsWith('.csv'));
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

app.post('/api/deduction-report-nicole/generate',
  authMiddleware,
  nicoleDeductionUpload.single('file'),
  async (req, res) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    // Parse settings from form data
    let settings = {
      payCycle: 'Semi-Monthly',
      reportDate: ''
    };

    if (req.body.settings) {
      try {
        settings = { ...settings, ...JSON.parse(req.body.settings) };
      } catch (e) {
        console.warn('Failed to parse settings, using defaults');
      }
    }

    console.log(`📋 Nicole's Deduction Report: ${file.originalname} by ${req.user.email}`);
    console.log(`   Settings: payCycle=${settings.payCycle}, reportDate=${settings.reportDate}`);

    try {
      // Parse CSV
      const Papa = (await import('papaparse')).default;
      const csvContent = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
      });

      if (parseResult.errors.length > 0) {
        console.warn('CSV parse warnings:', parseResult.errors.slice(0, 3));
      }

      const csvRows = parseResult.data;
      console.log(`   Parsed ${csvRows.length} rows from CSV`);

      // Import Nicole's deduction report modules
      const { transform } = await import('/home/sam/chatbot-platform/mbh/deduction-report-nicole/src/data-transformer.js');
      const { generateExcelBuffer } = await import('/home/sam/chatbot-platform/mbh/deduction-report-nicole/src/excel-generator.js');

      // Transform data
      const transformedData = transform(csvRows, settings);
      console.log(`   Transformed to ${transformedData.rows.length} rows`);

      // Generate Excel
      const excelBuffer = await generateExcelBuffer(transformedData);

      // Store for download
      const fileId = randomUUID();
      const companyName = (transformedData.companyName || 'Report').replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const fileName = `${companyName}_Payroll_Deduction_Report.xlsx`;

      nicoleDeductionFiles.set(fileId, {
        buffer: excelBuffer,
        fileName,
        createdAt: Date.now(),
        user: req.user.email
      });

      // Clean up old files after 1 hour
      setTimeout(() => nicoleDeductionFiles.delete(fileId), 60 * 60 * 1000);

      res.json({
        success: true,
        fileId,
        fileName,
        stats: {
          inputRows: csvRows.length,
          outputRows: transformedData.rows.length,
          companyName: transformedData.companyName
        }
      });

    } catch (error) {
      console.error("Nicole's deduction report error:", error);
      res.status(500).json({ error: error.message || 'Processing failed' });
    }
  }
);

app.get('/api/deduction-report-nicole/download/:fileId', async (req, res) => {
  const token = req.query.token;

  // Validate token
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const fileData = nicoleDeductionFiles.get(req.params.fileId);

    if (!fileData) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.buffer);

  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ============================================
// Discrepancy Analyzer API Routes (Two-Phase Flow)
// ============================================

// Temporary file storage for discrepancy downloads
const discrepancyFiles = new Map();
const discrepancySessions = new Map(); // Store session state across phases

const discrepancyUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    cb(null, ext.endsWith('.xlsx') || ext.endsWith('.xls'));
  },
  limits: { fileSize: 20 * 1024 * 1024, files: 2 }
});

// PHASE 1: Upload files and get name matches
app.post('/api/discrepancy/analyze',
  authMiddleware,
  discrepancyUpload.fields([
    { name: 'carrierFile', maxCount: 1 },
    { name: 'payrollFile', maxCount: 1 }
  ]),
  async (req, res) => {
    const carrierFile = req.files['carrierFile']?.[0];
    const payrollFile = req.files['payrollFile']?.[0];

    if (!carrierFile || !payrollFile) {
      return res.status(400).json({ error: 'Both carrier and payroll files required' });
    }

    // Parse settings
    let settings = {};
    if (req.body.settings) {
      try {
        settings = JSON.parse(req.body.settings);
      } catch (e) {
        console.warn('Failed to parse settings');
      }
    }

    console.log(`📊 Discrepancy analysis: ${carrierFile.originalname} vs ${payrollFile.originalname} by ${req.user.email}`);

    try {
      // Import discrepancy analyzer modules
      const { parseExcel } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/excel-parser.js');
      const { findNameMatches } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/matcher.js');

      // Parse both files
      const carrierData = await parseExcel(carrierFile.buffer);
      const payrollData = await parseExcel(payrollFile.buffer);

      console.log(`   Carrier: ${carrierData.rowCount} rows, headers: ${carrierData.headers.slice(0, 5).join(', ')}...`);
      console.log(`   Payroll: ${payrollData.rowCount} rows, headers: ${payrollData.headers.slice(0, 5).join(', ')}...`);

      // Fetch learned name mappings from Supabase (filtered by group)
      const groupName = settings.groupName || '';
      const reportMonth = settings.reportMonth || '';
      let learnedMappings = [];
      try {
        const query = supabase
          .from('mbh_name_mappings')
          .select('carrier_last_name, carrier_first_name, payroll_last_name, payroll_first_name');

        // Filter by group if provided
        if (groupName) {
          query.eq('account_name', groupName);
        }

        const { data } = await query;
        learnedMappings = data || [];
        console.log(`   Loaded ${learnedMappings.length} learned name mappings for group: ${groupName || '(all)'}`);
      } catch (e) {
        console.warn('   Could not load learned mappings:', e.message);
      }

      // Run Phase 1: Name matching
      const phase1Results = findNameMatches(carrierData.rows, payrollData.rows, {
        carrierLastName: settings.carrierLastName || 'LAST',
        carrierFirstName: settings.carrierFirstName || 'FIRST',
        carrierPremium: settings.carrierPremium || 'Monthly',
        carrierProductType: settings.carrierProductType || 'Product Type',
        payrollLastName: settings.payrollLastName || 'Last',
        payrollFirstName: settings.payrollFirstName || 'First',
        payrollPremium: settings.payrollPremium || 'Monthly Premium',
        payrollProductType: settings.payrollProductType || 'Benefit Plan',
        nameMatchThreshold: settings.nameMatchThreshold ?? 80,
        learnedMappings
      });

      console.log(`   Phase 1: ${phase1Results.exactMatches.length} exact, ${phase1Results.learnedMatches.length} learned, ${phase1Results.fuzzyMatches.length} fuzzy`);
      console.log(`   Unmatched: ${phase1Results.unmatchedCarrier.length} carrier, ${phase1Results.unmatchedPayroll.length} payroll`);

      // Store session for subsequent phases
      const sessionId = randomUUID();
      discrepancySessions.set(sessionId, {
        phase1Results,
        settings,
        user: req.user.email,
        createdAt: Date.now(),
        phase: 'name_review'
      });

      // Clean up after 1 hour
      setTimeout(() => discrepancySessions.delete(sessionId), 60 * 60 * 1000);

      res.json({
        success: true,
        sessionId,
        phase: 'name_review',
        carrierHeaders: carrierData.headers,
        payrollHeaders: payrollData.headers,
        summary: phase1Results.summary,
        exactMatches: phase1Results.exactMatches.length,
        learnedMatches: phase1Results.learnedMatches.length,
        fuzzyMatches: phase1Results.fuzzyMatches.map((m, i) => ({
          index: i,
          carrierName: `${m.carrier.lastName}, ${m.carrier.firstName}`,
          payrollName: `${m.payroll.lastName}, ${m.payroll.firstName}`,
          similarityScore: m.similarityScore,
          carrierPremium: m.carrier.totalPremium,
          payrollPremium: m.payroll.totalPremium
        })),
        unmatchedCarrier: phase1Results.unmatchedCarrier.length,
        unmatchedPayroll: phase1Results.unmatchedPayroll.length
      });

    } catch (error) {
      console.error('Discrepancy analysis error:', error);
      res.status(500).json({ error: error.message || 'Analysis failed' });
    }
  }
);

// PHASE 1 COMPLETE: Submit name match decisions, get premium discrepancies
app.post('/api/discrepancy/submit-names',
  authMiddleware,
  async (req, res) => {
    const { sessionId, decisions, generateReport } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = discrepancySessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    console.log(`📊 Name decisions: ${decisions?.length || 0} for session ${sessionId}`);

    try {
      const { applyNameDecisions, comparePremiums } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/matcher.js');

      // Apply name decisions (or empty array if no fuzzy matches)
      const nameResults = applyNameDecisions(session.phase1Results, decisions || []);

      // Save approved mappings to Supabase for future use (with group name)
      const groupName = session.settings.groupName || '';
      if (nameResults.approvedMappings.length > 0) {
        try {
          for (const mapping of nameResults.approvedMappings) {
            await supabase
              .from('mbh_name_mappings')
              .upsert({
                ...mapping,
                account_name: groupName,
                created_by: session.user
              }, {
                onConflict: 'carrier_last_name,carrier_first_name,payroll_last_name,payroll_first_name,account_name'
              });
          }
          console.log(`   Saved ${nameResults.approvedMappings.length} new name mappings for group: ${groupName}`);
        } catch (e) {
          console.warn('   Could not save name mappings:', e.message);
        }
      }

      // Run Phase 2: Premium comparison
      const premiumTolerance = session.settings.premiumTolerance ?? 0.05;
      const phase2Results = comparePremiums(nameResults.confirmedMatches, { premiumTolerance });

      console.log(`   Phase 2: ${phase2Results.perfectMatches.length} perfect, ${phase2Results.premiumDiscrepancies.length} discrepancies`);

      // If generateReport flag is set, skip premium review and generate report directly
      if (generateReport) {
        const { generateTwoPhaseReport, getWorkbookBuffer } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/report-generator.js');

        // Build final results - all discrepancies go to unresolved (no approval step)
        const finalResults = {
          perfectMatches: phase2Results.perfectMatches,
          acknowledgedDiscrepancies: [],
          unresolvedDiscrepancies: phase2Results.premiumDiscrepancies,
          unmatchedCarrier: nameResults.unmatchedCarrier,
          unmatchedPayroll: nameResults.unmatchedPayroll,
          summary: session.phase1Results.summary
        };

        const workbook = await generateTwoPhaseReport(finalResults);
        const buffer = await getWorkbookBuffer(workbook);

        // Generate filename: GroupName-discrepancies-MM-YY.xlsx
        const reportMonth = session.settings.reportMonth || '';
        let monthStr = '';
        if (reportMonth) {
          const [year, month] = reportMonth.split('-');
          monthStr = `${month}-${year.slice(2)}`;
        } else {
          const now = new Date();
          monthStr = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getFullYear()).slice(2)}`;
        }
        const safeGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '-') || 'Report';

        const fileId = `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `${safeGroupName}-discrepancies-${monthStr}.xlsx`;

        discrepancyFiles.set(fileId, { buffer, fileName });
        setTimeout(() => discrepancyFiles.delete(fileId), 30 * 60 * 1000);

        console.log(`   Generated report: ${fileName}`);

        return res.json({
          success: true,
          fileId,
          fileName,
          perfectMatches: phase2Results.perfectMatches.length,
          premiumDiscrepancies: phase2Results.premiumDiscrepancies.length
        });
      }

      // Update session for Phase 2 (legacy flow)
      session.nameResults = nameResults;
      session.phase2Results = phase2Results;
      session.phase = 'premium_review';

      res.json({
        success: true,
        sessionId,
        phase: 'premium_review',
        perfectMatches: phase2Results.perfectMatches.length,
        premiumDiscrepancies: phase2Results.premiumDiscrepancies.map((d, i) => ({
          index: i,
          name: `${d.carrier.lastName}, ${d.carrier.firstName}`,
          matchType: d.matchType,
          carrierPremium: d.carrier.totalPremium,
          payrollPremium: d.payroll.totalPremium,
          premiumDiff: d.premiumDiff,
          carrierProducts: d.carrier.products.map(p => `${p.productType}: $${p.premium.toFixed(2)}`),
          payrollProducts: d.payroll.products.map(p => `${p.productType}: $${p.premium.toFixed(2)}`)
        })),
        unmatchedCarrier: nameResults.unmatchedCarrier.length,
        unmatchedPayroll: nameResults.unmatchedPayroll.length
      });

    } catch (error) {
      console.error('Name decision error:', error);
      res.status(500).json({ error: error.message || 'Processing failed' });
    }
  }
);

// PHASE 2 COMPLETE: Submit premium decisions and generate report
app.post('/api/discrepancy/submit-premiums',
  authMiddleware,
  async (req, res) => {
    const { sessionId, decisions } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = discrepancySessions.get(sessionId);
    if (!session || session.phase !== 'premium_review') {
      return res.status(404).json({ error: 'Session not found or not in premium review phase' });
    }

    console.log(`📊 Premium decisions: ${decisions?.length || 0} for session ${sessionId}`);

    try {
      const { applyPremiumDecisions } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/matcher.js');
      const { generateTwoPhaseReport, getWorkbookBuffer } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/report-generator.js');

      // Apply premium decisions
      const finalResults = applyPremiumDecisions(session.phase2Results, decisions || []);

      // Generate Excel report
      const workbook = await generateTwoPhaseReport({
        perfectMatches: finalResults.perfectMatches,
        acknowledgedDiscrepancies: finalResults.acknowledgedDiscrepancies,
        unresolvedDiscrepancies: finalResults.unresolvedDiscrepancies,
        unmatchedCarrier: session.nameResults.unmatchedCarrier,
        unmatchedPayroll: session.nameResults.unmatchedPayroll,
        summary: session.nameResults.summary
      });
      const excelBuffer = await getWorkbookBuffer(workbook);

      // Store for download
      const fileId = randomUUID();
      const fileName = `Discrepancy_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

      discrepancyFiles.set(fileId, {
        buffer: excelBuffer,
        fileName,
        createdAt: Date.now(),
        user: session.user
      });

      // Clean up
      setTimeout(() => discrepancyFiles.delete(fileId), 60 * 60 * 1000);
      discrepancySessions.delete(sessionId);

      res.json({
        success: true,
        fileId,
        fileName,
        summary: {
          perfectMatches: finalResults.perfectMatches.length,
          acknowledgedDiscrepancies: finalResults.acknowledgedDiscrepancies.length,
          unresolvedDiscrepancies: finalResults.unresolvedDiscrepancies.length,
          unmatchedCarrier: session.nameResults.unmatchedCarrier.length,
          unmatchedPayroll: session.nameResults.unmatchedPayroll.length
        }
      });

    } catch (error) {
      console.error('Premium decision error:', error);
      res.status(500).json({ error: error.message || 'Report generation failed' });
    }
  }
);

// Skip directly to report (no fuzzy matches or user wants defaults)
app.post('/api/discrepancy/generate-report',
  authMiddleware,
  async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const session = discrepancySessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }

    try {
      const { applyNameDecisions, comparePremiums } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/matcher.js');
      const { generateTwoPhaseReport, getWorkbookBuffer } = await import('/home/sam/chatbot-platform/mbh/discrepancy-analyzer/src/report-generator.js');

      // Auto-approve all fuzzy matches
      const allApproved = session.phase1Results.fuzzyMatches.map((_, i) => ({ index: i, approved: true }));
      const nameResults = applyNameDecisions(session.phase1Results, allApproved);

      // Compare premiums
      const premiumTolerance = session.settings.premiumTolerance ?? 0.05;
      const phase2Results = comparePremiums(nameResults.confirmedMatches, { premiumTolerance });

      // Mark all discrepancies as unresolved
      const finalResults = {
        perfectMatches: phase2Results.perfectMatches,
        acknowledgedDiscrepancies: [],
        unresolvedDiscrepancies: phase2Results.premiumDiscrepancies.map(d => ({ ...d, status: 'unresolved' }))
      };

      // Generate report
      const workbook = await generateTwoPhaseReport({
        ...finalResults,
        unmatchedCarrier: nameResults.unmatchedCarrier,
        unmatchedPayroll: nameResults.unmatchedPayroll,
        summary: nameResults.summary
      });
      const excelBuffer = await getWorkbookBuffer(workbook);

      const fileId = randomUUID();
      const fileName = `Discrepancy_Report_${new Date().toISOString().split('T')[0]}.xlsx`;

      discrepancyFiles.set(fileId, {
        buffer: excelBuffer,
        fileName,
        createdAt: Date.now(),
        user: session.user
      });

      setTimeout(() => discrepancyFiles.delete(fileId), 60 * 60 * 1000);
      discrepancySessions.delete(sessionId);

      res.json({
        success: true,
        fileId,
        fileName
      });

    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({ error: error.message || 'Generation failed' });
    }
  }
);

app.get('/api/discrepancy/download/:fileId', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const fileData = discrepancyFiles.get(req.params.fileId);

    if (!fileData) {
      return res.status(404).json({ error: 'File not found or expired' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.buffer);

  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// ============================================
// Health & Stats
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MBH Tools API',
    timestamp: new Date().toISOString(),
    activeSessions: activeSessions.size,
    learnedCorrections: Object.keys(learningDB).length
  });
});

app.get('/api/stats/learning', authMiddleware, (req, res) => {
  res.json({
    total: Object.keys(learningDB).length,
    entries: Object.entries(learningDB).map(([name, state]) => ({ name, state }))
  });
});

// ============================================
// Error Handling
// ============================================

app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }

  res.status(500).json({ error: error.message || 'Internal server error' });
});

// ============================================
// Start Server
// ============================================

server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 MBH Tools API Server`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🌐 HTTP:      http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📊 Commission: ${CONFIG.commission.scriptsDir}`);
  console.log(`📋 Deduction:  ${CONFIG.deduction.scriptsDir}`);
  console.log(`🧠 Learning:   ${Object.keys(learningDB).length} entries`);
  console.log(`${'='.repeat(60)}\n`);
});
