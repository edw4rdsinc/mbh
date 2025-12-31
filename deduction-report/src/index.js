#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import config from './config.js';
import { parseCSV } from './csv-parser.js';
import { transform } from './data-transformer.js';
import { createWorkbook, saveWorkbook, getWorkbookBuffer } from './excel-generator.js';
import { listFiles, downloadFile, uploadFile } from './wasabi-client.js';

/**
 * Process a single report from local file
 * @param {string} inputFilePath - Path to input CSV file
 * @param {string} outputFilePath - Path to save output Excel file
 */
async function processLocalFile(inputFilePath, outputFilePath) {
  try {
    console.log(`\n📄 Processing: ${inputFilePath}`);
    console.log('='.repeat(80));

    // 1. Read CSV file
    console.log('1️⃣  Reading CSV file...');
    const csvBuffer = readFileSync(inputFilePath);

    // 2. Parse CSV
    console.log('2️⃣  Parsing CSV...');
    const csvData = parseCSV(csvBuffer);
    console.log(`   ✓ Found ${csvData.rows.length} rows`);
    console.log(`   ✓ Account: ${csvData.accountNumber} - ${csvData.accountName}`);

    // 3. Transform data
    console.log('3️⃣  Transforming data...');
    const transformedData = transform(csvData, config);
    console.log(`   ✓ Transformed to ${transformedData.rows.length} rows (including subtotals)`);

    // 4. Generate Excel
    console.log('4️⃣  Generating Excel file...');
    const workbook = await createWorkbook(transformedData, config);

    // 5. Save Excel
    console.log('5️⃣  Saving Excel file...');
    await saveWorkbook(workbook, outputFilePath);
    console.log(`   ✓ Saved to: ${outputFilePath}`);

    console.log('\n✅ SUCCESS! Report generated successfully.');
    console.log('='.repeat(80));

    return {
      success: true,
      inputFile: inputFilePath,
      outputFile: outputFilePath,
      stats: {
        inputRows: csvData.rows.length,
        outputRows: transformedData.rows.length,
      },
    };
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Process a report from Wasabi
 * @param {string} inputKey - Input file key in Wasabi (e.g., 'inputs/file.csv')
 */
async function processWasabiFile(inputKey) {
  try {
    console.log(`\n📄 Processing from Wasabi: ${inputKey}`);
    console.log('='.repeat(80));

    // 1. Download CSV from Wasabi
    console.log('1️⃣  Downloading CSV from Wasabi...');
    const csvBuffer = await downloadFile(inputKey);
    console.log(`   ✓ Downloaded ${csvBuffer.length} bytes`);

    // 2. Parse CSV
    console.log('2️⃣  Parsing CSV...');
    const csvData = parseCSV(csvBuffer);
    console.log(`   ✓ Found ${csvData.rows.length} rows`);
    console.log(`   ✓ Account: ${csvData.accountNumber} - ${csvData.accountName}`);

    // 3. Transform data
    console.log('3️⃣  Transforming data...');
    const transformedData = transform(csvData, config);
    console.log(`   ✓ Transformed to ${transformedData.rows.length} rows (including subtotals)`);

    // 4. Generate Excel
    console.log('4️⃣  Generating Excel file...');
    const workbook = await createWorkbook(transformedData, config);
    const excelBuffer = await getWorkbookBuffer(workbook);

    // 5. Upload to Wasabi
    const outputFileName = `${transformedData.accountName} ${transformedData.accountNumber} - Updated Deduction Summary.xlsx`;
    const outputKey = `outputs/${outputFileName}`;

    console.log('5️⃣  Uploading to Wasabi...');
    await uploadFile(outputKey, excelBuffer);
    console.log(`   ✓ Uploaded to: ${outputKey}`);

    console.log('\n✅ SUCCESS! Report generated and uploaded to Wasabi.');
    console.log('='.repeat(80));

    return {
      success: true,
      inputFile: inputKey,
      outputFile: outputKey,
      stats: {
        inputRows: csvData.rows.length,
        outputRows: transformedData.rows.length,
      },
    };
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * Process all files in Wasabi inputs folder
 */
async function processAllWasabiFiles() {
  try {
    console.log('\n🔍 Checking for files in Wasabi inputs folder...');

    const files = await listFiles('inputs/');

    if (files.length === 0) {
      console.log('   No files found in inputs/ folder.');
      return;
    }

    console.log(`   Found ${files.length} file(s) to process:`);
    files.forEach(file => console.log(`   - ${file.Key}`));

    const results = [];

    for (const file of files) {
      try {
        const result = await processWasabiFile(file.Key);
        results.push(result);
      } catch (error) {
        console.error(`   Failed to process ${file.Key}:`, error.message);
        results.push({
          success: false,
          inputFile: file.Key,
          error: error.message,
        });
      }
    }

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(80));
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('='.repeat(80));

    return results;
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.length === 0) {
  // No arguments - process all files from Wasabi
  console.log('🚀 Deduction Report Automation');
  console.log('Mode: Process all files from Wasabi');
  processAllWasabiFiles().catch(console.error);
} else if (args[0] === '--local' && args.length === 3) {
  // Local mode: --local <input> <output>
  const inputFile = resolve(args[1]);
  const outputFile = resolve(args[2]);
  console.log('🚀 Deduction Report Automation');
  console.log('Mode: Local file processing');
  processLocalFile(inputFile, outputFile).catch(console.error);
} else if (args[0] === '--wasabi' && args.length === 2) {
  // Wasabi mode: --wasabi <input-key>
  console.log('🚀 Deduction Report Automation');
  console.log('Mode: Single Wasabi file processing');
  processWasabiFile(args[1]).catch(console.error);
} else {
  console.log('Usage:');
  console.log('  npm start                                   # Process all files from Wasabi');
  console.log('  npm start -- --local <input> <output>       # Process local file');
  console.log('  npm start -- --wasabi <input-key>           # Process single Wasabi file');
  process.exit(1);
}

export {
  processLocalFile,
  processWasabiFile,
  processAllWasabiFiles,
};
