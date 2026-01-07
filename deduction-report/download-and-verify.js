#!/usr/bin/env node

import { downloadFile } from './src/wasabi-client.js';
import { writeFileSync } from 'fs';
import XLSX from 'xlsx';

console.log('Downloading generated file from Wasabi...\n');

const fileKey = 'outputs/Stange Law Firm PC ME610 - Updated Deduction Summary.xlsx';

try {
  const buffer = await downloadFile(fileKey);
  const outputPath = './generated/from-wasabi.xlsx';

  writeFileSync(outputPath, buffer);
  console.log(`✓ Downloaded to: ${outputPath}\n`);

  // Analyze the file
  const workbook = XLSX.readFile(outputPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log('='.repeat(80));
  console.log('FILE ANALYSIS:');
  console.log('='.repeat(80));
  console.log(`Sheet Name: "${workbook.SheetNames[0]}"`);
  console.log(`Total Rows: ${data.length}`);
  console.log(`\nFirst 10 rows:`);
  data.slice(0, 10).forEach((row, idx) => {
    console.log(`  Row ${idx + 1}: ${JSON.stringify(row)}`);
  });

  console.log(`\nSubtotal rows:`);
  data.forEach((row, idx) => {
    if (row[8] === 'Total:') {
      console.log(`  Row ${idx + 1}: Total: ${row[9]}`);
    }
  });

  console.log(`\n** NEW ** rows:`);
  data.forEach((row, idx) => {
    if (row[5] === '** NEW **') {
      console.log(`  Row ${idx + 1}: ${row[1]} ${row[2]} - ${row[0]}`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ File successfully downloaded and verified!');
  console.log('='.repeat(80));

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
