import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = (() => {
  const raw = readFileSync('C:/Users/Victus/trades/.env.local', 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
})();

const supabase = createClient(env.NEXT_PUBLIC_NEX_SUPABASE_URL, env.NEX_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function count(desc, q) {
  const { count, error } = await q;
  if (error) console.log(`${desc}: ERROR ${error.message}`);
  else console.log(`${desc}: ${count}`);
  return count;
}

console.log('\n== Live directory_seeds — country counts ==');
await count('All countries', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }));
await count('country=United Kingdom', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'United Kingdom'));
await count('country=Ireland', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'Ireland'));
await count('country=USA', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'USA'));

console.log('\n== Refacing capability (capabilities->>refacing = yes) ==');
await count('All countries · capabilities.refacing=yes', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('capabilities->>refacing', 'yes'));
await count('USA · capabilities.refacing=yes', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'USA').eq('capabilities->>refacing', 'yes'));
await count('UK · capabilities.refacing=yes', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'United Kingdom').eq('capabilities->>refacing', 'yes'));
await count('Ireland · capabilities.refacing=yes', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'Ireland').eq('capabilities->>refacing', 'yes'));

console.log('\n== Refacing surface UNION (capability OR refacing-typed business_type) ==');
await count('UK · UNION', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'United Kingdom').or('capabilities->>refacing.eq.yes,business_type.in.(REFACING_SERVICE_SPECIALIST,REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER)'));
await count('USA · UNION', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'USA').or('capabilities->>refacing.eq.yes,business_type.in.(REFACING_SERVICE_SPECIALIST,REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER)'));
await count('Ireland · UNION', supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'Ireland').or('capabilities->>refacing.eq.yes,business_type.in.(REFACING_SERVICE_SPECIALIST,REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER)'));

console.log('\n== UK contamination check · USA rows must have country=USA only ==');
const { data: usSample } = await supabase.from('directory_seeds').select('country').eq('country', 'USA').limit(1000);
const countries = new Set((usSample ?? []).map(r => r.country));
console.log(`Sampled ${usSample?.length ?? 0} rows via .eq('country', 'USA') · distinct countries returned: ${JSON.stringify([...countries])}`);

console.log('\n== Region shapes per country (spot-check) ==');
for (const c of ['United Kingdom', 'Ireland', 'USA']) {
  const { data } = await supabase.from('directory_seeds').select('region').eq('country', c).not('region', 'is', null).limit(30);
  const distinct = [...new Set((data ?? []).map(r => r.region))].sort();
  console.log(`  ${c} regions (${distinct.length} distinct in first 30): ${distinct.slice(0, 12).join(' · ')}${distinct.length > 12 ? ' …' : ''}`);
}
