// UK Staircase Trade Market · Stage 3-USA · Ireland sample deep-verify
//
// Adapted from stage3-ie-sample-verify.mjs. Same 4-state verification model,
// same evidence-extraction, same "not evidenced ≠ does not provide" discipline.
//
// US-specific stratification per Philip 2026-08-16:
//   · 2 Northeast (US-1) · ME/NH/VT/MA/RI/CT/NY/NJ/PA
//   · 2 Southeast (US-2) · DE/MD/DC/VA/WV/NC/SC/GA/FL/AL/MS/KY/TN/AR/LA
//   · 2 Midwest (US-3) · OH/IN/IL/MI/WI/MN/IA/MO/KS/NE/ND/SD
//   · 2 Southwest (US-4) · OK/AZ/NM
//   · 2 West (US-5) · WA/OR/ID/MT/WY/CO/UT/NV/AK/HI
//   · 3 California (US-6 dedicated)
//   · 3 Texas (US-7 dedicated)
//   · 2 Refacing/refurbishment (US-8)
//   · 2 Small/low-coverage states (1-record states)
//
// STOP after report. Never contacts companies. Never imports to Supabase.
// Never modifies UK 471 or IE 50.

import { readFile, writeFile } from 'node:fs/promises';

const CONSOLIDATED = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_stage2/stage2-us-consolidated.json';
const OUT_JSON = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_stage2/stage3-us-sample-inspection.json';
const OUT_MD = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_stage2/STAGE-3-US-REPORT-2026-08-16.md';

const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NEXTradeMarketBot/1.0; +https://thenetworkers.app/nex/about-bot)';

// ─── signals (same as UK/IE) ───

const SIGNALS = {
  manufacture: [/\bmanufactur(e|ing|er|es|ed)\b/i, /\bstair(case)?\s+mak(er|ers|ing|e)\b/i, /\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure|handcrafted)\s+stair/i, /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i, /\bin-house\s+(manufactur|production|joinery)/i, /\bown\s+(workshop|factory|manufacturing)\b/i, /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i],
  installation: [/\binstall(ation|s|ed|ing|er|ers)\b/i, /\bfitting\b/i, /\bwe\s+fit\b/i, /\bfully\s+install/i, /\bstair\s+contractor/i],
  refurbishment: [/\brefurb(ish(ment|ing|ed)?)?\b/i, /\brenovat(e|ing|ed|ion)\b/i, /\bremodel(ing|s|ed)?\b/i, /\brestor(e|ing|ed|ation)\b/i, /\bupgrad(e|ing|ed)\s+(your\s+)?(stair|staircase)/i, /\bmakeover\b/i, /\btransform(ing|ation|ed)?\s+(your\s+)?(stair|staircase)/i, /\bexisting\s+stair(case)?\b/i, /\bmodernis(e|ing|ed|ation)\b/i, /\brepair(s|ing|ed)?\b/i],
  refacing: [/\brefac(e|ing|ed)\b/i, /\bstair(case)?\s+(overlay|clad(ding)?|cover(ing)?|resurfac(e|ing)|retread)/i, /\bstair(case)?\s+(kit|kits)\b/i, /\boverlay\s+(your\s+)?stair/i, /\bcover\s+(your\s+)?(carpet\s+|existing\s+)?stair/i, /\bcarpet\s+to\s+wood/i],
  balustrade: [/\bbalustrad(e|es|ing)\b/i, /\brailing(s)?\b/i, /\bhandrail\s+system\b/i],
  handrail: [/\bhandrail(s)?\b/i, /\bhand[- ]rail(s)?\b/i, /\bbanister(s)?\b/i],
  glass: [/\bglass\s+(stair|balustrad|panel|infill|handrail|rail)/i, /\bglass\s+staircase/i, /\bframeless\s+glass\b/i],
  metal: [/\bmetal\s+(stair|staircase)/i, /\b(steel|iron|wrought\s+iron)\s+(stair|staircase|balustrad|rail)/i, /\b(mild|stainless)\s+steel\b/i],
  bespoke: [/\bbespoke\b/i, /\bmade[- ]to[- ]measure\b/i, /\bcustom(ised|ized)?\s+(stair|staircase|design)/i, /\bcustom\s+(stair|design)/i],
  design: [/\bdesign(er|ers|ed|s|ing)?\b/i, /\bcad\s+drawings?\b/i, /\b3d\s+(visualisation|render)/i],
  kit_or_product_supplier: [/\bkit(s)?\b/i, /\bself[- ]assembly\b/i, /\bdiy\s+(stair|kit)/i, /\bshop\s+(stair|parts|components)/i, /\bbuy\s+online\b/i, /\badd\s+to\s+(basket|cart)\b/i, /\bfree\s+shipping\b/i],
};

