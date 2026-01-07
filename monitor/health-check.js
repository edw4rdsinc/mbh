#!/usr/bin/env node

/**
 * MBH Health Check Monitor
 *
 * Monitors both commission-automator and deduction-report systems
 * Sends alerts when issues are detected
 *
 * Run via cron: Every 15 minutes - /usr/bin/node /home/sam/chatbot-platform/mbh/monitor/health-check.js
 */

import { exec } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  resendApiKey: 're_JgqiiJdh_5SBPNDVZEmK5acfWdp2kLm8M',
  alertEmail: 'sam@edw4rds.com',
  fromEmail: 'reports@updates.edw4rds.com',

  services: {
    commissionPortal: {
      name: 'Commission Portal',
      url: 'https://mbh.comp.edw4rds.com/',
      pm2Name: 'commission-portal-interactive',
      logPath: '/home/sam/logs/commission-portal-error-8.log',
      expectedUptime: 3600, // 1 hour minimum
    },
    deductionReport: {
      name: 'Deduction Report Email Processor',
      logPath: '/tmp/email-processor.log',
      cronInterval: 5 * 60 * 1000, // 5 minutes
    }
  }
};

// Health check results
const results = {
  timestamp: new Date().toISOString(),
  healthy: true,
  issues: [],
  warnings: [],
  services: {}
};

/**
 * Check PM2 process health
 */
async function checkPM2Process(serviceName) {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);

    const process = processes.find(p => p.name === serviceName);

    if (!process) {
      return {
        status: 'error',
        message: `Process ${serviceName} not found in PM2`
      };
    }

    if (process.pm2_env.status !== 'online') {
      return {
        status: 'error',
        message: `Process is ${process.pm2_env.status} (expected: online)`
      };
    }

    const uptime = process.pm2_env.pm_uptime;
    const restarts = process.pm2_env.restart_time;

    if (restarts > 50) {
      return {
        status: 'warning',
        message: `High restart count: ${restarts} restarts`
      };
    }

    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - uptime) / 1000),
      restarts,
      memory: Math.floor(process.monit.memory / 1024 / 1024) + 'MB',
      cpu: process.monit.cpu + '%'
    };

  } catch (error) {
    return {
      status: 'error',
      message: `Failed to check PM2: ${error.message}`
    };
  }
}

/**
 * Check HTTP endpoint health
 */
async function checkHTTPEndpoint(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MBH-Health-Check/1.0' }
    });

    clearTimeout(timeout);

    // 401 is OK for basic auth protected endpoint
    if (response.status === 401 || response.status === 200) {
      return {
        status: 'ok',
        httpStatus: response.status,
        responseTime: response.headers.get('x-response-time') || 'N/A'
      };
    }

    return {
      status: 'error',
      message: `HTTP ${response.status}: ${response.statusText}`
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        status: 'error',
        message: 'Request timeout (10s)'
      };
    }

    return {
      status: 'error',
      message: `HTTP check failed: ${error.message}`
    };
  }
}

/**
 * Check log file for recent errors
 */
function checkLogErrors(logPath, minutesBack = 15) {
  if (!existsSync(logPath)) {
    return {
      status: 'warning',
      message: `Log file not found: ${logPath}`
    };
  }

  try {
    const log = readFileSync(logPath, 'utf-8');
    const lines = log.split('\n').slice(-500); // Last 500 lines

    const cutoffTime = Date.now() - (minutesBack * 60 * 1000);
    const recentErrors = [];

    for (const line of lines) {
      // Look for error patterns
      if (line.match(/error|failed|exception|❌/i)) {
        // Try to extract timestamp
        const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
        if (timeMatch) {
          const logTime = new Date(timeMatch[1]).getTime();
          if (logTime > cutoffTime) {
            recentErrors.push(line.substring(0, 200)); // Truncate long lines
          }
        } else {
          // No timestamp, assume recent
          recentErrors.push(line.substring(0, 200));
        }
      }
    }

    if (recentErrors.length > 10) {
      return {
        status: 'error',
        message: `${recentErrors.length} errors in last ${minutesBack} minutes`,
        sample: recentErrors.slice(0, 3)
      };
    }

    if (recentErrors.length > 0) {
      return {
        status: 'warning',
        message: `${recentErrors.length} errors in last ${minutesBack} minutes`,
        sample: recentErrors.slice(0, 2)
      };
    }

    return {
      status: 'ok',
      errors: 0
    };

  } catch (error) {
    return {
      status: 'warning',
      message: `Failed to read log: ${error.message}`
    };
  }
}

/**
 * Check cron job last run
 */
