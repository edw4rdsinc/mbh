/**
 * Nicole's Deduction Report - Excel Generator
 * Generates Excel workbook matching Nicole's exact format
 */

import ExcelJS from 'exceljs';

// Column configuration (15 columns)
const COLUMNS = [
  { key: 'location', header: 'Location', width: 13 },
  { key: 'lastName', header: 'Last Name', width: 13 },
  { key: 'firstName', header: 'First Name', width: 13 },
  { key: 'planType', header: 'Plan Type', width: 19 },
  { key: 'carrier', header: 'Carrier', width: 13 },
  { key: 'planName', header: 'Plan Name', width: 31 },
  { key: 'coverageDetails', header: 'Coverage Details', width: 17 },
  { key: 'effectiveDate', header: 'Effective Date', width: 11 },
  { key: 'preTax', header: 'Pre-Tax', width: 9 },
  { key: 'totalRate', header: 'Total Rate', width: 11 },
  { key: 'erContribution', header: 'Employer Contribution', width: 13 },
  { key: 'eeContribution', header: 'Employee Contribution', width: 13 },
  { key: 'payCycle', header: 'Pay Cycle', width: 13 },
  { key: 'erPerCycle', header: 'Employer Cost Per Pay Cycle', width: 13 },
  { key: 'eePerCycle', header: 'Employee Cost Per Pay Cycle', width: 13 },
];

/**
 * Generate Excel workbook from transformed data
 * @param {Object} data - Transformed data from data-transformer
 * @returns {ExcelJS.Workbook}
 */
export async function generateWorkbook(data) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MBH Tools';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Payroll Deduction Report');

  // Set column widths
  worksheet.columns = COLUMNS.map(col => ({
    key: col.key,
    width: col.width,
  }));

  // Add header section (rows 1-4)
  addHeaderSection(worksheet, data);

  // Add column headers (row 5)
  addColumnHeaders(worksheet);

  // Add data rows starting at row 6
  addDataRows(worksheet, data.rows);

  return workbook;
}

/**
 * Add header section (rows 1-4)
 */
function addHeaderSection(worksheet, data) {
  // Row 1: Last Updated date
  const row1 = worksheet.getRow(1);
  row1.getCell(1).value = `Last Updated: ${data.reportDate}`;

  // Row 2: Disclaimer
  const row2 = worksheet.getRow(2);
  row2.getCell(1).value = 'Please note: this deduction summary is being provided to you as a courtesy. It does NOT replace your invoice. To ensure accurate bookkeeping please reference, deduct, and pay according to the actual invoice from the carrier(s). If you need help accessing those, please let us know.';

  // Row 3: Company name
  const row3 = worksheet.getRow(3);
  row3.getCell(1).value = data.companyName;

  // Row 4: Carrier summary
  const row4 = worksheet.getRow(4);
  row4.getCell(1).value = data.carrierSummary;
}

/**
 * Add column headers (row 5)
 */
function addColumnHeaders(worksheet) {
  const headerRow = worksheet.getRow(5);

  COLUMNS.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = { bold: true };
  });

  headerRow.commit();
}

/**
 * Add data rows with subtotals
 */
function addDataRows(worksheet, rows) {
  let excelRowNum = 6; // Data starts at row 6

  for (const row of rows) {
    const excelRow = worksheet.getRow(excelRowNum);

    if (row.isSubtotal) {
      // Subtotal row - add "Total:" in Pay Cycle column and SUM formulas
      excelRow.getCell(1).value = row.location;
      excelRow.getCell(2).value = row.lastName;
      excelRow.getCell(3).value = row.firstName;
      // Columns 4-12 are empty (null)
      excelRow.getCell(13).value = 'Total:';

      // SUM formulas for columns N and O
      // startRow and endRow are 0-indexed from result array, need to convert to Excel rows
      const startExcelRow = 6 + row.startRow;
      const endExcelRow = 6 + row.endRow;

      excelRow.getCell(14).value = { formula: `SUM(N${startExcelRow}:N${endExcelRow})` };
      excelRow.getCell(15).value = { formula: `SUM(O${startExcelRow}:O${endExcelRow})` };

      // Bold the entire subtotal row
      for (let col = 1; col <= 15; col++) {
        excelRow.getCell(col).font = { bold: true };
      }
    } else {
      // Regular data row
      excelRow.getCell(1).value = row.location;
      excelRow.getCell(2).value = row.lastName;
      excelRow.getCell(3).value = row.firstName;
      excelRow.getCell(4).value = row.planType;
      excelRow.getCell(5).value = row.carrier || null;
      excelRow.getCell(6).value = row.planName;
      excelRow.getCell(7).value = row.coverageDetails;
      excelRow.getCell(8).value = row.effectiveDate;
      excelRow.getCell(9).value = row.preTax;
      excelRow.getCell(10).value = row.totalRate;
      excelRow.getCell(11).value = row.erContribution;
      excelRow.getCell(12).value = row.eeContribution;
      excelRow.getCell(13).value = row.payCycle;
      excelRow.getCell(14).value = row.erPerCycle;
      excelRow.getCell(15).value = row.eePerCycle;

      // Format date column
      if (row.effectiveDate) {
        excelRow.getCell(8).numFmt = 'm/d/yyyy';
      }

      // Format currency columns (10-12, 14-15)
      [10, 11, 12, 14, 15].forEach(col => {
        const cell = excelRow.getCell(col);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      });
    }

    excelRow.commit();
    excelRowNum++;
  }
}

/**
 * Generate Excel buffer from transformed data
 * @param {Object} data - Transformed data
 * @returns {Buffer}
 */
export async function generateExcelBuffer(data) {
  const workbook = await generateWorkbook(data);
  return await workbook.xlsx.writeBuffer();
}

export default {
  generateWorkbook,
  generateExcelBuffer,
};