const MATERIAL_SIGNALS = ['oak','walnut','ash','pine','beech','maple','cherry','mahogany','hickory','birch','poplar','glass','stainless steel','wrought iron','steel','concrete','carpet','tile'];

// ─── US-specific stratification ───

function stratifiedSampleUSA(records) {
  const NORTHEAST = new Set(['ME','NH','VT','MA','RI','CT','NY','NJ','PA']);
  const SOUTHEAST = new Set(['DE','MD','DC','VA','WV','NC','SC','GA','FL','AL','MS','KY','TN','AR','LA']);
  const MIDWEST = new Set(['OH','IN','IL','MI','WI','MN','IA','MO','KS','NE','ND','SD']);
  const SOUTHWEST = new Set(['OK','AZ','NM']);
  const WEST = new Set(['WA','OR','ID','MT','WY','CO','UT','NV','AK','HI']);

  const byAgent = (r, needle) => (r._agent || '').includes(needle);
  const inState = (r, set) => r.state && set.has(r.state);

  // Count per state for "small-state" pick
  const stateCounts = {};
  for (const r of records) if (r.state) stateCounts[r.state] = (stateCounts[r.state] || 0) + 1;
  const smallStates = Object.entries(stateCounts).filter(([, n]) => n === 1).map(([s]) => s);

  const pool = {
    northeast: records.filter(r => inState(r, NORTHEAST) && byAgent(r, 'us-1')),
    southeast: records.filter(r => inState(r, SOUTHEAST) && byAgent(r, 'us-2')),
    midwest: records.filter(r => inState(r, MIDWEST) && byAgent(r, 'us-3')),
    southwest: records.filter(r => inState(r, SOUTHWEST) && byAgent(r, 'us-4')),
    west: records.filter(r => inState(r, WEST) && byAgent(r, 'us-5')),
    california: records.filter(r => r.state === 'CA' && byAgent(r, 'us-6')),
    texas: records.filter(r => r.state === 'TX' && byAgent(r, 'us-7')),
    refacing: records.filter(r => byAgent(r, 'us-8') || r.capabilities_claimed?.refacing === true || r.capabilities_claimed?.refurbishment === true),
    small_states: records.filter(r => r.state && smallStates.includes(r.state)),
  };

  const chosen = [];
  const chosenNames = new Set();
  const take = (bucket, n, label) => {
    let taken = 0;
    for (const r of bucket) {
      if (taken >= n) break;
      if (chosenNames.has(r.business_name)) continue;
      chosen.push({ ...r, _sample_bucket: label });
      chosenNames.add(r.business_name);
      taken++;
    }
  };
  take(pool.northeast, 2, 'Northeast');
  take(pool.southeast, 2, 'Southeast');
  take(pool.midwest, 2, 'Midwest');
  take(pool.southwest, 2, 'Southwest');
  take(pool.west, 2, 'West');
  take(pool.california, 3, 'California');
  take(pool.texas, 3, 'Texas');
  take(pool.refacing, 2, 'Refacing');
  take(pool.small_states, 2, 'Small state');

  if (chosen.length < 20) {
    for (const r of records) { if (chosen.length >= 20) break; if (!chosenNames.has(r.business_name)) { chosen.push({ ...r, _sample_bucket: 'topup' }); chosenNames.add(r.business_name); } }
  }
  return chosen.slice(0, 20);
}

// ─── HTTP fetch + evidence (same as UK/IE) ───

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' }, redirect: 'follow' });
    const text = await r.text();
    return { ok: true, status: r.status, url: r.url, html: text, contentType: r.headers.get('content-type') };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  } finally { clearTimeout(timer); }
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ');
}

function pageIdentityMatches(html, businessName) {
  if (!businessName) return false;
  const normName = businessName.toLowerCase().replace(/\b(ltd|limited|llp|plc|co|inc|llc|the|company|corp|corporation)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
  const normPage = stripHtml(html).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30000);
  if (normName.length < 4) return false;
  return normPage.includes(normName);
}

