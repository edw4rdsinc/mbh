import { parse } from 'csv-parse/sync';

/**
 * Detect CSV format based on headers
 * @param {Array} headers - Column headers from CSV
 * @returns {string} - 'misc', 'dental_vision', or 'unknown'
 */
function detectFormat(headers) {
  // Misc format (Allstate) has 'Insured Name', 'Mode Premium', 'Product Type'
  if (headers.includes('Insured Name') && headers.includes('Mode Premium')) {
    return 'misc';
  }

  // Dental/Vision format has 'employee_name', 'employee_premium_amt'
  if (headers.includes('employee_name') && headers.includes('employee_premium_amt')) {
    return 'dental_vision';
  }

  return 'unknown';
}

/**
 * Get auto-mapping for dental/vision format
 * @returns {Object} - Column mapping
 */
function getDentalVisionMapping() {
  return {
    'Insured Name': 'employee_name',
    'Mode Premium': 'employee_premium_amt',
    'Status': 'dependent_status_desc',
    // These don't exist in dental/vision format
    'Number': null,
    'Account Number': null,
    'Account Name': null,
    'Payor Name': 'employee_name',  // Use employee name as payor
    'Product Type': null,  // Will be set from filename
    'Effective Date': null,
  };
}

/**
 * Get auto-mapping for misc (Allstate) format
 * @returns {Object} - Column mapping (identity mapping)
 */
function getMiscMapping() {
  return {
    'Number': 'Number',
    'Account Number': 'Account Number',
    'Account Name': 'Account Name',
    'Insured Name': 'Insured Name',
    'Mode Premium': 'Mode Premium',
    'Payor Name': 'Payor Name',
    'Product Type': 'Product Type',
    'Status': 'Status',
    'Effective Date': 'Effective Date',
  };
}

/**
 * Map dependent_status_desc code to readable status
 * A = Employee Only, B = Employee + Spouse, C = Employee + Child(ren), D = Family
 */
function mapDependentStatusCode(code) {
  // All codes map to 'Active' - the letter indicates coverage level, not status
  return 'Active';
}

const REQUIRED_COLUMNS = [
  'Number',
  'Account Number',
  'Account Name',
  'Insured Name',
  'Mode Premium',
  'Payor Name',
  'Product Type',
  'Status',
  'Effective Date'
];

/**
 * Parse CSV file and extract account information
 * @param {Buffer|string} csvData - CSV file content
 * @returns {Object} - { accountNumber, accountName, rows }
 */
