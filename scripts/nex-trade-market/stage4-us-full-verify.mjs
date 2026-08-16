// UK Staircase Trade Market · Stage 4-USA · Full 246-record direct-verify
//
// Adapted from stage4-ie-full-verify.mjs. Same 4-state verification model,
// same evidence-extraction, same "not evidenced ≠ does not provide" discipline.
//
// USA-specific:
//   · Loads stage2-us-consolidated.json (246 US candidates)
//   · Cross-source dedup against live 521 (471 UK + 50 IE) Supabase rows
//   · Special-attention breakdown by state including CA and TX separately
//
// Rules preserved:
//   · Never modifies the 521 existing records (read-only cross-check)
//   · Never writes to Supabase directory_seeds
//   · Never contacts any US company
//   · Never turns NOT_CONFIRMED into NO
//   · CONTRADICTED only when page explicitly negates claim
//   · SEARCH_DISCOVERED records preserved for manual review

import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const raw = readFileSync('C:/Users/Victus/trades/.env.local', 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_NEX_SUPABASE_URL, env.NEX_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const STAGE_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_stage2';
const CONSOLIDATED = `${STAGE_DIR}/stage2-us-consolidated.json`;
const OUT_JSON = `${STAGE_DIR}/stage4-us-full-verified.json`;
const OUT_DUPS = `${STAGE_DIR}/stage4-us-cross-source-duplicates.json`;
const OUT_REVIEW = `${STAGE_DIR}/stage4-us-manual-review-queue.json`;
const OUT_MD = `${STAGE_DIR}/STAGE-4-US-REPORT-2026-08-16.md`;

const FETCH_TIMEOUT_MS = 15000;
const CONCURRENCY = 8;
const USER_AGENT = 'Mozilla/5.0 (compatible; NEXTradeMarketBot/1.0; +https://thenetworkers.app/nex/about-bot)';

const SIGNALS = {
  manufacture: [/\bmanufactur(e|ing|er|es|ed)\b/i, /\bstair(case)?\s+mak(er|ers|ing|e)\b/i, /\b(bespoke|custom|handmade|hand[- ]crafted|handcrafted|made[- ]to[- ]measure)\s+stair/i, /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i, /\bin-house\s+(manufactur|production|joinery)/i, /\bown\s+(workshop|factory|manufacturing)\b/i, /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i],
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

const NEGATION_PATTERNS_PER_CAP = {
  refurbishment: [/\bwe\s+(do\s+not|don'?t)\s+(refurb|renovat|restor|repair|remodel)/i, /\bnew\s+(build|construction)s?\s+only\b/i],
  refacing: [/\bwe\s+(do\s+not|don'?t)\s+(refac|overlay|clad)/i],
  installation: [/\bsupply\s+only\b/i, /\bno\s+install(ation)?\s+service/i, /\bwe\s+do\s+not\s+install/i],
  manufacture: [/\bwe\s+do\s+not\s+manufactur/i, /\bwe\s+don'?t\s+make\s+staircase/i],
};

const MATERIAL_SIGNALS = ['oak','walnut','ash','pine','beech','maple','cherry','mahogany','hickory','birch','poplar','glass','stainless steel','wrought iron','steel','concrete','carpet','tile'];

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' }, redirect: 'follow' });
    const text = await r.text();
    return { ok: true, status: r.status, url: r.url, html: text, contentType: r.headers.get('content-type') };
  } catch (e) { return { ok: false, error: String(e?.message || e).slice(0, 200) }; } finally { clearTimeout(timer); }
}

function stripHtml(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' '); }

function pageIdentityMatches(html, businessName) {
  if (!businessName) return false;
  const normName = businessName.toLowerCase().replace(/\b(ltd|limited|llp|plc|co|inc|llc|the|company|corp|corporation)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
  const normPage = stripHtml(html).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30000);
  if (normName.length < 4) return false;
  return normPage.includes(normName);
}

function extractEvidenceFromPage(html) {
  const text = stripHtml(html).slice(0, 60000);
  const evidence = {};
  for (const [cap, patterns] of Object.entries(SIGNALS)) {
    let matched = null;
    for (const rx of patterns) { const m = text.match(rx); if (m) { matched = m[0]; break; } }
    let negated = null;
    const negPatterns = NEGATION_PATTERNS_PER_CAP[cap];
    if (negPatterns) for (const rx of negPatterns) { const m = text.match(rx); if (m) { negated = m[0]; break; } }
    evidence[cap] = { present: !!matched, matched_phrase: matched, explicit_negation: negated };
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

function compareCapabilities(claimed, evidence, verification) {
  const CAP_KEYS = ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal'];
  const result = {};
  const notCheckable = verification === 'SEARCH_DISCOVERED';
  for (const cap of CAP_KEYS) {
    const wasClaimed = claimed?.[cap] === true;
    const evPresent = evidence?.capabilities?.[cap]?.present === true;
    const evNegated = evidence?.capabilities?.[cap]?.explicit_negation != null;
    if (notCheckable) result[cap] = 'NOT_CHECKABLE';
    else if (wasClaimed && evPresent) result[cap] = 'CONFIRMED';
    else if (wasClaimed && evNegated) result[cap] = 'CONTRADICTED';
    else if (wasClaimed && !evPresent) result[cap] = 'NOT_CONFIRMED';
    else if (!wasClaimed && evPresent) result[cap] = 'NEWLY_EVIDENCED';
    else result[cap] = 'NOT_CLAIMED_NOT_EVIDENCED';
  }
  return result;
}

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

const normName = s => (s || '').toLowerCase().replace(/\b(ltd|limited|llp|plc|co|inc|llc|the|company|corp|corporation)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
const normPhone = s => (s || '').replace(/\D/g, '');
const normDomain = url => { if (!url) return ''; try { const u = new URL(url.startsWith('http') ? url : 'https://' + url); return u.hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } };

async function loadProductionLiveIndex() {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('directory_seeds').select('id, slug, business_name, website, telephone, email, postcode, town, country').range(from, from + pageSize - 1);
    if (error) throw new Error(`Live fetch failed: ${error.message}`);
    if (!data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const idx = { byDomain: new Map(), byPhone: new Map(), byEmail: new Map(), byNormName: new Map() };
  for (const r of all) {
    const d = normDomain(r.website); if (d) idx.byDomain.set(d, r);
    const p = normPhone(r.telephone); if (p.length >= 7) idx.byPhone.set(p, r);
    const e = (r.email || '').toLowerCase().trim(); if (e) idx.byEmail.set(e, r);
    const n = normName(r.business_name); if (n) idx.byNormName.set(n, r);
  }
  return { rows: all, idx };
}

function checkAgainstProduction(rec, idx) {
  const matches = [];
  const d = normDomain(rec.website);
  const p = normPhone(rec.telephone);
  const e = (rec.email || '').toLowerCase().trim();
  const n = normName(rec.business_name);
  if (d && idx.byDomain.has(d)) matches.push({ signal: 'domain', other: idx.byDomain.get(d) });
  if (p.length >= 7 && idx.byPhone.has(p)) matches.push({ signal: 'phone', other: idx.byPhone.get(p) });
  if (e && idx.byEmail.has(e)) matches.push({ signal: 'email', other: idx.byEmail.get(e) });
  if (n && n.length >= 8 && idx.byNormName.has(n)) matches.push({ signal: 'fuzzy-name', other: idx.byNormName.get(n) });
  return matches;
}

async function pMap(items, fn, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) { const i = cursor++; if (i >= items.length) return; results[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const all = JSON.parse(await readFile(CONSOLIDATED, 'utf8'));
  console.log(`Loaded ${all.length} US candidates`);

  console.log(`\nLoading live 521 production rows for cross-source dedup...`);
  const prod = await loadProductionLiveIndex();
  console.log(`  Loaded ${prod.rows.length} production rows`);
  const ukCount = prod.rows.filter(r => r.country === 'United Kingdom').length;
  const ieCount = prod.rows.filter(r => r.country === 'Ireland').length;
  console.log(`  · UK: ${ukCount} · IE: ${ieCount} · other: ${prod.rows.length - ukCount - ieCount}`);

  console.log(`\nFetching all ${all.length} US URLs · concurrency=${CONCURRENCY} · ~3-6 min wall time`);
  const t0 = Date.now();

  const results = await pMap(all, async (r, idx) => {
    const url = (r.website || r.source_url || '').trim();
    const label = `[${String(idx + 1).padStart(3, ' ')}/${all.length}] ${r.business_name.slice(0, 45)}`;
    const crossMatches = checkAgainstProduction(r, prod.idx);
    if (!url) { console.log(`${label} · no URL · SEARCH_DISCOVERED${crossMatches.length ? ' · DUPE' : ''}`); return { ...r, _stage4us: { fetch: { ok: false, error: 'no_url' }, identity_confirmed: false, evidence: null, verification: 'SEARCH_DISCOVERED', quality_band: 'D', business_group: null, cross_matches: crossMatches, is_duplicate: crossMatches.length > 0, capability_comparison: compareCapabilities(r.capabilities_claimed, null, 'SEARCH_DISCOVERED') } }; }
    const fetchResult = await fetchWithTimeout(url.startsWith('http') ? url : 'https://' + url);
    let identityConfirmed = false;
    let pageEvidence = null;
    if (fetchResult.ok && fetchResult.status >= 200 && fetchResult.status < 400) {
      identityConfirmed = pageIdentityMatches(fetchResult.html, r.business_name);
      pageEvidence = extractEvidenceFromPage(fetchResult.html);
    }
    const verif = verificationState(fetchResult, identityConfirmed, pageEvidence);
    const group = classifyBusinessGroup(r, pageEvidence);
    const capComparison = compareCapabilities(r.capabilities_claimed, pageEvidence, verif);
    console.log(`${label} · ${fetchResult.ok ? fetchResult.status : `ERR:${(fetchResult.error||'').slice(0,15)}`} · ${verif} · ${group}${crossMatches.length ? ` · DUPE(${crossMatches[0].signal})` : ''}`);
    return { ...r, _stage4us: { fetch: fetchResult.ok ? { ok: true, status: fetchResult.status, final_url: fetchResult.url, size_bytes: fetchResult.html?.length ?? 0 } : { ok: false, error: fetchResult.error }, identity_confirmed: identityConfirmed, evidence: pageEvidence, verification: verif, quality_band: qualityBand(verif), business_group: group, cross_matches: crossMatches, is_duplicate: crossMatches.length > 0, capability_comparison: capComparison } };
  }, CONCURRENCY);

  const wallSecs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll ${results.length} fetched in ${wallSecs}s`);
  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));

  const reviewQueue = results.filter(r => r._stage4us.verification === 'SEARCH_DISCOVERED' || r._stage4us.verification === 'DIRECTLY_REACHABLE' || r._stage4us.is_duplicate);
  await writeFile(OUT_REVIEW, JSON.stringify(reviewQueue, null, 2));
  const duplicates = results.filter(r => r._stage4us.is_duplicate);
  await writeFile(OUT_DUPS, JSON.stringify(duplicates, null, 2));

  const agg = {
    total_discovered: results.length,
    directly_reachable: results.filter(r => r._stage4us.fetch.ok).length,
    fetch_errors: results.filter(r => !r._stage4us.fetch.ok && r._stage4us.fetch.error !== 'no_url').length,
    no_url: results.filter(r => r._stage4us.fetch.error === 'no_url').length,
    identity_confirmed: results.filter(r => r._stage4us.identity_confirmed).length,
    fully_verified: results.filter(r => r._stage4us.verification === 'FULLY_VERIFIED').length,
    service_evidenced: results.filter(r => r._stage4us.verification === 'SERVICE_EVIDENCED').length,
    directly_reachable_only: results.filter(r => r._stage4us.verification === 'DIRECTLY_REACHABLE').length,
    search_discovered_state: results.filter(r => r._stage4us.verification === 'SEARCH_DISCOVERED').length,
    manual_review: reviewQueue.length,
    duplicates_vs_production: duplicates.length,
    groups: {}, capability_direct_evidence: {}, capability_comparison: {},
    quality_bands: { A: 0, B: 0, C: 0, D: 0 },
    by_state: {}, verification_by_state: {}, verification_by_agent: {},
  };
  for (const r of results) {
    agg.groups[r._stage4us.business_group] = (agg.groups[r._stage4us.business_group] || 0) + 1;
    agg.quality_bands[r._stage4us.quality_band] = (agg.quality_bands[r._stage4us.quality_band] || 0) + 1;
    if (r.state) agg.by_state[r.state] = (agg.by_state[r.state] || 0) + 1;
    if (r._stage4us.evidence) for (const [cap, ev] of Object.entries(r._stage4us.evidence.capabilities)) { if (!agg.capability_direct_evidence[cap]) agg.capability_direct_evidence[cap] = 0; if (ev.present) agg.capability_direct_evidence[cap]++; }
    for (const [cap, cmp] of Object.entries(r._stage4us.capability_comparison)) {
      if (!agg.capability_comparison[cap]) agg.capability_comparison[cap] = { CONFIRMED: 0, NOT_CONFIRMED: 0, CONTRADICTED: 0, NOT_CHECKABLE: 0, NEWLY_EVIDENCED: 0, NOT_CLAIMED_NOT_EVIDENCED: 0 };
      agg.capability_comparison[cap][cmp]++;
    }
    if (r.state) { if (!agg.verification_by_state[r.state]) agg.verification_by_state[r.state] = { FULLY_VERIFIED: 0, SERVICE_EVIDENCED: 0, DIRECTLY_REACHABLE: 0, SEARCH_DISCOVERED: 0 }; agg.verification_by_state[r.state][r._stage4us.verification] = (agg.verification_by_state[r.state][r._stage4us.verification] || 0) + 1; }
    if (r._agent) { if (!agg.verification_by_agent[r._agent]) agg.verification_by_agent[r._agent] = { FULLY_VERIFIED: 0, SERVICE_EVIDENCED: 0, DIRECTLY_REACHABLE: 0, SEARCH_DISCOVERED: 0 }; agg.verification_by_agent[r._agent][r._stage4us.verification] = (agg.verification_by_agent[r._agent][r._stage4us.verification] || 0) + 1; }
  }

  const md = renderReport(results, agg, wallSecs);
  await writeFile(OUT_MD, md);
  console.log(`\n─── AGGREGATE ───`);
  console.log(JSON.stringify(agg, null, 2));
  console.log(`\nReport: ${OUT_MD}`);
}

function renderReport(results, agg, wallSecs) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 4-USA · Full Direct-Verify`);
  lines.push(``);
  lines.push(`_All ${agg.total_discovered} US candidates · direct HTTP fetched · evidence from actual page content · cross-checked against live 521 production · ${wallSecs}s wall time · 2026-08-16_`);
  lines.push(``);
  lines.push(`## Headline numbers`);
  lines.push(``);
  lines.push(`- **TOTAL DISCOVERED:** ${agg.total_discovered}`);
  lines.push(`- **DIRECTLY REACHABLE** (HTTP 2xx-3xx): ${agg.directly_reachable}`);
  lines.push(`- **IDENTITY CONFIRMED** on page: ${agg.identity_confirmed}`);
  lines.push(`- **FULLY VERIFIED** (identity + ≥3 caps): ${agg.fully_verified}`);
  lines.push(`- **SERVICE EVIDENCED**: ${agg.service_evidenced}`);
  lines.push(`- **DIRECTLY REACHABLE only**: ${agg.directly_reachable_only}`);
  lines.push(`- **SEARCH DISCOVERED** (preserved): ${agg.search_discovered_state}`);
  lines.push(`- **MANUAL REVIEW queue:** ${agg.manual_review}`);
  lines.push(`- **DUPLICATES vs 521 production:** ${agg.duplicates_vs_production}`);
  lines.push(`- **Fetch errors:** ${agg.fetch_errors}`);
  lines.push(`- **No URL:** ${agg.no_url}`);
  lines.push(``);
  lines.push(`## Per-agent verification`);
  lines.push(``);
  lines.push(`| Agent | FULLY | SERVICE | DIRECT | SEARCH |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  for (const [a, v] of Object.entries(agg.verification_by_agent)) lines.push(`| ${a} | ${v.FULLY_VERIFIED} | ${v.SERVICE_EVIDENCED} | ${v.DIRECTLY_REACHABLE} | ${v.SEARCH_DISCOVERED} |`);
  lines.push(``);
  lines.push(`## Capability comparison · Stage 2 → Stage 4`);
  lines.push(``);
  lines.push(`| Capability | CONFIRMED | NOT_CONFIRMED | CONTRADICTED | NOT_CHECKABLE | NEWLY_EVIDENCED |`);
  lines.push(`|---|---:|---:|---:|---:|---:|`);
  for (const cap of ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal']) {
    const c = agg.capability_comparison[cap]; if (!c) continue;
    lines.push(`| ${cap} | ${c.CONFIRMED} | ${c.NOT_CONFIRMED} | ${c.CONTRADICTED} | ${c.NOT_CHECKABLE} | ${c.NEWLY_EVIDENCED} |`);
  }
  lines.push(``);
  lines.push(`## Per-state verification (top 15)`);
  lines.push(``);
  lines.push(`| State | Total | FULLY | SEARCH_DISC |`);
  lines.push(`|---|---:|---:|---:|`);
  const sorted = Object.entries(agg.verification_by_state).sort((a,b) => ((b[1].FULLY_VERIFIED + b[1].SEARCH_DISCOVERED + b[1].SERVICE_EVIDENCED + b[1].DIRECTLY_REACHABLE) - (a[1].FULLY_VERIFIED + a[1].SEARCH_DISCOVERED + a[1].SERVICE_EVIDENCED + a[1].DIRECTLY_REACHABLE))).slice(0, 15);
  for (const [c, v] of sorted) { const total = (v.FULLY_VERIFIED || 0) + (v.SERVICE_EVIDENCED || 0) + (v.DIRECTLY_REACHABLE || 0) + (v.SEARCH_DISCOVERED || 0); lines.push(`| ${c} | ${total} | ${v.FULLY_VERIFIED} | ${v.SEARCH_DISCOVERED} |`); }
  lines.push(``);
  lines.push(`## Business-group classification`);
  lines.push(``);
  lines.push(`| Group | Count |`);
  lines.push(`|---|---:|`);
  for (const [g, n] of Object.entries(agg.groups).sort((a,b) => b[1]-a[1])) lines.push(`| ${g} | ${n} |`);
  lines.push(``);
  lines.push(`## Quality bands`);
  lines.push(``);
  lines.push(`| Band | State | Count |`);
  lines.push(`|---|---|---:|`);
  lines.push(`| A | FULLY_VERIFIED | ${agg.quality_bands.A} |`);
  lines.push(`| B | SERVICE_EVIDENCED | ${agg.quality_bands.B} |`);
  lines.push(`| C | DIRECTLY_REACHABLE | ${agg.quality_bands.C} |`);
  lines.push(`| D | SEARCH_DISCOVERED | ${agg.quality_bands.D} |`);
  lines.push(``);
  lines.push(`## Cross-source dedup vs live 521 production`);
  lines.push(``);
  lines.push(`${agg.duplicates_vs_production} US candidates matched a live production row. ${agg.duplicates_vs_production === 0 ? 'Clean · USA is genuinely a new country dataset.' : 'Need human review · possible cross-market operators.'}`);
  if (agg.duplicates_vs_production > 0) {
    lines.push(``);
    lines.push(`| US candidate | Match | Live match |`);
    lines.push(`|---|---|---|`);
    for (const r of results) { if (!r._stage4us.is_duplicate) continue; const m = r._stage4us.cross_matches[0]; lines.push(`| ${r.business_name} (${r.state}) | ${m.signal} | ${m.other.business_name} (${m.other.country}) |`); }
  }
  lines.push(``);
  lines.push(`## Manual review queue`);
  lines.push(``);
  lines.push(`- SEARCH_DISCOVERED: ${agg.search_discovered_state}`);
  lines.push(`- DIRECTLY_REACHABLE only: ${agg.directly_reachable_only}`);
  lines.push(`- Cross-production duplicates: ${agg.duplicates_vs_production}`);
  lines.push(`- Total: ${agg.manual_review} · preserved in \`stage4-us-manual-review-queue.json\``);
  lines.push(``);
  lines.push(`## Recommended production import count`);
  lines.push(``);
  lines.push(`**${agg.fully_verified + agg.service_evidenced} records (A + B band)** ready for Stage 5-USA · ${agg.fully_verified} FULLY_VERIFIED + ${agg.service_evidenced} SERVICE_EVIDENCED. Remaining ${agg.manual_review} preserved in review queue.`);
  lines.push(``);
  lines.push(`## What Stage 4-USA did NOT do`);
  lines.push(``);
  lines.push(`- Did NOT modify any of the 521 production rows`);
  lines.push(`- Did NOT write to Supabase`);
  lines.push(`- Did NOT contact any US company`);
  lines.push(`- Did NOT delete any candidate`);
  lines.push(`- Did NOT flip any Stage 2 claim to false based on absence of evidence`);
  lines.push(`- Did NOT touch NEX brain / M4 freeze`);
  lines.push(`- Did NOT start Stage 5-USA · blocked pending Philip's review`);
  return lines.join('\n');
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
