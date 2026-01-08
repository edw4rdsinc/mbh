import { parse, format } from 'date-fns';

/**
 * Detect input format based on column headers
 * @param {Array} rows - CSV rows
 * @returns {string} - 'misc', 'dental', 'vision', or 'unknown'
 */
function detectFormat(rows) {
  if (!rows || rows.length === 0) return 'unknown';

  const firstRow = rows[0];
  const headers = Object.keys(firstRow);

  // Misc format has 'Insured Name', 'Mode Premium', 'Product Type'
  if (headers.includes('Insured Name') && headers.includes('Mode Premium')) {
    return 'misc';
  }

  // Dental/Vision format has 'employee_name', 'employee_premium_amt'
  if (headers.includes('employee_name') && headers.includes('employee_premium_amt')) {
    // Check if it's dental or vision based on premium amounts or just return generic
    // We'll determine the product type from the filename/context passed in
    return 'dental_vision';
  }

  return 'unknown';
}

/**
 * Map dependent_status_desc (A/B/C/D) to readable status
 * A = Employee Only, B = Employee + Spouse, C = Employee + Child(ren), D = Family
 */
function mapDependentStatus(code) {
  const statusMap = {
    'A': 'Active',
    'B': 'Active',
    'C': 'Active',
    'D': 'Active',
  };
  return statusMap[code] || 'Active';
}

/**
 * Normalize dental/vision format rows to misc format
 * @param {Array} rows - Dental/Vision format rows
 * @param {string} productType - 'Dental' or 'Vision'
 * @returns {Array} - Rows in misc format
 */
function normalizeDentalVisionRows(rows, productType) {
  return rows.map(row => ({
    'Number': '',  // No policy number in dental/vision
    'Account Number': '',
    'Account Name': '',
    'Insured Name': row['employee_name'] || '',
    'Mode Premium': row['employee_premium_amt'] || 0,
    'Payor Name': row['employee_name'] || '',
    'Product Type': productType,
    'Status': mapDependentStatus(row['dependent_status_desc']),
    'Effective Date': '',
    'Source': '',
    // Preserve original fields for reference
    '_dependent_status': row['dependent_status_desc'],
    '_dependent_premium': row['dependent_premium_amt'],
    '_total_premium': row['total_premium_amt'],
  }));
}

/**
 * Normalize rows from any supported format to the standard misc format
 * @param {Array} rows - Input rows
 * @param {string} productTypeHint - Optional hint for product type (e.g., 'Dental', 'Vision')
 * @returns {Array} - Normalized rows in misc format
 */
export function normalizeRows(rows, productTypeHint = '') {
  const format = detectFormat(rows);

  if (format === 'misc') {
    return rows;  // Already in correct format
  }

  if (format === 'dental_vision') {
    // Determine product type from hint or default
    let productType = productTypeHint || 'Benefit';

    // Try to detect from hint
    const hintLower = (productTypeHint || '').toLowerCase();
    if (hintLower.includes('dental')) {
      productType = 'Dental';
    } else if (hintLower.includes('vision')) {
      productType = 'Vision';
    }

    return normalizeDentalVisionRows(rows, productType);
  }

  // Unknown format - return as-is and let transform handle missing fields
  return rows;
}

/**
 * Frequency divisors for converting monthly to per-period deductions
 */
const FREQUENCY_DIVISORS = {
  'monthly': 1,
  'semi-monthly': 2,
  'bi-weekly': 2.1667,  // 26 pay periods / 12 months
  'weekly': 4.3333,     // 52 pay periods / 12 months
};

/**
 * Frequency display labels
 */
const FREQUENCY_LABELS = {
  'monthly': 'Monthly',
  'semi-monthly': 'Semi-Monthly',
  'bi-weekly': 'Bi-Weekly',
  'weekly': 'Weekly',
};

/**
 * Convert string to title case
 * @param {string} str - Input string
 * @returns {string} - Title cased string
 */
