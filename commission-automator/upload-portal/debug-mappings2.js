import ExcelJS from 'exceljs';

async function debug() {
  // Check carrier file for BAUG
  const carrierWb = new ExcelJS.Workbook();
  await carrierWb.xlsx.readFile('/tmp/My Access 2025.11.xlsx');
  const carrierSheet = carrierWb.worksheets[0];

  console.log('=== ALL BAUG* IN CARRIER ===');
  carrierSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    if (lastName.startsWith('BAUG')) {
      console.log(`Carrier row ${rowNum}: "${row.getCell(1).value}", "${row.getCell(2).value}"`);
    }
  });

  const payrollWb = new ExcelJS.Workbook();
  await payrollWb.xlsx.readFile('/tmp/Paycom 2025.11.xlsx');
  const payrollSheet = payrollWb.worksheets[0];

  console.log('\n=== ALL BAUG* IN PAYROLL ===');
  payrollSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    if (lastName.startsWith('BAUG')) {
      console.log(`Payroll row ${rowNum}: "${row.getCell(1).value}", "${row.getCell(2).value}"`);
    }
  });

  // Check SELLERS
  console.log('\n=== ALL SELL* IN CARRIER ===');
  carrierSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    if (lastName.startsWith('SELL')) {
      console.log(`Carrier row ${rowNum}: "${row.getCell(1).value}", "${row.getCell(2).value}"`);
    }
  });

  console.log('\n=== ALL SELL* IN PAYROLL ===');
  payrollSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    if (lastName.startsWith('SELL')) {
      console.log(`Payroll row ${rowNum}: "${row.getCell(1).value}", "${row.getCell(2).value}"`);
    }
  });
}

debug();