function checkCronLastRun(logPath) {
  if (!existsSync(logPath)) {
    return {
      status: 'warning',
      message: 'Log file not found - cron may not be running'
    };
  }

  try {
    const log = readFileSync(logPath, 'utf-8');
    const lines = log.split('\n');

    // Find last "Email processing complete" or timestamp
    const lastRunLine = lines.reverse().find(line =>
      line.includes('Email processing complete') ||
      line.includes('Checking for new emails')
    );

    if (!lastRunLine) {
      return {
        status: 'warning',
        message: 'Cannot determine last run time'
      };
    }

    // Extract timestamp
    const timeMatch = lastRunLine.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
    if (!timeMatch) {
      return {
        status: 'warning',
        message: 'Cannot parse timestamp from log'
      };
    }

    const lastRun = new Date(timeMatch[1]).getTime();
    const minutesSince = Math.floor((Date.now() - lastRun) / 60000);

    if (minutesSince > 10) {
      return {
        status: 'error',
        message: `Last run was ${minutesSince} minutes ago (expected: < 10 min)`
      };
    }

    return {
      status: 'ok',
      lastRun: minutesSince + ' minutes ago'
    };

  } catch (error) {
    return {
      status: 'warning',
      message: `Failed to check cron: ${error.message}`
    };
  }
}

/**
 * Send alert email
 */
async function sendAlert(subject, body) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: CONFIG.fromEmail,
        to: [CONFIG.alertEmail],
        subject: `🚨 MBH Alert: ${subject}`,
        html: body
      })
    });

    if (!response.ok) {
      console.error('Failed to send alert:', await response.text());
    }

  } catch (error) {
    console.error('Error sending alert:', error.message);
  }
}

/**
 * Format results as HTML email
 */
function formatEmailReport() {
  let html = `
    <h2>MBH Systems Health Check</h2>
    <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Overall Status:</strong> ${results.healthy ? '✅ Healthy' : '❌ Issues Detected'}</p>
    <hr>
  `;

  for (const [key, service] of Object.entries(results.services)) {
    html += `<h3>${service.name}</h3>`;
    html += '<ul>';

    for (const [check, result] of Object.entries(service.checks)) {
      const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      html += `<li>${icon} <strong>${check}:</strong> `;

      if (result.message) {
        html += result.message;
      } else {
        html += JSON.stringify(result, null, 2);
      }

      if (result.sample) {
        html += '<br><code>' + result.sample.join('<br>') + '</code>';
      }

      html += '</li>';
    }

    html += '</ul>';
  }

  if (results.issues.length > 0) {
    html += '<h3>Issues</h3><ul>';
    for (const issue of results.issues) {
      html += `<li>❌ ${issue}</li>`;
    }
    html += '</ul>';
  }

  if (results.warnings.length > 0) {
    html += '<h3>Warnings</h3><ul>';
    for (const warning of results.warnings) {
      html += `<li>⚠️ ${warning}</li>`;
    }
    html += '</ul>';
  }

  return html;
}

/**
 * Main health check
 */
async function runHealthCheck() {
  console.log('🏥 Running MBH Health Check...');
  console.log('Time:', new Date().toLocaleString());
  console.log('='.repeat(80));

  // Check Commission Portal
  console.log('\n📊 Commission Portal:');
  const commissionChecks = {};

  // PM2 process
  commissionChecks.pm2Process = await checkPM2Process(CONFIG.services.commissionPortal.pm2Name);
  console.log('  PM2:', commissionChecks.pm2Process.status);

  // HTTP endpoint
  commissionChecks.httpEndpoint = await checkHTTPEndpoint(CONFIG.services.commissionPortal.url);
  console.log('  HTTP:', commissionChecks.httpEndpoint.status);

  // Error logs
  commissionChecks.errorLogs = checkLogErrors(CONFIG.services.commissionPortal.logPath);
  console.log('  Logs:', commissionChecks.errorLogs.status);

  results.services.commissionPortal = {
    name: CONFIG.services.commissionPortal.name,
    checks: commissionChecks
  };

  // Check Deduction Report
  console.log('\n📧 Deduction Report:');
  const deductionChecks = {};

  // Cron last run
  deductionChecks.cronJob = checkCronLastRun(CONFIG.services.deductionReport.logPath);
  console.log('  Cron:', deductionChecks.cronJob.status);

  // Error logs
  deductionChecks.errorLogs = checkLogErrors(CONFIG.services.deductionReport.logPath);
  console.log('  Logs:', deductionChecks.errorLogs.status);

  results.services.deductionReport = {
    name: CONFIG.services.deductionReport.name,
    checks: deductionChecks
  };

  // Determine overall health
  for (const service of Object.values(results.services)) {
    for (const check of Object.values(service.checks)) {
      if (check.status === 'error') {
        results.healthy = false;
        results.issues.push(`${service.name}: ${check.message || JSON.stringify(check)}`);
      } else if (check.status === 'warning') {
        results.warnings.push(`${service.name}: ${check.message || JSON.stringify(check)}`);
      }
    }
  }

  // Send alerts if issues detected
  if (!results.healthy) {
    console.log('\n🚨 ISSUES DETECTED - Sending alert email...');
    await sendAlert(
      `${results.issues.length} Issue(s) Detected`,
      formatEmailReport()
    );
  } else if (results.warnings.length > 0) {
    console.log('\n⚠️ Warnings detected (no alert sent)');
  } else {
    console.log('\n✅ All systems healthy');
  }

  console.log('='.repeat(80));
  console.log('Health check complete\n');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHealthCheck()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

export { runHealthCheck };
