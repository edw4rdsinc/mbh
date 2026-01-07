import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://exzeayeoosiabwhgyquq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4emVheWVvb3NpYWJ3aGd5cXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NDcwOSwiZXhwIjoyMDY5NTUwNzA5fQ.Qgwxa5JxhvV05CZhPeG-Ag7FpJiRO3hLaIJxN6k8708'
);

const mappings = [
  { carrier_last: 'BAUGUESS', carrier_first: 'MICHAEL', payroll_last: 'BAUGBESS', payroll_first: 'MICHAEL' },
  { carrier_last: 'CARRASQUILLO NAVARRO', carrier_first: 'MARYTERE', payroll_last: 'CARRCSQUILLO NAVARRO', payroll_first: 'MARYTERE' },
  { carrier_last: 'CORTEZ URIOSTEGUI', carrier_first: 'FRANKIE', payroll_last: 'CORTCZ', payroll_first: 'FRANKIE' },
  { carrier_last: 'GOMEZ', carrier_first: 'ANNA M(3268)', payroll_last: 'GOMEG', payroll_first: 'ANNA M' },
  { carrier_last: 'HEDDLESTEN', carrier_first: 'LORI LEE', payroll_last: 'HEDDHESTEN', payroll_first: 'LORI LEE' },
  { carrier_last: 'LEON', carrier_first: 'GRACIELA', payroll_last: 'LEONL', payroll_first: 'GRACIELA' },
  { carrier_last: 'NAVARRO', carrier_first: 'TOPACIO', payroll_last: 'NAVANRO', payroll_first: 'TOPACIO' },
  { carrier_last: 'SANDOVAL SANDOVAL', carrier_first: 'MARIA GUADALUPE', payroll_last: 'SANDSVAL SANDOVAL', payroll_first: 'MARIA GUADALUPE' },
  { carrier_last: 'SELLERS', carrier_first: 'APRIL N', payroll_last: 'SELLSRS', payroll_first: 'APRIL NICOLE' },
  { carrier_last: 'TECH', carrier_first: 'LOURDES JANE', payroll_last: 'TECHT LOURDES', payroll_first: 'LOURDES JANE' },
  { carrier_last: 'VAZQUEZ', carrier_first: 'MARIA G(9994)', payroll_last: 'VAZQVEZ', payroll_first: 'MARIA G' },
  { carrier_last: 'YANG', carrier_first: 'GAOLEE', payroll_last: 'YANGY', payroll_first: 'GAOHLEE' },
];

async function addMappings() {
  const toInsert = mappings.map(m => ({
    carrier_last_name: m.carrier_last.toUpperCase(),
    carrier_first_name: m.carrier_first.toUpperCase(),
    payroll_last_name: m.payroll_last.toUpperCase(),
    payroll_first_name: m.payroll_first.toUpperCase(),
    account_name: 'Ampla Health',
    created_by: 'bulk-import'
  }));

  const { data, error } = await supabase
    .from('mbh_name_mappings')
    .upsert(toInsert, { onConflict: 'carrier_last_name,carrier_first_name,payroll_last_name,payroll_first_name,account_name' })
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`✅ Added ${data.length} mappings`);
  for (const m of data) {
    console.log(`  ${m.carrier_last_name}, ${m.carrier_first_name} -> ${m.payroll_last_name}, ${m.payroll_first_name}`);
  }
}

addMappings();
