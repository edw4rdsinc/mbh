import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://exzeayeoosiabwhgyquq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4emVheWVvb3NpYWJ3aGd5cXVxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mzk3NDcwOSwiZXhwIjoyMDY5NTUwNzA5fQ.Qgwxa5JxhvV05CZhPeG-Ag7FpJiRO3hLaIJxN6k8708'
);

async function check() {
  // Search for Bracamonte/Bracbmontes mappings
  const { data, error } = await supabase
    .from('mbh_name_mappings')
    .select('*')
    .or('carrier_last_name.ilike.%brac%,payroll_last_name.ilike.%brac%')
    .eq('account_name', 'Ampla Health');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Bracamonte/Bracbmontes mappings found:');
  console.log(JSON.stringify(data, null, 2));
}

check();
