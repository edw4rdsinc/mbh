/**
 * Nicole's Deduction Report - Data Transformer
 * Transforms benefit enrollment CSV data into the format needed for Nicole's Excel report
 */

// Plan type display name mappings
const PLAN_TYPE_MAP = {
  'Long Term Disability': 'LTD',
  'Voluntary Life/AD&D': 'Vol Life/AD&D',
  'FSA Health Care': 'FSA Health Care',
  'FSA Dependent Care': 'FSA Dependent Care',
  'FSA Transit': 'FSA Transit',
  'Transit': 'FSA Transit',  // Nicole displays Transit as FSA Transit
};

// Carrier abbreviations for summary line
const CARRIER_ABBREV = {
  'CaliforniaChoice': 'CalChoice',
  'Loomis Company': 'Loomis',
};

// Plan type sort order (Nicole's specific order)
// Note: More specific matches must come BEFORE general matches
const PLAN_ORDER = [
  'accident',
  'medical',
  'dental',
  'life/ad&d',  // Basic life/AD&D (exact match)
  'vision',
  'fsa health',
  'fsa dependent',
  'fsa transit',
  'transit',
  'gap',
  'pet',
  'ltd',
  'long term disability',
  'vol life',        // Vol life comes after LTD
  'voluntary life',
  'benefit allowance',
];

/**
 * Convert string to title case
 */
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Parse currency string to number
 */
