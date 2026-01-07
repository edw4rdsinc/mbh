import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';

const supabase = createClient(
  'https://exzeayeoosiabwhgyquq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4emVheWVvb3NpYWJ3aGd5cXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NDcwOSwiZXhwIjoyMDY5NTUwNzA5fQ.Qgwxa5JxhvV05CZhPeG-Ag7FpJiRO3hLaIJxN6k8708'
);

// Normalize function from matcher.js
function normalizeName(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/[-_]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function createNameKey(lastName, firstName) {
  return `${normalizeName(lastName)}|${normalizeName(firstName)}`;
}

async function debug() {
  // Problem names to check
  const problemNames = [
    'BAUGUESS', 'BAUGBESS',
    'LEON', 'LEONL',
    'SELLERS', 'SELLSRS',
    'GOMEZ', 'GOMEG',
    'YANG', 'YANGY'
  ];

  // Get all mappings that might match
  const { data: mappings } = await supabase
    .from('mbh_name_mappings')
    .select('*')
    .eq('account_name', 'Ampla Health');

  console.log('=== DATABASE MAPPINGS ===');
  for (const name of problemNames) {
    const found = mappings.filter(m =>
      m.carrier_last_name.includes(name) ||
      m.payroll_last_name.includes(name)
    );
    if (found.length > 0) {
      for (const f of found) {
        console.log(`DB: carrier="${f.carrier_last_name}, ${f.carrier_first_name}" -> payroll="${f.payroll_last_name}, ${f.payroll_first_name}"`);
      }
    }
  }

  // Check Excel files
  const carrierWb = new ExcelJS.Workbook();
  await carrierWb.xlsx.readFile('/tmp/My Access 2025.11.xlsx');
  const carrierSheet = carrierWb.worksheets[0];

  const payrollWb = new ExcelJS.Workbook();
  await payrollWb.xlsx.readFile('/tmp/Paycom 2025.11.xlsx');
  const payrollSheet = payrollWb.worksheets[0];

  console.log('\n=== CARRIER FILE NAMES ===');
  carrierSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    for (const name of problemNames) {
      if (lastName.includes(name)) {
        console.log(`Carrier: "${row.getCell(1).value}", "${row.getCell(2).value}"`);
        console.log(`  Normalized key: ${createNameKey(row.getCell(1).value, row.getCell(2).value)}`);
      }
    }
  });

  console.log('\n=== PAYROLL FILE NAMES ===');
  payrollSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').toUpperCase();
    for (const name of problemNames) {
      if (lastName.includes(name)) {
        console.log(`Payroll: "${row.getCell(1).value}", "${row.getCell(2).value}"`);
        console.log(`  Normalized key: ${createNameKey(row.getCell(1).value, row.getCell(2).value)}`);
      }
    }
  });

  // Now simulate the matching
  console.log('\n=== MATCHING SIMULATION ===');
  // Build payroll map
  const payrollEmployees = new Map();
  payrollSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const lastName = String(row.getCell(1).value || '').trim();
    const firstName = String(row.getCell(2).value || '').trim();
    const key = createNameKey(lastName, firstName);
    payrollEmployees.set(key, { lastName, firstName, key });
  });

  // Check if mappings would work
  for (const mapping of mappings) {
    // Forward direction
    const payrollKey1 = createNameKey(mapping.payroll_last_name, mapping.payroll_first_name);
    // Reverse direction
    const payrollKey2 = createNameKey(mapping.carrier_last_name, mapping.carrier_first_name);

    if (mapping.carrier_last_name.includes('BAUG') || mapping.payroll_last_name.includes('BAUG')) {
      console.log(`\nMapping: "${mapping.carrier_last_name}, ${mapping.carrier_first_name}" -> "${mapping.payroll_last_name}, ${mapping.payroll_first_name}"`);
      console.log(`  Forward payroll key: ${payrollKey1} -> exists: ${payrollEmployees.has(payrollKey1)}`);
      console.log(`  Reverse payroll key: ${payrollKey2} -> exists: ${payrollEmployees.has(payrollKey2)}`);
    }
  }
}

debug();
