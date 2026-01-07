#!/usr/bin/env node

import XLSX from 'xlsx';
import { readFileSync } from 'fs';

const workbook = XLSX.readFile('./downloaded/Stange Law Firm ME610 - Updated Deduction Summary.xlsx');

console.log('Sheet Names:', workbook.SheetNames);
console.log('\n' + '='.repeat(80));

workbook.SheetNames.forEach(sheetName => {
    console.log(`\nSheet: ${sheetName}`);
    console.log('='.repeat(80));

    const sheet = workbook.Sheets[sheetName];

    // Get the range
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log(`Range: ${sheet['!ref']}`);
    console.log(`Rows: ${range.s.r} to ${range.e.r}`);
    console.log(`Columns: ${range.s.c} to ${range.e.c}`);

    // Convert to JSON to see structure
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Print first 30 rows
    console.log('\nFirst 30 rows:');
    data.slice(0, 30).forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    });

    // Check for styling info
    if (sheet['!merges']) {
        console.log('\nMerged cells:', sheet['!merges']);
    }

    // Sample some cell properties to see formatting
    console.log('\nSample cell properties:');
    ['A1', 'A9', 'A10', 'J10'].forEach(addr => {
        if (sheet[addr]) {
            console.log(`${addr}:`, {
                value: sheet[addr].v,
                type: sheet[addr].t,
                style: sheet[addr].s
            });
        }
    });
});