function toTitleCase(str) {
  if (!str) return '';

  return str
    .split(' ')
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Parse "LAST, FIRST" name format
 * @param {string} fullName - Full name in "LAST, FIRST" format
 * @returns {Object} - { lastName, firstName }
 */
export function parseName(fullName) {
  if (!fullName) {
    return { lastName: '', firstName: '' };
  }

  const parts = fullName.split(',').map(p => p.trim());

  if (parts.length >= 2) {
    return {
      lastName: toTitleCase(parts[0]),
      firstName: toTitleCase(parts[1]),
    };
  }

  // No comma found - treat entire string as last name
  return {
    lastName: toTitleCase(fullName.trim()),
    firstName: '',
  };
}

/**
 * Create employee key for grouping (uses Payor Name, not Insured Name)
 * @param {string} payorLastName - Payor's last name
 * @param {string} payorFirstName - Payor's first name
 * @returns {string} - Unique key for the employee/payor
 */
function getEmployeeKey(payorLastName, payorFirstName) {
  return `${(payorLastName || '').toLowerCase()}_${(payorFirstName || '').toLowerCase()}`;
}

/**
 * Map status based on value
 * @param {string} status - Original status
 * @param {string} effectiveDate - Effective date (unused, kept for API compatibility)
 * @param {string} newPolicyDate - Date to mark policies as "** NEW **" (unused, feature disabled)
 * @returns {string} - Mapped status
 */
export function mapStatus(status, effectiveDate, newPolicyDate) {
  // Handle "Active - Premium Paying" -> "Active"
  if (status === 'Active - Premium Paying') {
    return 'Active';
  }

  // Return original status as-is (no "** NEW **" renaming)
  // This feature was disabled per Amy's request - she will manually set
  // status values like "Active", "Pending", "Initial Premium Due", etc.
  return status;
}

/**
 * Convert date string to Excel serial number
 * @param {string|number} dateValue - Date value
 * @returns {number|string} - Excel serial number or original value
 */
function toExcelSerialNumber(dateValue) {
  if (!dateValue) return dateValue;

  // If it's already a number, return as-is
  if (typeof dateValue === 'number') {
    return dateValue;
  }

  // If it's a date string like "08/01/2023", convert to Excel serial
  if (typeof dateValue === 'string' && dateValue.includes('/')) {
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return dateValue;

      // Convert to Excel serial number (days since 1899-12-30)
      const excelEpoch = new Date(1899, 11, 30);
      const days = (date.getTime() - excelEpoch.getTime()) / (24 * 60 * 60 * 1000);
      return Math.floor(days);
    } catch (e) {
      return dateValue;
    }
  }

  return dateValue;
}

/**
 * Parse Excel date serial number or date string
 * @param {string|number} dateValue - Date value
 * @returns {Date|null} - Parsed date
 */
