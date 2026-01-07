/**
 * Discrepancy Analyzer - Two-Phase Matching Logic
 *
 * Phase 1: Name Matching
 *   - Exact matches
 *   - Fuzzy matches (need user approval)
 *   - Unmatched from either side
 *
 * Phase 2: Premium Comparison
 *   - Only after names are confirmed
 *   - Compare premiums for matched employees
 *   - Flag discrepancies > tolerance
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-100)
 */
function similarityScore(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toUpperCase().trim();
  const s2 = str2.toUpperCase().trim();

  if (s1 === s2) return 100;

  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Calculate combined name similarity
 */
function nameSimilarity(last1, first1, last2, first2) {
  const lastScore = similarityScore(last1, last2);
  const firstScore = similarityScore(first1, first2);

  // Weight last name slightly higher (60/40)
  return Math.round(lastScore * 0.6 + firstScore * 0.4);
}

/**
 * Normalize name for matching (remove special chars, standardize)
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/[-_]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * Create a name key for exact matching
 */
function createNameKey(lastName, firstName) {
  return `${normalizeName(lastName)}|${normalizeName(firstName)}`;
}

/**
 * Parse premium value (handles "$52.75" format)
 */
function parsePremium(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const cleaned = String(value).replace(/[$,]/g, '').trim();
  return parseFloat(cleaned) || 0;
}

/**
 * Normalize product type from verbose benefit plan names
 */
function normalizeProductType(productType) {
  if (!productType) return '';

  const pt = productType.toUpperCase();

  if (pt.includes('ACCIDENT')) return 'Accident';
  if (pt.includes('CANCER')) return 'Cancer';
  if (pt.includes('CRITICAL')) return 'Critical Illness';
  if (pt.includes('DISABILITY')) return 'Disability';
  if (pt.includes('LIFE') || pt.includes('WHOLE LIFE')) return 'Life';
  if (pt.includes('HOSPITAL')) return 'Hospital';
  if (pt.includes('DENTAL')) return 'Dental';
  if (pt.includes('VISION')) return 'Vision';

  return productType;
}

/**
 * Group records by employee (aggregate premiums)
 */
function groupByEmployee(records, lastNameField, firstNameField, premiumField, productTypeField) {
  const grouped = new Map();

  for (const record of records) {
    const lastName = String(record[lastNameField] || '').trim();
    const firstName = String(record[firstNameField] || '').trim();
    const key = createNameKey(lastName, firstName);
    const premium = parsePremium(record[premiumField]);
    const productType = normalizeProductType(record[productTypeField] || '');

    if (!grouped.has(key)) {
      grouped.set(key, {
        lastName,
        firstName,
        key,
        totalPremium: 0,
        products: [],
        records: []
      });
    }

    const emp = grouped.get(key);
    emp.totalPremium += premium;
    emp.products.push({
      productType,
      premium,
      originalRecord: record
    });
    emp.records.push(record);
  }

  // Round totals
  for (const emp of grouped.values()) {
    emp.totalPremium = Math.round(emp.totalPremium * 100) / 100;
  }

  return grouped;
}

/**
 * Check if a name mapping exists in learned mappings
 * Checks both directions since mappings may have been imported with carrier/payroll swapped
 */
function findLearnedMapping(carrierEmp, payrollEmployees, learnedMappings) {
  if (!learnedMappings || learnedMappings.length === 0) return null;

  for (const mapping of learnedMappings) {
    // Check if carrier matches the stored carrier_* fields
    if (normalizeName(mapping.carrier_last_name) === normalizeName(carrierEmp.lastName) &&
        normalizeName(mapping.carrier_first_name) === normalizeName(carrierEmp.firstName)) {
      // Find the payroll employee this maps to
      const payrollKey = createNameKey(mapping.payroll_last_name, mapping.payroll_first_name);
      if (payrollEmployees.has(payrollKey)) {
        return payrollEmployees.get(payrollKey);
      }
    }

    // Also check reverse direction (in case mapping was stored backwards)
    if (normalizeName(mapping.payroll_last_name) === normalizeName(carrierEmp.lastName) &&
        normalizeName(mapping.payroll_first_name) === normalizeName(carrierEmp.firstName)) {
      // Find the payroll employee using the carrier_* fields
      const payrollKey = createNameKey(mapping.carrier_last_name, mapping.carrier_first_name);
      if (payrollEmployees.has(payrollKey)) {
        return payrollEmployees.get(payrollKey);
      }
    }
  }
  return null;
}

/**
 * PHASE 1: Find name matches between carrier and payroll data
 * Returns exact matches, fuzzy matches (for review), and unmatched
 */
export function findNameMatches(carrierRecords, payrollRecords, options = {}) {
  const {
    carrierLastName = 'LAST',
    carrierFirstName = 'FIRST',
    carrierPremium = 'Monthly',
    carrierProductType = 'Product Type',
    payrollLastName = 'Last',
    payrollFirstName = 'First',
    payrollPremium = 'Monthly Premium',
    payrollProductType = 'Benefit Plan',
    nameMatchThreshold = 80,
    learnedMappings = []
  } = options;

  // Group by employee
  const carrierEmployees = groupByEmployee(
    carrierRecords, carrierLastName, carrierFirstName, carrierPremium, carrierProductType
  );
  const payrollEmployees = groupByEmployee(
    payrollRecords, payrollLastName, payrollFirstName, payrollPremium, payrollProductType
  );

  const results = {
    exactMatches: [],        // Names match exactly
    learnedMatches: [],      // Previously approved fuzzy matches
    fuzzyMatches: [],        // Need user approval
    unmatchedCarrier: [],    // In carrier, no match found
    unmatchedPayroll: [],    // In payroll, no match found
    summary: {
      carrierEmployees: carrierEmployees.size,
      payrollEmployees: payrollEmployees.size,
      carrierTotalPremium: 0,
      payrollTotalPremium: 0
    }
  };

  // Calculate totals
  for (const emp of carrierEmployees.values()) {
    results.summary.carrierTotalPremium += emp.totalPremium;
  }
  for (const emp of payrollEmployees.values()) {
    results.summary.payrollTotalPremium += emp.totalPremium;
  }
  results.summary.carrierTotalPremium = Math.round(results.summary.carrierTotalPremium * 100) / 100;
  results.summary.payrollTotalPremium = Math.round(results.summary.payrollTotalPremium * 100) / 100;

  const matchedPayrollKeys = new Set();

  // First pass: exact matches
  for (const [carrierKey, carrierEmp] of carrierEmployees) {
    if (payrollEmployees.has(carrierKey)) {
      const payrollEmp = payrollEmployees.get(carrierKey);
      matchedPayrollKeys.add(carrierKey);

      results.exactMatches.push({
        carrier: carrierEmp,
        payroll: payrollEmp,
        matchType: 'exact',
        similarityScore: 100
      });
    }
  }

  // Second pass: learned mappings and fuzzy matches for unmatched carrier employees
  for (const [carrierKey, carrierEmp] of carrierEmployees) {
    // Skip if already matched
    if (results.exactMatches.some(m => m.carrier.key === carrierKey)) continue;

    // Check learned mappings first
    const learnedMatch = findLearnedMapping(carrierEmp, payrollEmployees, learnedMappings);
    if (learnedMatch && !matchedPayrollKeys.has(learnedMatch.key)) {
      matchedPayrollKeys.add(learnedMatch.key);
      results.learnedMatches.push({
        carrier: carrierEmp,
        payroll: learnedMatch,
        matchType: 'learned',
        similarityScore: nameSimilarity(
          carrierEmp.lastName, carrierEmp.firstName,
          learnedMatch.lastName, learnedMatch.firstName
        )
      });
      continue;
    }

    // Find best fuzzy match
    let bestMatch = null;
    let bestScore = 0;

    for (const [payrollKey, payrollEmp] of payrollEmployees) {
      if (matchedPayrollKeys.has(payrollKey)) continue;

      const score = nameSimilarity(
        carrierEmp.lastName, carrierEmp.firstName,
        payrollEmp.lastName, payrollEmp.firstName
      );

      if (score >= nameMatchThreshold && score > bestScore) {
        bestScore = score;
        bestMatch = payrollEmp;
      }
    }

    if (bestMatch) {
      matchedPayrollKeys.add(bestMatch.key);
      results.fuzzyMatches.push({
        carrier: carrierEmp,
        payroll: bestMatch,
        matchType: 'fuzzy',
        similarityScore: bestScore
      });
    } else {
      results.unmatchedCarrier.push(carrierEmp);
    }
  }

  // Find payroll employees not matched
  for (const [payrollKey, payrollEmp] of payrollEmployees) {
    if (!matchedPayrollKeys.has(payrollKey)) {
      results.unmatchedPayroll.push(payrollEmp);
    }
  }

  return results;
}

/**
 * Apply user decisions on fuzzy name matches
 * Returns confirmed matches and updates unmatched lists
 */
export function applyNameDecisions(phase1Results, decisions) {
  // decisions: [{ index, approved }]
  const confirmedMatches = [
    ...phase1Results.exactMatches,
    ...phase1Results.learnedMatches
  ];
  const newUnmatchedCarrier = [...phase1Results.unmatchedCarrier];
  const newUnmatchedPayroll = [...phase1Results.unmatchedPayroll];
  const approvedMappings = []; // To save to DB

  for (let i = 0; i < phase1Results.fuzzyMatches.length; i++) {
    const match = phase1Results.fuzzyMatches[i];
    const decision = decisions.find(d => d.index === i);

    if (decision?.approved) {
      confirmedMatches.push({
        ...match,
        matchType: 'fuzzy_approved'
      });
      // Save for learning DB
      approvedMappings.push({
        carrier_last_name: match.carrier.lastName,
        carrier_first_name: match.carrier.firstName,
        payroll_last_name: match.payroll.lastName,
        payroll_first_name: match.payroll.firstName
      });
    } else {
      newUnmatchedCarrier.push(match.carrier);
      newUnmatchedPayroll.push(match.payroll);
    }
  }

  return {
    confirmedMatches,
    unmatchedCarrier: newUnmatchedCarrier,
    unmatchedPayroll: newUnmatchedPayroll,
    approvedMappings,
    summary: phase1Results.summary
  };
}

/**
 * PHASE 2: Compare premiums for confirmed matches
 * Returns perfect matches and premium discrepancies
 */
export function comparePremiums(confirmedMatches, options = {}) {
  const { premiumTolerance = 0.05 } = options;

  const results = {
    perfectMatches: [],       // Premium within tolerance
    premiumDiscrepancies: []  // Premium differs > tolerance
  };

  for (const match of confirmedMatches) {
    const premiumDiff = Math.abs(match.carrier.totalPremium - match.payroll.totalPremium);

    if (premiumDiff <= premiumTolerance) {
      results.perfectMatches.push({
        ...match,
        premiumDiff,
        premiumMatch: true
      });
    } else {
      results.premiumDiscrepancies.push({
        ...match,
        premiumDiff,
        premiumMatch: false
      });
    }
  }

  return results;
}

/**
 * Apply user decisions on premium discrepancies
 * Mark as acknowledged or needs investigation
 */
export function applyPremiumDecisions(phase2Results, decisions) {
  // decisions: [{ index, acknowledged }]
  const finalResults = {
    perfectMatches: [...phase2Results.perfectMatches],
    acknowledgedDiscrepancies: [],
    unresolvedDiscrepancies: []
  };

  for (let i = 0; i < phase2Results.premiumDiscrepancies.length; i++) {
    const disc = phase2Results.premiumDiscrepancies[i];
    const decision = decisions.find(d => d.index === i);

    if (decision?.acknowledged) {
      finalResults.acknowledgedDiscrepancies.push({
        ...disc,
        status: 'acknowledged'
      });
    } else {
      finalResults.unresolvedDiscrepancies.push({
        ...disc,
        status: 'unresolved'
      });
    }
  }

  return finalResults;
}

// Legacy function for backward compatibility
export function findMatches(carrierRecords, payrollRecords, options = {}) {
  const phase1 = findNameMatches(carrierRecords, payrollRecords, options);

  // Auto-approve all fuzzy matches for legacy behavior
  const allApproved = phase1.fuzzyMatches.map((_, i) => ({ index: i, approved: true }));
  const afterNames = applyNameDecisions(phase1, allApproved);

  const phase2 = comparePremiums(afterNames.confirmedMatches, options);

  return {
    perfectMatches: phase2.perfectMatches,
    fuzzyMatches: phase1.fuzzyMatches,
    premiumDiscrepancies: phase2.premiumDiscrepancies,
    missingFromPayroll: afterNames.unmatchedCarrier,
    missingFromCarrier: afterNames.unmatchedPayroll,
    summary: phase1.summary
  };
}

export function applyFuzzyDecisions(results, decisions) {
  // Legacy compatibility
  const newPerfectMatches = [];
  const newPremiumDiscrepancies = [];
  const newMissingFromPayroll = [];
  const newMissingFromCarrier = [];

  for (let i = 0; i < results.fuzzyMatches.length; i++) {
    const match = results.fuzzyMatches[i];
    const decision = decisions.find(d => d.index === i);

    if (decision?.approved) {
      if (match.premiumMatch) {
        newPerfectMatches.push({ ...match, userApproved: true });
      } else {
        newPremiumDiscrepancies.push({ ...match, userApproved: true });
      }
    } else {
      newMissingFromPayroll.push(match.carrier);
      newMissingFromCarrier.push(match.payroll);
    }
  }

  return {
    ...results,
    perfectMatches: [...results.perfectMatches, ...newPerfectMatches],
    premiumDiscrepancies: [...results.premiumDiscrepancies, ...newPremiumDiscrepancies],
    missingFromPayroll: [...results.missingFromPayroll, ...newMissingFromPayroll],
    missingFromCarrier: [...results.missingFromCarrier, ...newMissingFromCarrier],
    fuzzyMatches: []
  };
}

export default {
  findNameMatches,
  applyNameDecisions,
  comparePremiums,
  applyPremiumDecisions,
  findMatches,
  applyFuzzyDecisions,
  similarityScore,
  nameSimilarity,
  parsePremium,
  normalizeProductType
};