function extractEvidenceFromPage(html) {
  const text = stripHtml(html).slice(0, 40000);
  const evidence = {};
  for (const [cap, patterns] of Object.entries(SIGNALS)) {
    let matched = null;
    for (const rx of patterns) { const m = text.match(rx); if (m) { matched = m[0]; break; } }
    evidence[cap] = matched ? { present: true, matched_phrase: matched } : { present: false };
  }
  const materialsFound = MATERIAL_SIGNALS.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(text));
  return { capabilities: evidence, materials_mentioned: materialsFound };
}

function verificationState(fetchResult, identityConfirmed, pageEvidence) {
  if (!fetchResult.ok || fetchResult.status < 200 || fetchResult.status >= 400) return 'SEARCH_DISCOVERED';
  if (!identityConfirmed) return 'SEARCH_DISCOVERED';
  const capCount = Object.values(pageEvidence?.capabilities || {}).filter(v => v?.present === true).length;
  if (capCount >= 3) return 'FULLY_VERIFIED';
  if (capCount >= 1) return 'SERVICE_EVIDENCED';
  return 'DIRECTLY_REACHABLE';
}

function qualityBand(v) { return v === 'FULLY_VERIFIED' ? 'A' : v === 'SERVICE_EVIDENCED' ? 'B' : v === 'DIRECTLY_REACHABLE' ? 'C' : 'D'; }

function classifyBusinessGroup(record, pageEvidence) {
  const evOr = (cap) => pageEvidence?.capabilities?.[cap]?.present === true || record.capabilities_claimed?.[cap] === true;
  const has = { mfr: evOr('manufacture'), inst: evOr('installation'), refurb: evOr('refurbishment'), reface: evOr('refacing'), kit: pageEvidence?.capabilities?.kit_or_product_supplier?.present === true };
  const capCount = ['mfr','inst','refurb','reface'].filter(k => has[k]).length;
  if (has.kit && (has.reface || has.refurb)) return 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER';
  if (has.kit && has.mfr && !has.inst) return 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER';
  if (has.reface && !has.mfr && has.inst) return 'REFACING_SERVICE_SPECIALIST';
  if (has.refurb && !has.mfr && has.inst) return 'REFURBISHMENT_SERVICE_SPECIALIST';
  if (capCount >= 3) return 'MULTI_SERVICE_COMPANY';
  if (has.mfr && !has.refurb && !has.reface) return 'STAIRCASE_MANUFACTURER';
  if (has.inst && !has.mfr) return 'STAIRCASE_INSTALLER';
  return 'MULTI_SERVICE_COMPANY';
}

// ─── main ───

