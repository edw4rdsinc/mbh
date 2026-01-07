import ExcelJS from 'exceljs';

async function checkNames() {
  // Check carrier file (My Access)
  const carrierWb = new ExcelJS.Workbook();
  await carrierWb.xlsx.readFile('/tmp/My Access 2025.11.xlsx');
  const carrierSheet = carrierWb.worksheets[0];

  console.log('=== CARRIER FILE (My Access) ===');
  console.log('Headers:', carrierSheet.getRow(1).values.slice(1, 10));

  // Find BRAC names
  carrierSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    if (lastName.includes('BRAC')) {
      console.log(`Row ${rowNum}: Last="${row.getCell(1).value}", First="${row.getCell(2).value}"`);
    }
  });

  // Check payroll file (Paycom)
  const payrollWb = new ExcelJS.Workbook();
  await payrollWb.xlsx.readFile('/tmp/Paycom 2025.11.xlsx');
  const payrollSheet = payrollWb.worksheets[0];

  console.log('\n=== PAYROLL FILE (Paycom) ===');
  console.log('Headers:', payrollSheet.getRow(1).values.slice(1, 10));

  // Find BRAC names
  payrollSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const values = row.values;
    // Check all columns for BRAC
    for (let i = 1; i < values.length; i++) {
      const val = String(values[i] || '').toUpperCase();
      if (val.includes('BRAC')) {
        console.log(`Row ${rowNum}, Col ${i}: "${values[i]}"`);
      }
    }
  });
}

checkNames();
