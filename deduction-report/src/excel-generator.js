import ExcelJS from 'exceljs';
import { format } from 'date-fns';

/**
 * Create Excel workbook from transformed data (Amy's format)
 * @param {Object} data - Transformed data
 * @param {Object} config - Configuration
 * @returns {ExcelJS.Workbook} - Excel workbook
 */
export async function createWorkbook(data, config) {
  const { accountNumber, accountName, carrierName, rows, reportDate, frequencyLabel, settings } = data;
  const { formatting } = config;

  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = 'Deduction Report Automation';
  workbook.created = new Date();

  // Create worksheet with name based on account (with trailing space like Amy's)
  // Excel sheet names cannot contain: * ? : \ / [ ]
  const sanitizedName = (accountName || 'Report')
    .replace(/[\*\?\:\\\[\]\/]/g, '-')  // Replace invalid chars with dash
    .substring(0, 30) + ' ';  // Max 31 chars total with trailing space
  const worksheet = workbook.addWorksheet(sanitizedName);

  // Add header section (rows 1-7)
  addHeaderSection(worksheet, accountName, accountNumber, carrierName, reportDate, formatting, settings);

  // Add column headers (row 8)
  addColumnHeaders(worksheet, frequencyLabel);

  // Add data rows (starting at row 9)
  addDataRows(worksheet, rows, frequencyLabel);

  // Apply formatting
  applyFormatting(worksheet, rows);

  return workbook;
}

/**
 * Add header section (rows 1-7) - Amy's format
 */
function addHeaderSection(worksheet, accountName, accountNumber, carrierName, reportDate, formatting, settings) {
  const numCols = 12;

  // Row 1: Last Updated:
  worksheet.getRow(1).values = ['Last Updated:', reportDate];
  worksheet.getRow(1).getCell(2).numFmt = 'm/d/yyyy';

  // Row 2: Disclaimer (merged)
  worksheet.mergeCells(`A2:${getColLetter(numCols)}2`);
  worksheet.getCell('A2').value = formatting.disclaimerText;
  worksheet.getCell('A2').alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };

  // Row 3: Empty

  // Row 4: Group name (merged)
  worksheet.mergeCells(`A4:${getColLetter(numCols)}4`);
  worksheet.getCell('A4').value = accountName;
  worksheet.getCell('A4').font = { size: formatting.headerFontSize, bold: true };
  worksheet.getCell('A4').alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 5-6: Empty

  // Row 7: Carrier info with ER contribution summary (merged)
  worksheet.mergeCells(`A7:${getColLetter(numCols)}7`);

  // Build carrier info string like "Allstate Benefits #H5383 | Ameritas #59114 | ER Contribution: $50/month"
  let carrierInfo = `${carrierName} #${accountNumber}`;
  if (settings.contributionType !== 'none' && settings.contributionValue) {
    const erLabel = settings.contributionType === 'flat'
      ? `$${settings.contributionValue}/month`
      : `${settings.contributionValue}%`;
    carrierInfo += ` | ER Contribution: ${erLabel}`;
  }
  worksheet.getCell('A7').value = carrierInfo;
  worksheet.getCell('A7').alignment = { vertical: 'middle', horizontal: 'center' };
}

/**
 * Get Excel column letter from index (1-indexed)
 */
