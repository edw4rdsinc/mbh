/**
 * Excel Report Generator for Discrepancy Analyzer
 * Supports both legacy and two-phase report formats
 */

import ExcelJS from 'exceljs';

/**
 * Generate two-phase discrepancy report Excel file
 */
export async function generateTwoPhaseReport(results, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MBH Discrepancy Analyzer';
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  addTwoPhaseSummary(summarySheet, results);

  // Perfect Matches sheet
  if (results.perfectMatches?.length > 0) {
    const matchSheet = workbook.addWorksheet('Matches');
    addMatchesSheet(matchSheet, results.perfectMatches);
  }

  // Premium Discrepancies - Acknowledged
  if (results.acknowledgedDiscrepancies?.length > 0) {
    const ackSheet = workbook.addWorksheet('Acknowledged Discrepancies');
    addDiscrepanciesSheet(ackSheet, results.acknowledgedDiscrepancies, 'Acknowledged');
  }

  // Premium Discrepancies - Unresolved
  if (results.unresolvedDiscrepancies?.length > 0) {
    const unresolvedSheet = workbook.addWorksheet('Unresolved Discrepancies');
    addDiscrepanciesSheet(unresolvedSheet, results.unresolvedDiscrepancies, 'Needs Review');
  }

  // Missing from Payroll (in carrier, not in payroll)
  if (results.unmatchedCarrier?.length > 0) {
    const missingPayrollSheet = workbook.addWorksheet('Missing from Payroll');
    addMissingSheet(missingPayrollSheet, results.unmatchedCarrier, 'Carrier');
  }

  // Missing from Carrier (in payroll, not in carrier)
  if (results.unmatchedPayroll?.length > 0) {
    const missingCarrierSheet = workbook.addWorksheet('Missing from Carrier');
    addMissingSheet(missingCarrierSheet, results.unmatchedPayroll, 'Payroll');
  }

  return workbook;
}

function addTwoPhaseSummary(sheet, results) {
  // Title
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = 'Discrepancy Analysis Summary';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  // Date
  sheet.getCell('A3').value = 'Report Generated:';
  sheet.getCell('B3').value = new Date().toLocaleDateString();

  const summary = results.summary || {};
  const stats = [
    ['', ''],
    ['Source Statistics', ''],
    ['Carrier Employees', summary.carrierEmployees || 0],
    ['Payroll Employees', summary.payrollEmployees || 0],
    ['Carrier Total Premium', `$${(summary.carrierTotalPremium || 0).toFixed(2)}`],
    ['Payroll Total Premium', `$${(summary.payrollTotalPremium || 0).toFixed(2)}`],
    ['Premium Difference', `$${Math.abs((summary.carrierTotalPremium || 0) - (summary.payrollTotalPremium || 0)).toFixed(2)}`],
    ['', ''],
    ['Match Results', ''],
    ['Perfect Matches', results.perfectMatches?.length || 0],
    ['Acknowledged Discrepancies', results.acknowledgedDiscrepancies?.length || 0],
    ['Unresolved Discrepancies', results.unresolvedDiscrepancies?.length || 0],
    ['Missing from Payroll', results.unmatchedCarrier?.length || 0],
    ['Missing from Carrier', results.unmatchedPayroll?.length || 0],
  ];

  let row = 5;
  for (const [label, value] of stats) {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`B${row}`).value = value;
    if (label.includes('Statistics') || label.includes('Results')) {
      sheet.getCell(`A${row}`).font = { bold: true };
    }
    row++;
  }

  // Column widths
  sheet.getColumn('A').width = 25;
  sheet.getColumn('B').width = 20;
}

/**
 * Generate legacy discrepancy report Excel file
 */
export async function generateReport(results, options = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MBH Discrepancy Analyzer';
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  addSummarySheet(summarySheet, results);

  // Perfect Matches sheet
  if (results.perfectMatches.length > 0) {
    const matchSheet = workbook.addWorksheet('Matches');
    addMatchesSheet(matchSheet, results.perfectMatches, 'Perfect Match');
  }

  // Premium Discrepancies sheet
  if (results.premiumDiscrepancies.length > 0) {
    const discrepSheet = workbook.addWorksheet('Premium Discrepancies');
    addDiscrepanciesSheet(discrepSheet, results.premiumDiscrepancies);
  }

  // Missing from Payroll sheet
  if (results.missingFromPayroll.length > 0) {
    const missingPayrollSheet = workbook.addWorksheet('Missing from Payroll');
    addMissingSheet(missingPayrollSheet, results.missingFromPayroll, 'Carrier');
  }

  // Missing from Carrier sheet
  if (results.missingFromCarrier.length > 0) {
    const missingCarrierSheet = workbook.addWorksheet('Missing from Carrier');
    addMissingSheet(missingCarrierSheet, results.missingFromCarrier, 'Payroll');
  }

  return workbook;
}