function parseExcelDate(dateValue) {
  if (!dateValue) return null;

  // If it's already a date string
  if (typeof dateValue === 'string' && dateValue.includes('/')) {
    try {
      return new Date(dateValue);
    } catch (e) {
      return null;
    }
  }

  // If it's an Excel date serial number (days since 1900-01-01)
  if (typeof dateValue === 'number' || !isNaN(parseFloat(dateValue))) {
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch
    const days = parseFloat(dateValue);
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Calculate Pre-Tax status based on product type
 * Default is "Y" (pre-tax eligible)
 * Only specific product types are "N" (not pre-tax):
 *   - Group Term to 100, Life, Disability, STD, LTD, Whole Life
 * @param {string} productType - Product type
 * @param {Object} mapping - Product type to Pre-Tax mapping (optional overrides)
 * @returns {string} - "Y" or "N"
 */
export function calculatePreTax(productType, mapping) {
  // Check explicit mapping first
  if (mapping && mapping[productType] !== undefined) {
    return mapping[productType];
  }

  // Products that are NOT pre-tax eligible (case-insensitive check)
  const notPreTaxProducts = [
    'group term to 100',
    'life',
    'disability',
    'std',
    'ltd',
    'whole life',
    'term life',
    'basic life',
    'voluntary life',
    'ad&d',
    'accidental death'
  ];

  const normalizedProduct = (productType || '').toLowerCase().trim();

  // Check if product matches any non-pretax product (partial match)
  for (const notPreTax of notPreTaxProducts) {
    if (normalizedProduct.includes(notPreTax) || notPreTax.includes(normalizedProduct)) {
      return 'N';
    }
  }

  // Default: pre-tax eligible
  return 'Y';
}

/**
 * Calculate deduction based on frequency
 * @param {number} monthlyAmount - Monthly amount
 * @param {string} frequency - Deduction frequency
 * @returns {number} - Per-period deduction (rounded to 2 decimals)
 */
export function calculateDeduction(monthlyAmount, frequency) {
  const amount = parseFloat(monthlyAmount);
  if (isNaN(amount)) return 0;

  const divisor = FREQUENCY_DIVISORS[frequency] || 2;
  return Math.round((amount / divisor) * 100) / 100;
}

/**
 * Calculate employer contribution for a single product
 * @param {number} productPremium - Product monthly premium
 * @param {string} productType - Product type
 * @param {Array} productContributions - Array of {productType, type, value} configs
 * @returns {number} - Employer contribution amount (capped at product premium)
 */
export function calculateProductERContribution(productPremium, productType, productContributions) {
  if (!productContributions || productContributions.length === 0) {
    return 0;
  }

  // Find matching product type config (case-insensitive)
  const config = productContributions.find(pc =>
    (pc.productType || '').toLowerCase() === (productType || '').toLowerCase()
  );

  if (!config) {
    return 0;
  }

  let contribution = 0;

  if (config.type === 'flat') {
    contribution = parseFloat(config.value) || 0;
  } else if (config.type === 'percentage') {
    contribution = productPremium * ((parseFloat(config.value) || 0) / 100);
  }

  // Cap at product premium (can't contribute more than the premium)
  return Math.min(Math.round(contribution * 100) / 100, productPremium);
}

/**
 * Filter out terminated employees
 * @param {Array} rows - Data rows
 * @returns {Array} - Filtered rows
 */
export function filterTerminated(rows) {
  return rows.filter(row => row['Status'] !== 'Terminated');
}

/**
 * Sort rows by last name, then first name
 * @param {Array} rows - Data rows (must have lastName and firstName)
 * @returns {Array} - Sorted rows
 */
export function sortByName(rows) {
  return [...rows].sort((a, b) => {
    const lastNameCompare = (a.lastName || '').localeCompare(b.lastName || '');
    if (lastNameCompare !== 0) return lastNameCompare;

    return (a.firstName || '').localeCompare(b.firstName || '');
  });
}

/**
 * Group rows by employee (Payor Name) with subtotals
 * @param {Array} rows - Sorted data rows
 * @param {Object} settings - Deduction settings
 * @returns {Array} - Rows with employee subtotals and blank separators inserted
 */
export function groupByEmployee(rows, settings) {
  if (rows.length === 0) return [];

  const { frequency, productContributions } = settings;
  const frequencyLabel = FREQUENCY_LABELS[frequency] || 'Semi-Monthly';

  const result = [];

  // Group by Payor Name (the employee who pays), not Insured Name
  const employeeGroups = {};
  for (const row of rows) {
    const empKey = getEmployeeKey(row.payorLastName, row.payorFirstName);
    if (!employeeGroups[empKey]) {
      employeeGroups[empKey] = {
        payorLastName: row.payorLastName,
        payorFirstName: row.payorFirstName,
        products: [],
      };
    }
    employeeGroups[empKey].products.push(row);
  }

  // Sort employees by Payor last name, first name
  const sortedEmployees = Object.values(employeeGroups).sort((a, b) => {
    const lastCmp = (a.payorLastName || '').localeCompare(b.payorLastName || '');
    if (lastCmp !== 0) return lastCmp;
    return (a.payorFirstName || '').localeCompare(b.payorFirstName || '');
  });

  // Excel row counter (data starts at row 9)
  let excelRowNum = 9;

  // Process each employee
  for (const employee of sortedEmployees) {
    const employeeStartRow = excelRowNum;

    // Add product rows with per-product ER contributions
    for (const product of employee.products) {
      // Calculate ER contribution for this specific product
      const erContribution = calculateProductERContribution(
        product.monthlyPremium,
        product.productType,
        productContributions
      );

      result.push({
        ...product,
        deductionCycle: frequencyLabel,
        erContribution,  // Per-product ER contribution
      });
      excelRowNum++;
    }

    // Add employee subtotal row with startRow for SUM formula
    result.push({
      isEmployeeSubtotal: true,
      payorLastName: employee.payorLastName,
      payorFirstName: employee.payorFirstName,
      startRow: employeeStartRow,  // For SUM(L{startRow}:L{currentRow-1})
      frequencyLabel,
    });
    excelRowNum++;

  }

  return result;
}

/**
 * Main transformation function (Amy's format)
 * @param {Object} csvData - Parsed CSV data (or combined data from multiple CSVs)
 * @param {Object} config - Configuration object
 * @param {Object} settings - User-provided settings (frequency, productContributions)
 * @returns {Object} - Transformed data ready for Excel generation
 */
export function transform(csvData, config, settings = {}) {
  const { accountNumber, accountName, rows } = csvData;
  const { processing, productTypePreTaxMapping } = config;

  // Merge settings with defaults
  const mergedSettings = {
    frequency: settings.frequency || 'semi-monthly',
    contributionType: settings.contributionType || 'none',
    contributionValue: settings.contributionValue || 0,
    productContributions: settings.productContributions || [],  // Array of {productType, type, value}
  };

  const frequencyLabel = FREQUENCY_LABELS[mergedSettings.frequency] || 'Semi-Monthly';

  // Step 1: Filter out terminated employees
  let transformedRows = filterTerminated(rows);

  // Step 2: Transform each row
  transformedRows = transformedRows.map(row => {
    // Parse Insured Name for display in Last Name/First Name columns
    const { lastName, firstName } = parseName(row['Insured Name']);
    // Parse Payor Name for grouping/sorting (the employee who pays)
    const { lastName: payorLastName, firstName: payorFirstName } = parseName(row['Payor Name']);
    const monthlyPremium = parseFloat(row['Mode Premium']) || 0;

    return {
      policyNumber: row['Number'],
      lastName,        // Display: from Insured Name
      firstName,       // Display: from Insured Name
      payorLastName,   // Grouping: from Payor Name
      payorFirstName,  // Grouping: from Payor Name
      productType: row['Product Type'],
      preTax: calculatePreTax(row['Product Type'], productTypePreTaxMapping),
      status: mapStatus(row['Status'], row['Effective Date'], processing.newPolicyDate),
      effectiveDate: toExcelSerialNumber(row['Effective Date']),
      deductionCycle: frequencyLabel,
      monthlyPremium,
      payorName: row['Payor Name'],
    };
  });

  // Step 3: Sort by Payor Name (the employee who pays), not Insured Name
  transformedRows = transformedRows.sort((a, b) => {
    const lastCmp = (a.payorLastName || '').localeCompare(b.payorLastName || '');
    if (lastCmp !== 0) return lastCmp;
    return (a.payorFirstName || '').localeCompare(b.payorFirstName || '');
  });

  // Step 4: Group by employee with subtotals (Amy's format - no payor grouping)
  transformedRows = groupByEmployee(transformedRows, mergedSettings);

  return {
    accountNumber,
    accountName,
    carrierName: processing.carrierName,
    rows: transformedRows,
    reportDate: new Date(),
    settings: mergedSettings,
    frequencyLabel,
  };
}

export default {
  parseName,
  mapStatus,
  calculatePreTax,
  calculateDeduction,
  calculateProductERContribution,
  filterTerminated,
  sortByName,
  groupByEmployee,
  transform,
  FREQUENCY_DIVISORS,
  FREQUENCY_LABELS,
};
