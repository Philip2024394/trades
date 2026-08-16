// UK Staircase Trade Market · Stage 3-IE · Ireland sample deep-verify
//
// Adapted from stage3-sample-verify.mjs (UK). Same 4-state verification
// model, same evidence-extraction rules, same "not evidenced ≠ does not
// provide" discipline.
//
// Ireland-specific stratification per Philip 2026-08-16:
//   · 5 Dublin/Leinster
//   · 4 Munster
//   · 4 Connacht + RoI Ulster
//   · 4 Refurb/refacing specialists (IE-4)
//   · 3 Small-county coverage (1-record counties · to test whether rural
//     coverage gap is discovery-side OR genuinely thin market)
//
// STOP after report. Never contacts companies. Never imports to Supabase.
// Never modifies UK 471.

import { readFile, writeFile } from 'node:fs/promises';

const CONSOLIDATED = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_stage2/stage2-ie-consolidated.json';
const OUT_JSON = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_stage2/stage3-ie-sample-inspection.json';
const OUT_MD = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_stage2/STAGE-3-IE-REPORT-2026-08-16.md';

const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT = 'Mozilla/5.0 (compatible; NEXTradeMarketBot/1.0; +https://thenetworkers.app/nex/about-bot)';

// ─── evidence signal libraries (same as UK) ───

const SIGNALS = {
  manufacture: [
    /\bmanufactur(e|ing|er|es|ed)\b/i,
    /\bstair(case)?\s+mak(er|ers|ing|e)\b/i,
    /\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair/i,
    /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i,
    /\bin-house\s+(manufactur|production|joinery)/i,
    /\bown\s+(workshop|factory|manufacturing)\b/i,
    /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i,
  ],
  installation: [/\binstall(ation|s|ed|ing|er|ers)\b/i, /\bfitting\b/i, /\bfit(ted|ting)\s+by\s+us\b/i, /\bwe\s+fit\b/i, /\bon-site\s+install/i, /\bfully\s+install/i],
  refurbishment: [/\brefurb(ish(ment|ing|ed)?)?\b/i, /\brenovat(e|ing|ed|ion)\b/i, /\brestor(e|ing|ed|ation)\b/i, /\bupgrad(e|ing|ed)\s+(your\s+)?(stair|staircase)/i, /\bmakeover\b/i, /\btransform(ing|ation|ed)?\s+(your\s+)?(stair|staircase)/i, /\bexisting\s+stair(case)?\b/i, /\bmodernis(e|ing|ed|ation)\b/i, /\brepair(s|ing|ed)?\b/i, /\bhandrail(s)?\s+(replac|chang|upgrad|new|swap|updat)/i, /\bspindl(e|es)\s+(replac|chang|upgrad|new|swap|updat)/i],
  refacing: [/\brefac(e|ing|ed)\b/i, /\bstair(case)?\s+(overlay|clad(ding)?|cover(ing)?|resurfac(e|ing))/i, /\bstair(case)?\s+(kit|kits)\b/i, /\boverlay\s+(your\s+)?stair/i, /\bcover\s+(your\s+)?(carpet\s+|existing\s+)?stair/i],
  balustrade: [/\bbalustrad(e|es|ing)\b/i, /\bhandrail\s+system\b/i],
  handrail: [/\bhandrail(s)?\b/i, /\bhand[- ]rail(s)?\b/i],
  glass: [/\bglass\s+(stair|balustrad|panel|infill|handrail)/i, /\bglass\s+staircase/i, /\bframeless\s+glass\b/i],
  metal: [/\bmetal\s+(stair|staircase)/i, /\bsteel\s+(stair|staircase|balustrad)/i, /\b(mild|stainless)\s+steel\b/i, /\bwrought\s+iron\b/i],
  bespoke: [/\bbespoke\b/i, /\bmade[- ]to[- ]measure\b/i, /\bcustom(ised|ized)?\s+(stair|staircase|design)/i],
  design: [/\bdesign(er|ers|ed|s|ing)?\b/i, /\bcad\s+drawings?\b/i, /\b3d\s+(visualisation|render)/i],
  kit_or_product_supplier: [/\bkit(s)?\b/i, /\bself[- ]assembly\b/i, /\bdiy\s+(stair|kit)/i, /\bshop\s+(stair|parts|components)/i, /\bbuy\s+online\b/i, /\badd\s+to\s+(basket|cart)\b/i, /\bfree\s+delivery\b/i, /\bcatalog(ue)?\b/i],
};

const MATERIAL_SIGNALS = ['oak','walnut','ash','pine','beech','maple','sapele','iroko','mahogany','glass','stainless steel','mild steel','wrought iron','concrete','carpet'];

// ─── Ireland-specific stratification ───