async function main() {
  const all = JSON.parse(await readFile(CONSOLIDATED, 'utf8'));
  console.log(`Loaded ${all.length} US canonical records`);

  const sample = stratifiedSampleUSA(all);
  console.log(`Selected ${sample.length} for deep-verify:`);
  const bucketCounts = {};
  for (const r of sample) {
    console.log(`  · [${r._sample_bucket}] ${r.business_name} (${r.state}) → ${r.website || '(no url)'}`);
    bucketCounts[r._sample_bucket] = (bucketCounts[r._sample_bucket] || 0) + 1;
  }
  console.log(`Bucket distribution: ${JSON.stringify(bucketCounts)}`);

  const results = [];
  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    const url = (r.website || (r.source_url) || '').trim();
    console.log(`\n[${i + 1}/${sample.length}] ${r.business_name} → ${url || '(no url)'}`);
    if (!url) { results.push({ ...r, _stage3us: { fetch: { ok: false, error: 'no_url' }, verification: 'SEARCH_DISCOVERED', quality_band: 'D', business_group: null, evidence: null, identity_confirmed: false } }); continue; }
    const fetchResult = await fetchWithTimeout(url.startsWith('http') ? url : 'https://' + url);
    console.log(`  fetch: ${fetchResult.ok ? fetchResult.status : `ERROR ${fetchResult.error}`}`);
    let identityConfirmed = false;
    let pageEvidence = null;
    if (fetchResult.ok && fetchResult.status >= 200 && fetchResult.status < 400) {
      identityConfirmed = pageIdentityMatches(fetchResult.html, r.business_name);
      console.log(`  identity match: ${identityConfirmed}`);
      pageEvidence = extractEvidenceFromPage(fetchResult.html);
      const evCount = Object.values(pageEvidence.capabilities).filter(v => v.present).length;
      console.log(`  capabilities directly evidenced: ${evCount}`);
    }
    const verif = verificationState(fetchResult, identityConfirmed, pageEvidence);
    const group = classifyBusinessGroup(r, pageEvidence);
    console.log(`  → verification=${verif} · group=${group}`);
    results.push({ ...r, _stage3us: { fetch: fetchResult.ok ? { ok: true, status: fetchResult.status, final_url: fetchResult.url, content_type: fetchResult.contentType, size_bytes: fetchResult.html?.length ?? 0 } : { ok: false, error: fetchResult.error }, identity_confirmed: identityConfirmed, evidence: pageEvidence, verification: verif, quality_band: qualityBand(verif), business_group: group } });
  }

  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));

  const agg = {
    inspected: results.length,
    directly_reachable: results.filter(r => r._stage3us.fetch.ok).length,
    search_only: results.filter(r => !r._stage3us.fetch.ok).length,
    identity_confirmed: results.filter(r => r._stage3us.identity_confirmed).length,
    fully_verified: results.filter(r => r._stage3us.verification === 'FULLY_VERIFIED').length,
    service_evidenced: results.filter(r => r._stage3us.verification === 'SERVICE_EVIDENCED').length,
    directly_reachable_only: results.filter(r => r._stage3us.verification === 'DIRECTLY_REACHABLE').length,
    search_discovered_state: results.filter(r => r._stage3us.verification === 'SEARCH_DISCOVERED').length,
    with_manufacture_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.manufacture?.present).length,
    with_installation_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.installation?.present).length,
    with_refurbishment_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.refurbishment?.present).length,
    with_refacing_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.refacing?.present).length,
    with_balustrade_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.balustrade?.present).length,
    with_handrail_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.handrail?.present).length,
    with_glass_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.glass?.present).length,
    with_metal_evidence: results.filter(r => r._stage3us.evidence?.capabilities?.metal?.present).length,
    with_kit_product_signal: results.filter(r => r._stage3us.evidence?.capabilities?.kit_or_product_supplier?.present).length,
    excluded_no_url: results.filter(r => r._stage3us.fetch.error === 'no_url').length,
    fetch_errors: results.filter(r => !r._stage3us.fetch.ok && r._stage3us.fetch.error !== 'no_url').length,
    bucket_verification: {},
    groups: {},
  };
  for (const r of results) {
    const g = r._stage3us.business_group;
    if (g) agg.groups[g] = (agg.groups[g] || 0) + 1;
    const b = r._sample_bucket;
    agg.bucket_verification[b] = agg.bucket_verification[b] || { FULLY_VERIFIED: 0, SERVICE_EVIDENCED: 0, DIRECTLY_REACHABLE: 0, SEARCH_DISCOVERED: 0 };
    agg.bucket_verification[b][r._stage3us.verification] = (agg.bucket_verification[b][r._stage3us.verification] || 0) + 1;
  }

  const md = renderMd(results, agg);
  await writeFile(OUT_MD, md);
  console.log('\n─── AGGREGATE ───');
  console.log(JSON.stringify(agg, null, 2));
  console.log(`\nReport: ${OUT_MD}`);
}