function parseCurrency(value) {
  if (!value || value === '') return 0;
  const cleaned = String(value).replace(/[$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse date string to Date object
 */
function parseDate(value) {
  if (!value || value === '') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get plan type sort priority
 * Uses specific matching to avoid false positives (e.g. "vol life" containing "life")
 */
function getPlanOrder(planType) {
  const lower = (planType || '').toLowerCase();

  // Handle specific plan types that could cause false positives
  if (lower.includes('voluntary') || lower.includes('vol life') || lower.includes('vol ad&d')) {
    return 14; // Vol Life/AD&D
  }
  if (lower.includes('benefit allowance')) {
    return 15;
  }
  if (lower.includes('long term') || lower === 'ltd') {
    return 12;
  }

  // Standard matching for other types
  if (lower.includes('accident')) return 0;
  if (lower.includes('medical')) return 1;
  if (lower.includes('dental')) return 2;
  if (lower.includes('life') || lower.includes('ad&d')) return 3; // Basic Life/AD&D
  if (lower.includes('vision')) return 4;
  if (lower.includes('fsa health')) return 5;
  if (lower.includes('fsa dependent')) return 6;
  if (lower.includes('fsa transit') || lower.includes('transit')) return 7;
  if (lower.includes('gap')) return 8;
  if (lower.includes('pet')) return 9;

  return 999;
}

/**
 * Determine if a plan is pre-tax based on CSV columns
 */
function isPreTax(preTaxCost, postTaxCost, planType) {
  const lowerPlan = (planType || '').toLowerCase();

  // These are always post-tax
  if (lowerPlan.includes('life') || lowerPlan.includes('ltd') ||
      lowerPlan.includes('disability') || lowerPlan.includes('benefit allowance')) {
    return 'N';
  }

  // If we have pre-tax cost data, use it
  if (preTaxCost > 0 && postTaxCost === 0) return 'Y';
  if (postTaxCost > 0) return 'N';

  // Default pre-tax for medical/dental/vision/fsa/etc
  return 'Y';
}

/**
 * Format coverage details based on plan type
 * Matches Nicole's exact formatting:
 * - Regular plans: "EE", "EE+SP", etc.
 * - Life/AD&D (basic): just the number (50000)
 * - Vol Life/AD&D: "EE: $60,000"
 * - LTD: "$7,250 Monthly"
 * - FSA Transit: "$15 Monthly"
 * - Benefit Allowance: "ER: $65 Monthly"
 */
function formatCoverageDetails(coverageTier, coverageDetails, planType, erContribution) {
  const lowerPlan = (planType || '').toLowerCase();
  const details = coverageDetails || '';

  // Benefit Allowance - show ER amount monthly
  if (lowerPlan.includes('benefit allowance')) {
    // Extract the per-pay-period amount and convert to monthly
    const match = details.match(/\$([\d,.]+)/);
    if (match && erContribution > 0) {
      // erContribution is already the monthly ER amount
      return `ER: $${Math.round(erContribution)} Monthly`;
    }
    // Try extracting from coverage details
    if (match) {
      const perPeriod = parseCurrency(match[0]);
      // Assume semi-monthly, so multiply by 2
      return `ER: $${Math.round(perPeriod * 2)} Monthly`;
    }
    return '';
  }

  // FSA Transit - show monthly amount
  if (lowerPlan.includes('transit') || lowerPlan.includes('fsa')) {
    const match = details.match(/\$([\d,]+)/);
    if (match) {
      return `${match[0]} Monthly`;
    }
    // Try parsing from total rate
    return '';
  }

  // LTD - show monthly benefit amount
  if (lowerPlan.includes('ltd') || lowerPlan.includes('long term disability')) {
    // Coverage details usually has benefit amount like "60% of salary up to $7,250 per month"
    const match = details.match(/\$([\d,]+)/);
    if (match) {
      return `${match[0]} Monthly`;
    }
    return '';
  }

  // Voluntary Life/AD&D - show "EE: $X" format
  if (lowerPlan.includes('vol') && (lowerPlan.includes('life') || lowerPlan.includes('ad&d'))) {
    // Extract employee benefit amount
    const eeMatch = details.match(/Employee:\s*\$([\d,]+)/i);
    if (eeMatch) {
      return `EE: $${eeMatch[1]}`;
    }
    const dollarMatch = details.match(/\$([\d,]+)/);
    if (dollarMatch) {
      return `EE: $${dollarMatch[1]}`;
    }
    return '';
  }

  // Basic Life/AD&D - just the number (no formatting)
  if (lowerPlan.includes('life') || lowerPlan.includes('ad&d')) {
    // Extract the benefit amount as a plain number
    const eeMatch = details.match(/Employee:\s*\$([\d,]+)/i);
    if (eeMatch) {
      // Return as number, not string
      return parseInt(eeMatch[1].replace(/,/g, ''), 10);
    }
    const dollarMatch = details.match(/\$([\d,]+)/);
    if (dollarMatch) {
      return parseInt(dollarMatch[1].replace(/,/g, ''), 10);
    }
    return '';
  }

  // Standard coverage tier - convert to abbreviation
  const tierMap = {
    'Employee Only': 'EE',
    'Employee': 'EE',
    'Employee + Spouse': 'EE+SP',
    'Employee + Child': 'EE+CH',
    'Employee + Children': 'EE+CH',
    'Employee + Family': 'EE+FAM',
    'Employee + Spouse + Children': 'EE+FAM',
    'Family': 'FAM',
  };

  if (tierMap[coverageTier]) {
    return tierMap[coverageTier];
  }

  // Try to extract from coverage details
  const detailsLower = details.toLowerCase();
  if (detailsLower === 'employee' || detailsLower.includes('employee only')) return 'EE';
  if (detailsLower.includes('spouse') && detailsLower.includes('child')) return 'EE+FAM';
  if (detailsLower.includes('family')) return 'EE+FAM';
  if (detailsLower.includes('spouse')) return 'EE+SP';
  if (detailsLower.includes('child')) return 'EE+CH';

  return coverageTier || '';
}

/**
 * Get display plan type
 */
function getDisplayPlanType(planType) {
  return PLAN_TYPE_MAP[planType] || planType;
}

/**
 * Extract plan name - keep carrier prefix for some plans
 */
function extractPlanName(planDisplayName, carrier, planType) {
  if (!planDisplayName) return '';
  const lowerPlan = (planType || '').toLowerCase();

  // Remove year prefix like "2025 "
  let name = planDisplayName.replace(/^\d{4}\s+/, '');

  // Remove letter prefixes like "A. " or "B. "
  name = name.replace(/^[A-Z]\.\s+/, '');

  // For Benefit Allowance, use consistent name
  if (lowerPlan.includes('benefit allowance')) {
    return 'Supplemental Benefit Allowance';
  }

  // For Accident plans, keep Allstate Benefits prefix
  if (lowerPlan.includes('accident') && name.toLowerCase().includes('allstate')) {
    // Already has the prefix
    return name;
  }

  // For LTD and Vol Life, keep Principal prefix
  if (carrier === 'Principal' && (lowerPlan.includes('ltd') || lowerPlan.includes('long term') || lowerPlan.includes('vol'))) {
    if (!name.toLowerCase().startsWith('principal')) {
      return `Principal ${name}`;
    }
    return name;
  }

  // For other plans, remove carrier prefix if present
  name = name.replace(/^CalChoice\s+/i, '');
  name = name.replace(/^CoPower One\s+/i, '');
  name = name.replace(/^CoPower\s+/i, '');

  return name;
}

/**
 * Build carrier summary string with policy numbers
 * Uses abbreviated carrier names as Nicole does
 */
function buildCarrierSummary(rows) {
  const carrierPolicies = {};

  for (const row of rows) {
    let carrier = row['Carrier'];
    const policyNumber = row['Policy Number'];

    if (carrier && carrier.trim()) {
      // Abbreviate carrier name
      carrier = CARRIER_ABBREV[carrier] || carrier;

      if (!carrierPolicies[carrier]) {
        carrierPolicies[carrier] = new Set();
      }
      if (policyNumber && policyNumber.trim()) {
        // Use first part of policy number (before any dash)
        let policyId = policyNumber.trim().split('-')[0];
        carrierPolicies[carrier].add(policyId);
      }
    }
  }

  // Build summary string - Allstate uses letter+number format (D8908)
  const parts = [];
  const sortedCarriers = Object.keys(carrierPolicies).sort();

  for (const carrier of sortedCarriers) {
    const policies = Array.from(carrierPolicies[carrier]).sort();
    if (policies.length > 0) {
      parts.push(`${carrier} ${policies[0]}`);
    } else {
      parts.push(carrier);
    }
  }

  return parts.join(' / ');
}

/**
 * Main transformation function
 */
export function transform(csvRows, settings = {}) {
  if (!csvRows || csvRows.length === 0) {
    return { rows: [], companyName: '', carrierSummary: '', reportDate: '' };
  }

  const payCycle = settings.payCycle || 'Semi-Monthly';
  const payPeriods = payCycle === 'Semi-Monthly' ? 24 : (payCycle === 'Bi-Weekly' ? 26 : 12);
  const divisor = payPeriods / 12; // 2 for semi-monthly

  // Get company name from first row
  const companyName = csvRows[0]['Company Name'] || '';

  // Build carrier summary
  const carrierSummary = buildCarrierSummary(csvRows);

  // Transform rows
  const transformedRows = [];

  for (const row of csvRows) {
    // Skip dependents (only include employees)
    if (row['Relationship'] && row['Relationship'] !== 'Employee') {
      continue;
    }

    // Skip waived/declined elections
    const action = (row['Action'] || '').toLowerCase();
    if (action === 'waived' || action === 'declined') {
      continue;
    }

    const planType = row['Plan Type'] || '';
    const totalRate = parseCurrency(row['Total Rate']);
    const eeContribution = parseCurrency(row['Employee Contribution']);
    const erContribution = parseCurrency(row['Employer Contribution']);
    const preTaxCost = parseCurrency(row['Employee Pre-Tax Cost']);
    const postTaxCost = parseCurrency(row['Employee Post-Tax Cost']);

    // Calculate per-pay-cycle amounts (round to 2 decimal places)
    const erPerCycle = Math.round((erContribution / divisor) * 100) / 100;
    const eePerCycle = Math.round((eeContribution / divisor) * 100) / 100;

    // Handle Benefit Allowance - it shows as negative EE contribution (credit)
    let finalEEContrib = eeContribution;
    let finalEEPerCycle = eePerCycle;
    let finalERContrib = erContribution;
    let finalERPerCycle = erPerCycle;

    if (planType.toLowerCase().includes('benefit allowance')) {
      // Total rate is 0, ER contribution becomes the credit
      finalEEContrib = -erContribution;
      finalEEPerCycle = -erPerCycle;
    }

    transformedRows.push({
      location: row['Location'] || '',
      lastName: toTitleCase(row['Last Name'] || ''),
      firstName: toTitleCase(row['First Name'] || ''),
      planType: getDisplayPlanType(planType),
      carrier: row['Carrier'] || '',
      planName: extractPlanName(row['Plan Display Name'], row['Carrier'], planType),
      coverageDetails: formatCoverageDetails(row['Coverage Tier'], row['Coverage Details'], planType, erContribution),
      effectiveDate: parseDate(row['Effective Date']),
      preTax: isPreTax(preTaxCost, postTaxCost, planType),
      totalRate: totalRate,
      erContribution: finalERContrib,
      eeContribution: finalEEContrib,
      payCycle: payCycle,
      erPerCycle: finalERPerCycle,
      eePerCycle: finalEEPerCycle,
      // Keep original values for sorting
      _lastName: (row['Last Name'] || '').trim().toLowerCase(),
      _firstName: (row['First Name'] || '').trim().toLowerCase(),
      _planType: planType,
    });
  }

  // Sort by location, last name, first name, then plan type order
  transformedRows.sort((a, b) => {
    // Sort by location first (SF before OOS)
    const locA = a.location.toLowerCase().includes('san francisco') ? 0 : 1;
    const locB = b.location.toLowerCase().includes('san francisco') ? 0 : 1;
    if (locA !== locB) return locA - locB;

    // Then by last name
    const lastCmp = a._lastName.localeCompare(b._lastName);
    if (lastCmp !== 0) return lastCmp;

    // Then by first name
    const firstCmp = a._firstName.localeCompare(b._firstName);
    if (firstCmp !== 0) return firstCmp;

    // Then by plan type order
    return getPlanOrder(a._planType) - getPlanOrder(b._planType);
  });

  // Group by employee and add subtotal rows
  const result = [];
  let currentEmployee = null;
  let employeeStartIndex = 0;

  for (let i = 0; i < transformedRows.length; i++) {
    const row = transformedRows[i];
    const empKey = `${row._lastName}|${row._firstName}|${row.location}`;

    if (currentEmployee !== empKey) {
      // Add subtotal for previous employee
      if (currentEmployee !== null && result.length > 0) {
        result.push({
          isSubtotal: true,
          location: result[result.length - 1].location,
          lastName: result[result.length - 1].lastName,
          firstName: result[result.length - 1].firstName,
          startRow: employeeStartIndex,
          endRow: result.length - 1,
        });
      }

      currentEmployee = empKey;
      employeeStartIndex = result.length;
    }

    // Remove internal sorting fields
    const { _lastName, _firstName, _planType, ...cleanRow } = row;
    result.push(cleanRow);
  }

  // Add final subtotal
  if (result.length > 0 && currentEmployee !== null) {
    result.push({
      isSubtotal: true,
      location: result[result.length - 1].location,
      lastName: result[result.length - 1].lastName,
      firstName: result[result.length - 1].firstName,
      startRow: employeeStartIndex,
      endRow: result.length - 1,
    });
  }

  return {
    rows: result,
    companyName,
    carrierSummary,
    reportDate: settings.reportDate || new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }),
  };
}

export default {
  transform,
  parseCurrency,
  parseDate,
};