function addSummarySheet(sheet, results) {
  // Title
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = 'Discrepancy Analysis Summary';
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  // Date
  sheet.getCell('A3').value = 'Report Generated:';
  sheet.getCell('B3').value = new Date().toLocaleDateString();

  // Stats
  const stats = [
    ['', ''],
    ['Source Statistics', ''],
    ['Carrier Employees', results.summary.carrierEmployees],
    ['Payroll Employees', results.summary.payrollEmployees],
    ['Carrier Total Premium', `$${results.summary.carrierTotalPremium.toFixed(2)}`],
    ['Payroll Total Premium', `$${results.summary.payrollTotalPremium.toFixed(2)}`],
    ['Premium Difference', `$${Math.abs(results.summary.carrierTotalPremium - results.summary.payrollTotalPremium).toFixed(2)}`],
    ['', ''],
    ['Match Results', ''],
    ['Perfect Matches', results.perfectMatches.length],
    ['Fuzzy Matches (Pending)', results.fuzzyMatches?.length || 0],
    ['Premium Discrepancies', results.premiumDiscrepancies.length],
    ['Missing from Payroll', results.missingFromPayroll.length],
    ['Missing from Carrier', results.missingFromCarrier.length],
  ];

  let row = 5;
  for (const [label, value] of stats) {
    sheet.getCell(`A${row}`).value = label;
    sheet.getCell(`B${row}`).value = value;
    if (label.includes('Statistics') || label.includes('Results')) {
      sheet.getCell(`A${row}`).font = { bold: true };
    }
    row++;
  }

  // Column widths
  sheet.getColumn('A').width = 25;
  sheet.getColumn('B').width = 20;
}

function addMatchesSheet(sheet, matches, matchType) {
  // Headers
  const headers = ['Last Name', 'First Name', 'Carrier Premium', 'Payroll Premium', 'Difference', 'Match Type'];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Data
  for (const match of matches) {
    sheet.addRow([
      match.carrier.lastName,
      match.carrier.firstName,
      match.carrier.totalPremium,
      match.payroll.totalPremium,
      match.premiumDiff || 0,
      match.matchType || (match.userApproved ? 'Fuzzy (Approved)' : 'Exact')
    ]);
  }

  // Format currency columns
  sheet.getColumn(3).numFmt = '$#,##0.00';
  sheet.getColumn(4).numFmt = '$#,##0.00';
  sheet.getColumn(5).numFmt = '$#,##0.00';

  // Column widths
  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 18;
}

function addDiscrepanciesSheet(sheet, discrepancies, statusLabel = '') {
  // Headers
  const headers = [
    'Last Name', 'First Name',
    'Carrier Premium', 'Payroll Premium', 'Difference',
    'Status', 'Carrier Products', 'Payroll Products'
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6B6B' } };
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Data
  for (const disc of discrepancies) {
    const carrierProducts = disc.carrier.products.map(p => `${p.productType}: $${p.premium.toFixed(2)}`).join('\n');
    const payrollProducts = disc.payroll.products.map(p => `${p.productType}: $${p.premium.toFixed(2)}`).join('\n');

    const row = sheet.addRow([
      disc.carrier.lastName,
      disc.carrier.firstName,
      disc.carrier.totalPremium,
      disc.payroll.totalPremium,
      disc.carrier.totalPremium - disc.payroll.totalPremium,
      statusLabel || disc.status || '',
      carrierProducts,
      payrollProducts
    ]);

    // Highlight significant differences
    if (Math.abs(disc.carrier.totalPremium - disc.payroll.totalPremium) > 5) {
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
    }
  }

  // Format
  sheet.getColumn(3).numFmt = '$#,##0.00';
  sheet.getColumn(4).numFmt = '$#,##0.00';
  sheet.getColumn(5).numFmt = '$#,##0.00';

  // Column widths
  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 15;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 15;
  sheet.getColumn(7).width = 35;
  sheet.getColumn(8).width = 35;

  // Wrap text for product columns
  sheet.getColumn(7).alignment = { wrapText: true };
  sheet.getColumn(8).alignment = { wrapText: true };
}

function addMissingSheet(sheet, employees, source) {
  // Headers
  const headers = ['Last Name', 'First Name', 'Total Premium', 'Products'];
  const headerRow = sheet.addRow(headers);
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } };
  headerRow.font = { bold: true };

  // Data
  for (const emp of employees) {
    const products = emp.products.map(p => `${p.productType}: $${p.premium.toFixed(2)}`).join('\n');

    sheet.addRow([
      emp.lastName,
      emp.firstName,
      emp.totalPremium,
      products
    ]);
  }

  // Format
  sheet.getColumn(3).numFmt = '$#,##0.00';

  // Column widths
  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 15;
  sheet.getColumn(4).width = 40;
  sheet.getColumn(4).alignment = { wrapText: true };
}

export async function getWorkbookBuffer(workbook) {
  return await workbook.xlsx.writeBuffer();
}

export default { generateReport, generateTwoPhaseReport, getWorkbookBuffer };
