/**
 * Excel Parser for Discrepancy Analyzer
 */

import ExcelJS from 'exceljs';

/**
 * Parse Excel file and extract rows as objects
 */
export async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const headers = [];
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    const values = row.values.slice(1); // ExcelJS is 1-indexed

    if (rowNumber === 1) {
      // Header row
      values.forEach(v => headers.push(String(v || '').trim()));
    } else {
      // Data row
      const rowObj = {};
      values.forEach((v, i) => {
        if (headers[i]) {
          rowObj[headers[i]] = v;
        }
      });
      rows.push(rowObj);
    }
  });

  return {
    sheetName: sheet.name,
    headers,
    rows,
    rowCount: rows.length
  };
}

export default { parseExcel };
