import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://exzeayeoosiabwhgyquq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4emVheWVvb3NpYWJ3aGd5cXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NDcwOSwiZXhwIjoyMDY5NTUwNzA5fQ.Qgwxa5JxhvV05CZhPeG-Ag7FpJiRO3hLaIJxN6k8708'
);

const names = ['BAUGUESS', 'CARRASQUILLO', 'CORTEZ', 'HEDDLESTEN', 'NAVARRO', 'SANDOVAL', 'SELLERS', 'TECH', 'VAZQUEZ', 'YANG', 'LEON', 'GOMEZ'];

async function check() {
  for (const name of names) {
    const { data } = await supabase
      .from('mbh_name_mappings')
      .select('carrier_last_name, carrier_first_name, payroll_last_name, payroll_first_name')
      .eq('account_name', 'Ampla Health')
      .or(`carrier_last_name.ilike.%${name}%,payroll_last_name.ilike.%${name}%`);

    if (data && data.length > 0) {
      console.log(`\n${name}:`);
      for (const m of data) {
        console.log(`  "${m.carrier_last_name}, ${m.carrier_first_name}" -> "${m.payroll_last_name}, ${m.payroll_first_name}"`);
      }
    } else {
      console.log(`\n${name}: NOT FOUND`);
    }
  }
}

check();