export function parseCSV(csvData) {
  try {
    // Parse CSV with column headers
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Handle variable column counts
      quote: '"',
      escape: '"',
      relax_quotes: true, // Allow quotes within unquoted fields
    });

    // Validate that we have data
    if (!records || records.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Validate required columns
    const headers = Object.keys(records[0]);
    const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Extract account information from first row
    const accountNumber = records[0]['Account Number']?.replace(/^="|"$/g, '') || '';
    let accountName = records[0]['Account Name'] || '';

    // Format account name: replace comma with space, convert to title case
    accountName = accountName
      .replace(/,/g, ' ')
      .trim()
      .split(/\s+/)  // Split on one or more spaces
      .map(word => {
        if (!word) return '';
        // Keep specific acronyms uppercase (PC, LLC, etc.)
        if (['PC', 'LLC', 'INC', 'LLP', 'LP'].includes(word.toUpperCase())) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');

    // Clean up the data (remove Excel formula markers like ="value")
    const cleanedRows = records.map(row => {
      const cleaned = {};
      for (const [key, value] of Object.entries(row)) {
        // Remove Excel formula markers
        if (typeof value === 'string' && value.startsWith('="') && value.endsWith('"')) {
          cleaned[key] = value.slice(2, -1);
        } else {
          cleaned[key] = value;
        }
      }
      return cleaned;
    });

    return {
      accountNumber,
      accountName,
      rows: cleanedRows,
    };
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
}

/**
 * Parse CSV with custom column mapping
 * @param {Buffer|string} csvData - CSV file content
 * @param {Object} columnMapping - Maps required field names to actual CSV column names
 *                                 e.g., { 'Number': 'Policy #', 'Insured Name': 'Employee' }
 *                                 If value is null, the field is not in the CSV
 * @param {Object} columnDefaults - Default values for unmapped columns
 *                                  e.g., { 'Status': 'Active' }
 * @param {Object} columnSpecial - Special handling flags
 *                                 e.g., { 'Product Type': 'FROM_FILENAME', 'Number': 'LEAVE_BLANK' }
 * @param {string|null} _payorNameOverride - DEPRECATED: No longer used, payor comes from CSV only
 * @param {string|null} filenameProductType - Product type extracted from filename
 * @returns {Object} - { accountNumber, accountName, rows }
 */
export function parseCSVWithMapping(csvData, columnMapping = {}, columnDefaults = {}, columnSpecial = {}, payorNameOverride = null, filenameProductType = null) {
  try {
    // Parse CSV with column headers
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      quote: '"',
      escape: '"',
      relax_quotes: true,
    });

    if (!records || records.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Get headers from first record
    const headers = Object.keys(records[0]);

    // Always detect format to handle special cases
    const detectedFormat = detectFormat(headers);
    console.log(`   Auto-detected format: ${detectedFormat}`);

    // Auto-detect format if no column mapping provided (or mapping is empty/incomplete)
    const hasMapping = columnMapping && Object.keys(columnMapping).length > 0 &&
                       Object.values(columnMapping).some(v => v !== null && v !== '');

    let effectiveMapping = columnMapping;
    let effectiveSpecial = { ...columnSpecial };

    if (!hasMapping) {
      if (detectedFormat === 'dental_vision') {
        effectiveMapping = getDentalVisionMapping();
        // Set product type from filename for dental/vision
        effectiveSpecial['Product Type'] = 'FROM_FILENAME';
      } else if (detectedFormat === 'misc') {
        effectiveMapping = getMiscMapping();
      }
    } else {
      // Even with user-provided mapping, override LEAVE_BLANK for Product Type in dental/vision
      // because dental/vision files don't have a Product Type column
      if (detectedFormat === 'dental_vision' && effectiveSpecial['Product Type'] === 'LEAVE_BLANK') {
        effectiveSpecial['Product Type'] = 'FROM_FILENAME';
        console.log(`   Overriding Product Type to FROM_FILENAME for dental/vision format`);
      }
    }

    // Standard field names we need to output
    const STANDARD_FIELDS = [
      'Number',
      'Account Number',
      'Account Name',
      'Insured Name',
      'Mode Premium',
      'Payor Name',
      'Product Type',
      'Status',
      'Effective Date'
    ];

    // Map each row using the column mapping
    const mappedRows = records.map(row => {
      const mapped = {};

      for (const field of STANDARD_FIELDS) {
        const sourceColumn = effectiveMapping[field];
        const specialHandling = effectiveSpecial[field];

        // Check for special handling first
        if (specialHandling === 'LEAVE_BLANK') {
          // Explicitly leave blank
          mapped[field] = '';
        } else if (specialHandling === 'FROM_FILENAME' && field === 'Product Type' && filenameProductType) {
          // Use product type from filename
          mapped[field] = filenameProductType;
        } else if (sourceColumn && sourceColumn !== null && row[sourceColumn] !== undefined) {
          // Use the mapped column from CSV
          let value = row[sourceColumn];

          // Clean Excel formula markers
          if (typeof value === 'string' && value.startsWith('="') && value.endsWith('"')) {
            value = value.slice(2, -1);
          }

          // Special handling for Status in dental/vision format
          if (field === 'Status' && detectedFormat === 'dental_vision') {
            value = mapDependentStatusCode(value);
          }

          mapped[field] = value;
        } else if (columnDefaults[field] !== undefined && columnDefaults[field] !== '') {
          // Use default value
          mapped[field] = columnDefaults[field];
        } else {
          // Field not mapped and no default - leave empty
          mapped[field] = '';
        }
      }

      // Payor Name always comes from CSV - no override
      return mapped;
    });

    // Extract account info from first mapped row
    const accountNumber = mappedRows[0]?.['Account Number']?.replace(/^="|"$/g, '') || '';
    let accountName = mappedRows[0]?.['Account Name'] || '';

    // Format account name
    accountName = accountName
      .replace(/,/g, ' ')
      .trim()
      .split(/\s+/)
      .map(word => {
        if (!word) return '';
        if (['PC', 'LLC', 'INC', 'LLP', 'LP'].includes(word.toUpperCase())) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');

    return {
      accountNumber,
      accountName,
      rows: mappedRows,
    };
  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
}

export default { parseCSV, parseCSVWithMapping };
