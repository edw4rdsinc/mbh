#!/usr/bin/env node

import XLSX from 'xlsx';

console.log('Comparing Generated Output vs Expected Output\n');
console.log('='.repeat(80));

// Load both files
const expected = XLSX.readFile('./downloaded/Stange Law Firm ME610 - Updated Deduction Summary.xlsx');
const generated = XLSX.readFile('./generated/test-output.xlsx');

// Get first sheet from each
const expectedSheet = expected.Sheets[expected.SheetNames[0]];
const generatedSheet = generated.Sheets[generated.SheetNames[0]];

// Convert to JSON
const expectedData = XLSX.utils.sheet_to_json(expectedSheet, { header: 1, defval: '' });
const generatedData = XLSX.utils.sheet_to_json(generatedSheet, { header: 1, defval: '' });

console.log('\n📊 ROW COUNTS:');
console.log(`Expected:  ${expectedData.length} rows`);
console.log(`Generated: ${generatedData.length} rows`);

console.log('\n📋 SHEET NAMES:');
console.log(`Expected:  "${expected.SheetNames[0]}"`);
console.log(`Generated: "${generated.SheetNames[0]}"`);

// Compare first 20 rows
console.log('\n🔍 FIRST 20 ROWS COMPARISON:');
console.log('='.repeat(80));

for (let i = 0; i < Math.min(20, Math.max(expectedData.length, generatedData.length)); i++) {
  const exp = expectedData[i] || [];
  const gen = generatedData[i] || [];

  const match = JSON.stringify(exp) === JSON.stringify(gen);
  const icon = match ? '✅' : '❌';

  console.log(`\nRow ${i + 1} ${icon}`);
  console.log(`Expected:  ${JSON.stringify(exp)}`);
  console.log(`Generated: ${JSON.stringify(gen)}`);

  if (!match) {
    // Show differences
    for (let j = 0; j < Math.max(exp.length, gen.length); j++) {
      if (exp[j] !== gen[j]) {
        console.log(`  📍 Col ${j + 1}: "${exp[j]}" vs "${gen[j]}"`);
      }
    }
  }
}

// Find subtotal rows
console.log('\n\n💰 SUBTOTAL ROWS:');
console.log('='.repeat(80));

console.log('\nExpected subtotals:');
expectedData.forEach((row, idx) => {
  if (row[8] === 'Total:') {
    console.log(`  Row ${idx + 1}: Total: ${row[9]}`);
  }
});

console.log('\nGenerated subtotals:');
generatedData.forEach((row, idx) => {
  if (row[8] === 'Total:') {
    console.log(`  Row ${idx + 1}: Total: ${row[9]}`);
  }
});

// Check for NEW rows
console.log('\n\n🆕 ** NEW ** ROWS:');
console.log('='.repeat(80));

console.log('\nExpected NEW rows:');
expectedData.forEach((row, idx) => {
  if (row[5] === '** NEW **') {
    console.log(`  Row ${idx + 1}: ${row[1]} ${row[2]} - ${row[0]}`);
  }
});

console.log('\nGenerated NEW rows:');
generatedData.forEach((row, idx) => {
  if (row[5] === '** NEW **') {
    console.log(`  Row ${idx + 1}: ${row[1]} ${row[2]} - ${row[0]}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('Comparison complete!');
