#!/usr/bin/env node

import XLSX from 'xlsx';

const workbook = XLSX.readFile('./downloaded/Stange Law Firm ME610 - Updated Deduction Summary.xlsx');
const sheet = workbook.Sheets['ME610 - STANGE LAW FIRM,PC'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('Total rows:', data.length);
console.log('\nAll rows:\n');

data.forEach((row, idx) => {
    const rowNum = idx + 1;
    const isSubtotal = row[8] === 'Total:';
    const prefix = isSubtotal ? '>>> ' : '    ';
    console.log(`${prefix}Row ${rowNum}:`, JSON.stringify(row));
});

// Analyze the pattern
console.log('\n\n=== PATTERN ANALYSIS ===\n');
console.log('Subtotal rows (rows with "Total:" in column I):');
data.forEach((row, idx) => {
    if (row[8] === 'Total:') {
        console.log(`Row ${idx + 1}:`, row);
    }
});
