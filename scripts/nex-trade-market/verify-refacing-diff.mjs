import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = (() => { const raw = readFileSync('C:/Users/Victus/trades/.env.local','utf8'); const out={}; for (const l of raw.split(/\r?\n/)) { if(!l||l.startsWith('#')) continue; const i=l.indexOf('='); if(i<0) continue; out[l.slice(0,i).trim()]=l.slice(i+1).trim(); } return out; })();
const s = createClient(env.NEXT_PUBLIC_NEX_SUPABASE_URL, env.NEX_SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });

// Baseline (old query · what /nex-app/refacing/companies showed pre-change)
async function count(desc, q) {
  const { count, error } = await q;
  console.log(`${desc}: ${error ? 'ERROR ' + error.message : count}`);
  return count;
}

console.log('\n== OLD query · category="Staircase Refacing" ==');
const oldAll = await count('  All', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('category','Staircase Refacing'));
const oldGB = await count('  UK',  s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('category','Staircase Refacing').eq('country','United Kingdom'));
const oldIE = await count('  IE',  s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('category','Staircase Refacing').eq('country','Ireland'));
const oldUS = await count('  US',  s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('category','Staircase Refacing').eq('country','USA'));

console.log('\n== NEW query (my P0-5 code) · capabilities.refacing=yes only ==');
const newAll = await count('  All', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('capabilities->>refacing','yes'));
const newGB = await count('  UK',  s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('capabilities->>refacing','yes').eq('country','United Kingdom'));
const newIE = await count('  IE',  s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('capabilities->>refacing','yes').eq('country','Ireland'));
const newUS = await count('  US',  s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('capabilities->>refacing','yes').eq('country','USA'));

console.log('\n== NEW query with UNION safety net (recommended per plan) ==');
const orClause = 'capabilities->>refacing.eq.yes,business_type.in.(REFACING_SERVICE_SPECIALIST,REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER)';
const unGB = await count('  UK · UNION', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('country','United Kingdom').or(orClause));
const unIE = await count('  IE · UNION', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('country','Ireland').or(orClause));
const unUS = await count('  US · UNION', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('country','USA').or(orClause));

console.log('\n== Delta table ==');
console.log(`| Country | Old category-only | My P0-5 (capability-only) | UNION (recommended) |`);
console.log(`|---|---:|---:|---:|`);
console.log(`| UK | ${oldGB} | ${newGB} | ${unGB} |`);
console.log(`| IE | ${oldIE} | ${newIE} | ${unIE} |`);
console.log(`| US | ${oldUS} | ${newUS} | ${unUS} |`);
console.log(`| all | ${oldAll} | ${newAll} | ${unGB + unIE + unUS} |`);
console.log(`\n(Old query missed all US · UNION preserves the fallback the plan required)`);

// Look at UK rows that would be lost / gained
console.log('\n== UK rows in OLD but not in NEW (regression risk) ==');
const oldUK = await s.from('directory_seeds').select('slug,business_name,business_type,capabilities').eq('category','Staircase Refacing').eq('country','United Kingdom');
const newUK = await s.from('directory_seeds').select('slug').eq('capabilities->>refacing','yes').eq('country','United Kingdom');
const newSet = new Set((newUK.data ?? []).map(r => r.slug));
const missing = (oldUK.data ?? []).filter(r => !newSet.has(r.slug));
console.log(`  ${missing.length} UK rows in OLD but not in NEW:`);
for (const r of missing.slice(0, 8)) console.log(`    - ${r.business_name} (${r.business_type}) capabilities.refacing=${r.capabilities?.refacing ?? 'unset'}`);
if (missing.length > 8) console.log(`    (+${missing.length - 8} more)`);