function renderMd(results, agg) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 3-USA · Sample Deep-Verify`);
  lines.push(``);
  lines.push(`_20-record stratified sample from stage2-us-consolidated.json · directly fetched · evidence from actual page content · no snippet uplift · 2026-08-16_`);
  lines.push(``);
  lines.push(`## Aggregate`);
  lines.push(``);
  lines.push(`- Records inspected: ${agg.inspected}`);
  lines.push(`- Directly reachable (HTTP 2xx-3xx): ${agg.directly_reachable}`);
  lines.push(`- Identity confirmed on page: ${agg.identity_confirmed}`);
  lines.push(``);
  lines.push(`### 4-state verification distribution`);
  lines.push(``);
  lines.push(`| State | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| FULLY_VERIFIED | ${agg.fully_verified} |`);
  lines.push(`| SERVICE_EVIDENCED | ${agg.service_evidenced} |`);
  lines.push(`| DIRECTLY_REACHABLE (identity only) | ${agg.directly_reachable_only} |`);
  lines.push(`| SEARCH_DISCOVERED (identity failed / unreachable) | ${agg.search_discovered_state} |`);
  lines.push(``);
  lines.push(`### Per-bucket verification`);
  lines.push(``);
  lines.push(`| Bucket | FULLY_VERIFIED | SERVICE_EVIDENCED | DIRECTLY_REACHABLE | SEARCH_DISCOVERED |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  for (const [b, v] of Object.entries(agg.bucket_verification)) {
    lines.push(`| ${b} | ${v.FULLY_VERIFIED} | ${v.SERVICE_EVIDENCED} | ${v.DIRECTLY_REACHABLE} | ${v.SEARCH_DISCOVERED} |`);
  }
  lines.push(``);
  lines.push(`### Capability direct evidence (of 20)`);
  lines.push(``);
  lines.push(`| Capability | Records with direct page evidence |`);
  lines.push(`|---|---:|`);
  lines.push(`| manufacture | ${agg.with_manufacture_evidence} |`);
  lines.push(`| installation | ${agg.with_installation_evidence} |`);
  lines.push(`| refurbishment | ${agg.with_refurbishment_evidence} |`);
  lines.push(`| refacing | ${agg.with_refacing_evidence} |`);
  lines.push(`| balustrade | ${agg.with_balustrade_evidence} |`);
  lines.push(`| handrail | ${agg.with_handrail_evidence} |`);
  lines.push(`| glass | ${agg.with_glass_evidence} |`);
  lines.push(`| metal | ${agg.with_metal_evidence} |`);
  lines.push(`| kit_or_product_supplier | ${agg.with_kit_product_signal} |`);
  lines.push(``);
  lines.push(`### Business-group classification`);
  lines.push(``);
  lines.push(`| Group | Count |`);
  lines.push(`|---|---:|`);
  for (const [g, n] of Object.entries(agg.groups).sort((a,b) => b[1]-a[1])) lines.push(`| ${g} | ${n} |`);
  lines.push(``);
  lines.push(`### Failure analysis`);
  lines.push(``);
  lines.push(`- Fetch errors: ${agg.fetch_errors}`);
  lines.push(`- No URL: ${agg.excluded_no_url}`);
  lines.push(``);
  lines.push(`## Per-record detail (all 20)`);
  lines.push(``);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### ${i + 1}. ${r.business_name}`);
    lines.push(``);
    lines.push(`- **Bucket:** ${r._sample_bucket}`);
    lines.push(`- **Website:** ${r.website || '_(none)_'}`);
    lines.push(`- **State / country:** ${r.state || '—'} · ${r.country || '—'}`);
    lines.push(`- **Fetch:** ${r._stage3us.fetch.ok ? `HTTP ${r._stage3us.fetch.status} · ${r._stage3us.fetch.size_bytes} bytes · ${r._stage3us.fetch.final_url}` : `ERROR — ${r._stage3us.fetch.error}`}`);
    lines.push(`- **Identity confirmed:** ${r._stage3us.identity_confirmed}`);
    lines.push(`- **Verification:** \`${r._stage3us.verification}\``);
    lines.push(`- **Quality band:** ${r._stage3us.quality_band}`);
    lines.push(`- **Business group:** \`${r._stage3us.business_group}\``);
    if (r._stage3us.evidence) {
      lines.push(`- **Direct page evidence:**`);
      for (const [cap, ev] of Object.entries(r._stage3us.evidence.capabilities)) {
        if (ev.present) lines.push(`  - ✓ ${cap} — "${(ev.matched_phrase || '').slice(0, 80)}"`);
      }
      const evCount = Object.values(r._stage3us.evidence.capabilities).filter(v => v.present).length;
      if (evCount === 0) lines.push(`  - (none directly evidenced)`);
      lines.push(`- **Materials mentioned:** ${r._stage3us.evidence.materials_mentioned.join(', ') || '_(none)_'}`);
    }
    lines.push(`- **Stage 2 claimed:** ${Object.entries(r.capabilities_claimed || {}).filter(([, v]) => v === true).map(([k]) => k).join(', ') || '_(none)_'}`);
    lines.push(``);
  }
  lines.push(`## What Stage 3-USA did NOT do`);
  lines.push(``);
  lines.push(`- Did not contact any US company`);
  lines.push(`- Did not modify UK 471 or IE 50 production records`);
  lines.push(`- Did not import to Supabase`);
  lines.push(`- Did not delete any candidate`);
  lines.push(`- Did not start Stage 4-USA · waiting for approval`);
  lines.push(`- Did not touch NEX brain / M4 freeze`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