function getColLetter(colIndex) {
  let letter = '';
  while (colIndex > 0) {
    const remainder = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
}

/**
 * Add column headers (row 8) - Amy's format (12 columns)
 */
function addColumnHeaders(worksheet, frequencyLabel) {
  const headers = [
    'Policy Number',
    'Last Name',
    'First Name',
    'Product Type',
    'Pre-Tax',
    'Status',
    'Effective Date',
    'Monthly Premium',
    'Monthly Employer Contribution',
    'Monthly EE Contribution',
    'Deduction Cycle',
    `${frequencyLabel} EE Deduction`,
  ];

  const headerRow = worksheet.getRow(8);
  headerRow.values = headers;

  // Make header row bold
  headerRow.font = { bold: true };

  // Apply borders to header
  headers.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Set column widths
  const columnWidths = [
    { key: 'policyNumber', width: 18 },
    { key: 'lastName', width: 15 },
    { key: 'firstName', width: 15 },
    { key: 'productType', width: 20 },
    { key: 'preTax', width: 10 },
    { key: 'status', width: 12 },
    { key: 'effectiveDate', width: 15 },
    { key: 'monthlyPremium', width: 18 },
    { key: 'erContribution', width: 28 },
    { key: 'eeContribution', width: 24 },
    { key: 'deductionCycle', width: 16 },
    { key: 'periodDeduction', width: 24 },
  ];

  worksheet.columns = columnWidths;
}

/**
 * Add data rows (starting at row 9) - Amy's format
 */
function addDataRows(worksheet, rows, frequencyLabel) {
  let currentRow = 9;

  for (const row of rows) {
    const excelRow = worksheet.getRow(currentRow);

    if (row.isBlankRow) {
      // Blank row separator between employee groups - just skip
      currentRow++;
      continue;
    }

    if (row.isEmployeeSubtotal) {
      // Employee subtotal row - just "Total:" and SUM formula
      const values = new Array(12).fill('');
      values[10] = 'Total:';  // Column K
      // Column L gets a SUM formula - will be set after we know the range
      values[11] = { formula: `SUM(L${row.startRow}:L${currentRow - 1})` };

      excelRow.values = values;
      excelRow.getCell(12).numFmt = '$#,##0.00';

      // Right-align "Total:" text
      excelRow.getCell(11).alignment = { horizontal: 'right' };

      // Highlight subtotal row with BRIGHT yellow background
      for (let col = 1; col <= 12; col++) {
        excelRow.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' },  // Bright yellow
        };
      }
      excelRow.font = { bold: true };

    } else {
      // Regular product row
      const values = [
        row.policyNumber,
        row.lastName,
        row.firstName,
        row.productType,
        row.preTax,
        row.status,
        row.effectiveDate,
        row.monthlyPremium,
        row.erContribution || 0,  // ER contribution per product
        { formula: `H${currentRow}-I${currentRow}` },  // EE Contribution = Premium - ER
        frequencyLabel,
        { formula: `J${currentRow}/2` },  // Deduction = EE / 2 (for semi-monthly)
      ];

      excelRow.values = values;

      // Format currency columns
      excelRow.getCell(8).numFmt = '$#,##0.00';   // Monthly Premium
      excelRow.getCell(9).numFmt = '$#,##0.00';   // ER Contribution
      excelRow.getCell(10).numFmt = '$#,##0.00';  // EE Contribution (formula)
      excelRow.getCell(12).numFmt = '$#,##0.00';  // Deduction (formula)

      // Format date column
      if (row.effectiveDate !== undefined && row.effectiveDate !== null && row.effectiveDate !== '') {
        const dateCell = excelRow.getCell(7);
        dateCell.value = row.effectiveDate;
        dateCell.numFmt = 'm/d/yyyy';
      }
    }

    currentRow++;
  }

  return currentRow - 1;
}

/**
 * Apply all formatting (borders, colors, etc.)
 */
function applyFormatting(worksheet, rows) {
  const numCols = 12;
  let currentRow = 9;

  for (const row of rows) {
    const excelRow = worksheet.getRow(currentRow);

    if (row.isBlankRow) {
      // Blank row - no formatting needed
      currentRow++;
      continue;
    }

    if (row.isEmployeeSubtotal) {
      // Employee subtotal formatting - bold text
      excelRow.font = { bold: true };

      // Apply OUTSIDE perimeter borders only (not every cell)
      for (let col = 1; col <= numCols; col++) {
        const cell = excelRow.getCell(col);
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: col === 1 ? { style: 'thin' } : undefined,
          right: col === numCols ? { style: 'thin' } : undefined,
        };
      }

      // Special border box around the Semi-Monthly EE Deduction column (L = column 12)
      excelRow.getCell(12).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };

    } else {
      // Regular data row - NO borders (per Amy's screenshot)
      // Data rows should have minimal/no visible cell borders
    }

    currentRow++;
  }

  // Apply borders around header row (keep grid for headers)
  for (let col = 1; col <= numCols; col++) {
    const cell = worksheet.getRow(8).getCell(col);
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
}

/**
 * Save workbook to file
 * @param {ExcelJS.Workbook} workbook - Workbook to save
 * @param {string} filename - Output filename
 */
export async function saveWorkbook(workbook, filename) {
  await workbook.xlsx.writeFile(filename);
}

/**
 * Get workbook as buffer
 * @param {ExcelJS.Workbook} workbook - Workbook
 * @returns {Promise<Buffer>} - Excel file buffer
 */
export async function getWorkbookBuffer(workbook) {
  return await workbook.xlsx.writeBuffer();
}

export default {
  createWorkbook,
  saveWorkbook,
  getWorkbookBuffer,
};
