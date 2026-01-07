import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'https://exzeayeoosiabwhgyquq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4emVheWVvb3NpYWJ3aGd5cXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NDcwOSwiZXhwIjoyMDY5NTUwNzA5fQ.Qgwxa5JxhvV05CZhPeG-Ag7FpJiRO3hLaIJxN6k8708'
);

async function importMappings() {
  const workbook = XLSX.readFile('/tmp/discrepancy3.ods');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const mappings = [];

  for (let i = 1; i < rows.length; i++) { // Skip header
    const row = rows[i];
    if (!row || row.length < 3) continue;

    const col1 = String(row[0] || '').trim();
    const col2 = String(row[1] || '').trim();
    const col3 = String(row[2] || '').trim();
    const col4 = String(row[3] || '').trim();

    if (col1 && col3) {
      mappings.push({
        carrier_last: col1.toUpperCase(),
        carrier_first: col2.toUpperCase(),
        payroll_last: col3.toUpperCase(),
        payroll_first: col4.toUpperCase()
      });
    }
  }

  console.log(`Found ${mappings.length} mappings in file:\n`);
  for (const m of mappings) {
    console.log(`  "${m.carrier_last}, ${m.carrier_first}" -> "${m.payroll_last}, ${m.payroll_first}"`);
  }

  // Insert both directions
  const toInsert = [];
  for (const m of mappings) {
    // Forward direction
    toInsert.push({
      carrier_last_name: m.carrier_last,
      carrier_first_name: m.carrier_first,
      payroll_last_name: m.payroll_last,
      payroll_first_name: m.payroll_first,
      account_name: 'Ampla Health',
      created_by: 'bulk-import'
    });
    // Reverse direction
    toInsert.push({
      carrier_last_name: m.payroll_last,
      carrier_first_name: m.payroll_first,
      payroll_last_name: m.carrier_last,
      payroll_first_name: m.carrier_first,
      account_name: 'Ampla Health',
      created_by: 'bulk-import'
    });
  }

  console.log(`\nInserting ${toInsert.length} mappings (both directions)...`);

  const { data, error } = await supabase
    .from('mbh_name_mappings')
    .upsert(toInsert, { onConflict: 'carrier_last_name,carrier_first_name,payroll_last_name,payroll_first_name,account_name' })
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`✅ Upserted ${data.length} mappings`);
}

importMappings();