function stratifiedSampleIreland(records) {
  const LEINSTER = new Set(['Dublin','Meath','Wicklow','Kildare','Wexford','Kilkenny','Louth','Carlow','Laois','Longford','Offaly','Westmeath']);
  const MUNSTER = new Set(['Cork','Kerry','Limerick','Waterford','Tipperary','Clare']);
  const CONNACHT_ULSTER_ROI = new Set(['Galway','Mayo','Sligo','Leitrim','Roscommon','Donegal','Cavan','Monaghan']);

  const byAgent = (r, needle) => (r._agent || '').includes(needle);
  const inCounty = (r, set) => r.county && set.has(r.county);

  // Count per county for "small-county" pick
  const countyCounts = {};
  for (const r of records) if (r.county) countyCounts[r.county] = (countyCounts[r.county] || 0) + 1;
  const smallCounties = Object.entries(countyCounts).filter(([, n]) => n === 1).map(([c]) => c);

  const pool = {
    dublin_leinster: records.filter(r => inCounty(r, LEINSTER) && byAgent(r, 'ie-1')),
    munster: records.filter(r => inCounty(r, MUNSTER) && byAgent(r, 'ie-2')),
    connacht_roi_ulster: records.filter(r => inCounty(r, CONNACHT_ULSTER_ROI) && byAgent(r, 'ie-3')),
    refurb_refacing: records.filter(r => byAgent(r, 'ie-4') || r.capabilities_claimed?.refacing === true || r.capabilities_claimed?.refurbishment === true),
    small_counties: records.filter(r => r.county && smallCounties.includes(r.county)),
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
  take(pool.dublin_leinster, 5, 'Dublin/Leinster');
  take(pool.munster, 4, 'Munster');
  take(pool.connacht_roi_ulster, 4, 'Connacht+RoI Ulster');
  take(pool.refurb_refacing, 4, 'Refurb/Refacing');
  take(pool.small_counties, 3, 'Small county');

  // Top up from any if we're short
  if (chosen.length < 20) {
    for (const r of records) {
      if (chosen.length >= 20) break;
      if (!chosenNames.has(r.business_name)) { chosen.push({ ...r, _sample_bucket: 'topup' }); chosenNames.add(r.business_name); }
    }
  }
  return chosen.slice(0, 20);
}

// ─── HTTP fetch + evidence extraction (identical to UK Stage 3) ───

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
  const normName = businessName.toLowerCase().replace(/\b(ltd|limited|llp|plc|co|the)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
  const normPage = stripHtml(html).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30000);
  if (normName.length < 4) return false;
  return normPage.includes(normName);
}

function extractEvidenceFromPage(html) {
  const text = stripHtml(html).slice(0, 40000);
  const evidence = {};
  for (const [cap, patterns] of Object.entries(SIGNALS)) {
    let matched = null;
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) { matched = m[0]; break; }
    }
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

function qualityBand(v) {
  if (v === 'FULLY_VERIFIED') return 'A';
  if (v === 'SERVICE_EVIDENCED') return 'B';
  if (v === 'DIRECTLY_REACHABLE') return 'C';
  return 'D';
}

function classifyBusinessGroup(record, pageEvidence) {
  const evOr = (cap) => pageEvidence?.capabilities?.[cap]?.present === true || record.capabilities_claimed?.[cap] === true;
  const has = {
    mfr: evOr('manufacture'), inst: evOr('installation'),
    refurb: evOr('refurbishment'), reface: evOr('refacing'),
    kit: pageEvidence?.capabilities?.kit_or_product_supplier?.present === true,
  };
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
  console.log(`Loaded ${all.length} Irish canonical records`);

  const sample = stratifiedSampleIreland(all);
  console.log(`Selected ${sample.length} for deep-verify (per Philip's stratification):`);
  const bucketCounts = {};
  for (const r of sample) {
    console.log(`  · [${r._sample_bucket}] ${r.business_name} (${r.county}) → ${r.website || '(no url)'}`);
    bucketCounts[r._sample_bucket] = (bucketCounts[r._sample_bucket] || 0) + 1;
  }
  console.log(`Bucket distribution: ${JSON.stringify(bucketCounts)}`);

  const results = [];
  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    const url = (r.website || (r.source_url) || '').trim();
    console.log(`\n[${i + 1}/${sample.length}] ${r.business_name} → ${url || '(no url)'}`);
    if (!url) {
      results.push({ ...r, _stage3ie: { fetch: { ok: false, error: 'no_url' }, verification: 'SEARCH_DISCOVERED', quality_band: 'D', business_group: null, evidence: null, identity_confirmed: false } });
      continue;
    }
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
    results.push({
      ...r,
      _stage3ie: {
        fetch: fetchResult.ok
          ? { ok: true, status: fetchResult.status, final_url: fetchResult.url, content_type: fetchResult.contentType, size_bytes: fetchResult.html?.length ?? 0 }
          : { ok: false, error: fetchResult.error },
        identity_confirmed: identityConfirmed,
        evidence: pageEvidence,
        verification: verif,
        quality_band: qualityBand(verif),
        business_group: group,
      },
    });
  }

  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));

  const agg = {
    inspected: results.length,
    directly_reachable: results.filter(r => r._stage3ie.fetch.ok).length,
    search_only: results.filter(r => !r._stage3ie.fetch.ok).length,
    identity_confirmed: results.filter(r => r._stage3ie.identity_confirmed).length,
    fully_verified: results.filter(r => r._stage3ie.verification === 'FULLY_VERIFIED').length,
    service_evidenced: results.filter(r => r._stage3ie.verification === 'SERVICE_EVIDENCED').length,
    directly_reachable_only: results.filter(r => r._stage3ie.verification === 'DIRECTLY_REACHABLE').length,
    search_discovered_state: results.filter(r => r._stage3ie.verification === 'SEARCH_DISCOVERED').length,
    with_manufacture_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.manufacture?.present).length,
    with_installation_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.installation?.present).length,
    with_refurbishment_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.refurbishment?.present).length,
    with_refacing_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.refacing?.present).length,
    with_balustrade_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.balustrade?.present).length,
    with_handrail_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.handrail?.present).length,
    with_glass_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.glass?.present).length,
    with_metal_evidence: results.filter(r => r._stage3ie.evidence?.capabilities?.metal?.present).length,
    with_kit_product_signal: results.filter(r => r._stage3ie.evidence?.capabilities?.kit_or_product_supplier?.present).length,
    excluded_no_url: results.filter(r => r._stage3ie.fetch.error === 'no_url').length,
    fetch_errors: results.filter(r => !r._stage3ie.fetch.ok && r._stage3ie.fetch.error !== 'no_url').length,
    bucket_verification: {}, // per-bucket verification distribution
    groups: {},
  };
  for (const r of results) {
    const g = r._stage3ie.business_group;
    if (g) agg.groups[g] = (agg.groups[g] || 0) + 1;
    const b = r._sample_bucket;
    agg.bucket_verification[b] = agg.bucket_verification[b] || { FULLY_VERIFIED: 0, SERVICE_EVIDENCED: 0, DIRECTLY_REACHABLE: 0, SEARCH_DISCOVERED: 0 };
    agg.bucket_verification[b][r._stage3ie.verification] = (agg.bucket_verification[b][r._stage3ie.verification] || 0) + 1;
  }

  const md = renderMd(results, agg);
  await writeFile(OUT_MD, md);
  console.log('\n─── AGGREGATE ───');
  console.log(JSON.stringify(agg, null, 2));
  console.log(`\nReport: ${OUT_MD}`);
}

