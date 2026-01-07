import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://exzeayeoosiabwhgyquq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4emVheWVvb3NpYWJ3aGd5cXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NDcwOSwiZXhwIjoyMDY5NTUwNzA5fQ.Qgwxa5JxhvV05CZhPeG-Ag7FpJiRO3hLaIJxN6k8708'
);

const ACCOUNT_NAME = 'Ampla Health';

// Parse CSV
function parseCSV(content) {
  const lines = content.trim().split('\n');
  const rows = [];

  for (let i = 1; i < lines.length; i++) { // Skip header
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields with commas
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    if (fields.length >= 4 && fields[0] && fields[2]) {
      rows.push({
        carrierLast: fields[0].toUpperCase().trim(),
        carrierFirst: fields[1].toUpperCase().trim(),
        payrollLast: fields[2].toUpperCase().trim(),
        payrollFirst: fields[3].toUpperCase().trim()
      });
    }
  }

  return rows;
}

// Create a normalized key for deduplication
function makeKey(carrierLast, carrierFirst, payrollLast, payrollFirst) {
  return `${carrierLast}|${carrierFirst}|${payrollLast}|${payrollFirst}`;
}

// Deduplicate - keep only unique mappings (ignore reverse duplicates)
function deduplicate(rows) {
  const seen = new Set();
  const unique = [];

  for (const row of rows) {
    const key1 = makeKey(row.carrierLast, row.carrierFirst, row.payrollLast, row.payrollFirst);
    const key2 = makeKey(row.payrollLast, row.payrollFirst, row.carrierLast, row.carrierFirst);

    if (!seen.has(key1) && !seen.has(key2)) {
      seen.add(key1);
      unique.push(row);
    }
  }

  return unique;
}

async function importMappings() {
  // Read CSV
  const csv = readFileSync('/tmp/discrepancy-matches.csv', 'utf-8');
  const rows = parseCSV(csv);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Deduplicate
  const unique = deduplicate(rows);
  console.log(`After deduplication: ${unique.length} unique mappings`);

  // Get existing mappings for Ampla Health
  const { data: existing, error: fetchError } = await supabase
    .from('mbh_name_mappings')
    .select('carrier_last_name, carrier_first_name, payroll_last_name, payroll_first_name')
    .eq('account_name', ACCOUNT_NAME);

  if (fetchError) {
    console.error('Error fetching existing:', fetchError);
    return;
  }

  // Create set of existing mappings
  const existingSet = new Set(
    existing.map(e => makeKey(e.carrier_last_name, e.carrier_first_name, e.payroll_last_name, e.payroll_first_name))
  );
  console.log(`Found ${existing.length} existing Ampla Health mappings`);

  // Filter to only new mappings
  const newMappings = unique.filter(row => {
    const key = makeKey(row.carrierLast, row.carrierFirst, row.payrollLast, row.payrollFirst);
    return !existingSet.has(key);
  });

  console.log(`New mappings to import: ${newMappings.length}`);

  if (newMappings.length === 0) {
    console.log('No new mappings to import.');
    return;
  }

  // Show what we're importing
  console.log('\nNew mappings:');
  for (const m of newMappings) {
    console.log(`  ${m.carrierLast}, ${m.carrierFirst} -> ${m.payrollLast}, ${m.payrollFirst}`);
  }

  // Insert new mappings
  const toInsert = newMappings.map(m => ({
    carrier_last_name: m.carrierLast,
    carrier_first_name: m.carrierFirst,
    payroll_last_name: m.payrollLast,
    payroll_first_name: m.payrollFirst,
    account_name: ACCOUNT_NAME,
    created_by: 'bulk-import'
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('mbh_name_mappings')
    .insert(toInsert)
    .select();

  if (insertError) {
    console.error('Error inserting:', insertError);
    return;
  }

  console.log(`\n✅ Successfully imported ${inserted.length} new mappings`);
}

importMappings();
