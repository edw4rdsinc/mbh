import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';

async function checkFile(path, name) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(path));

  const sheet = workbook.worksheets[0];
  console.log(`\n=== ${name} ===`);
  console.log(`Sheet: ${sheet.name}`);
  console.log(`Rows: ${sheet.rowCount}`);

  // Get headers
  const headers = [];
  sheet.getRow(1).eachCell((cell, colNum) => {
    headers.push(cell.value);
  });
  console.log(`Headers: ${headers.join(', ')}`);

  // Sample row 2
  const row2 = [];
  sheet.getRow(2).eachCell((cell, colNum) => {
    row2.push(`${headers[colNum-1]}=${cell.value}`);
  });
  console.log(`Row 2: ${row2.join(', ')}`);
}

await checkFile('/tmp/discrepancy-test/My Access 2025.11.xlsx', 'Carrier (My Access)');
await checkFile('/tmp/discrepancy-test/Paycom 2025.11.xlsx', 'Payroll (Paycom)');