function renderMd(results, agg) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 3-IE · Ireland Sample Deep-Verify`);
  lines.push(``);
  lines.push(`_20-record stratified sample from stage2-ie-consolidated.json · directly fetched · evidence from actual page content · no snippet uplift · 2026-08-16_`);
  lines.push(``);
  lines.push(`## Aggregate (as requested)`);
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
  lines.push(`### Per-bucket verification (tests whether rural gap is discovery-side or market-side)`);
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
  lines.push(`## Per-record detail (all 20)`);
  lines.push(``);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`### ${i + 1}. ${r.business_name}`);
    lines.push(``);
    lines.push(`- **Bucket:** ${r._sample_bucket}`);
    lines.push(`- **Website:** ${r.website || '_(none)_'}`);
    lines.push(`- **County / country:** ${r.county || '—'} · ${r.country || '—'}`);
    lines.push(`- **Fetch:** ${r._stage3ie.fetch.ok ? `HTTP ${r._stage3ie.fetch.status} · ${r._stage3ie.fetch.size_bytes} bytes · ${r._stage3ie.fetch.final_url}` : `ERROR — ${r._stage3ie.fetch.error}`}`);
    lines.push(`- **Identity confirmed on page:** ${r._stage3ie.identity_confirmed}`);
    lines.push(`- **Verification state:** \`${r._stage3ie.verification}\``);
    lines.push(`- **Quality band:** ${r._stage3ie.quality_band}`);
    lines.push(`- **Business group:** \`${r._stage3ie.business_group}\``);
    if (r._stage3ie.evidence) {
      lines.push(`- **Direct page evidence per capability:**`);
      for (const [cap, ev] of Object.entries(r._stage3ie.evidence.capabilities)) {
        if (ev.present) lines.push(`  - ✓ ${cap} — matched: "${(ev.matched_phrase || '').slice(0, 80)}"`);
        else lines.push(`  - ✗ ${cap}`);
      }
      lines.push(`- **Materials mentioned:** ${r._stage3ie.evidence.materials_mentioned.join(', ') || '_(none)_'}`);
    }
    lines.push(`- **Stage 2 claimed capabilities:** ${Object.entries(r.capabilities_claimed || {}).filter(([, v]) => v === true).map(([k]) => k).join(', ') || '_(none)_'}`);
    lines.push(``);
  }
  lines.push(`## What Stage 3-IE did NOT do`);
  lines.push(``);
  lines.push(`- Did not contact any Irish company`);
  lines.push(`- Did not upgrade "verified reachable" · used Philip's 4-state model`);
  lines.push(`- Did not import any records to Supabase`);
  lines.push(`- Did not modify the 471 UK records`);
  lines.push(`- Did not start Stage 4-IE · waiting for approval`);
  lines.push(`- Did not touch NEX brain / M4 freeze`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
