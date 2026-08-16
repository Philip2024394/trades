import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = (() => { const raw = readFileSync('C:/Users/Victus/trades/.env.local','utf8'); const out={}; for (const l of raw.split(/\r?\n/)) { if(!l||l.startsWith('#')) continue; const i=l.indexOf('='); if(i<0) continue; out[l.slice(0,i).trim()]=l.slice(i+1).trim(); } return out; })();
const s = createClient(env.NEXT_PUBLIC_NEX_SUPABASE_URL, env.NEX_SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false,autoRefreshToken:false} });

// Simulate the NEW WHERE clause exactly as it will run
const orClause = 'capabilities->>refacing.eq.yes,business_type.in.(REFACING_SERVICE_SPECIALIST,REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER),category.eq.Staircase Refacing';
async function count(desc, q) { const { count, error } = await q; console.log(`${desc}: ${error ? 'ERR '+error.message : count}`); return count; }
console.log('\n== Post-fix refacing (capability OR business_type OR category safety-net) ==');
await count('All', s.from('directory_seeds').select('*',{count:'exact',head:true}).or(orClause));
const gb = await count('UK', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('country','United Kingdom').or(orClause));
const ie = await count('IE', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('country','Ireland').or(orClause));
const us = await count('US', s.from('directory_seeds').select('*',{count:'exact',head:true}).eq('country','USA').or(orClause));
console.log(`\nSum per-country: ${gb + ie + us}`);
console.log(`\nBaselines: OLD UK=101 IE=5 US=30 · Sample must be >= those numbers per country.`);
console.log(`UK regressed? ${gb < 101 ? 'YES · '+ (101-gb) : 'NO'}`);
console.log(`IE regressed? ${ie < 5 ? 'YES · ' + (5-ie) : 'NO'}`);
console.log(`US regressed? ${us < 30 ? 'YES · ' + (30-us) : 'NO'} (should GAIN — was under-showing)`);
