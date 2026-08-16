// UK Staircase Trade Market · Stage 4-IE · Ireland full direct-verify
//
// Adapted from stage4-full-verify.mjs (UK). Same 4-state verification model,
// same evidence-extraction, same "not evidenced ≠ does not provide" discipline.
//
// Ireland-specific changes:
//   · Loads stage2-ie-consolidated.json (87 IE candidates)
//   · Cross-source dedup against live 471 UK Supabase rows (expected near-zero
//     overlap since Ireland is a new country dataset · sanity check only)
//   · Special-attention breakdown by county for Munster (Stage 3-IE flagged low
//     identity-match rate on IE-2's search-only records · Stage 4 direct-fetch
//     gives them the same treatment as every other bucket)
//
// Rules preserved (Philip 2026-08-16):
//   · Never modifies the 471 UK records (read-only cross-check)
//   · Never writes to Supabase directory_seeds
//   · Never contacts any Irish company
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

const STAGE_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_stage2';
const CONSOLIDATED = `${STAGE_DIR}/stage2-ie-consolidated.json`;
const OUT_JSON = `${STAGE_DIR}/stage4-ie-full-verified.json`;
const OUT_DUPS = `${STAGE_DIR}/stage4-ie-cross-source-duplicates.json`;
const OUT_REVIEW = `${STAGE_DIR}/stage4-ie-manual-review-queue.json`;
const OUT_MD = `${STAGE_DIR}/STAGE-4-IE-REPORT-2026-08-16.md`;

const FETCH_TIMEOUT_MS = 15000;
const CONCURRENCY = 8;
const USER_AGENT = 'Mozilla/5.0 (compatible; NEXTradeMarketBot/1.0; +https://thenetworkers.app/nex/about-bot)';

// ─── signal libraries (same as UK Stage 4) ───

const SIGNALS = {
  manufacture: [/\bmanufactur(e|ing|er|es|ed)\b/i, /\bstair(case)?\s+mak(er|ers|ing|e)\b/i, /\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair/i, /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i, /\bin-house\s+(manufactur|production|joinery)/i, /\bown\s+(workshop|factory|manufacturing)\b/i, /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i],
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

const NEGATION_PATTERNS_PER_CAP = {
  refurbishment: [/\bwe\s+(do\s+not|don'?t)\s+(refurb|renovat|restor|repair)/i, /\bnew\s+builds?\s+only\b/i],
  refacing: [/\bwe\s+(do\s+not|don'?t)\s+(refac|overlay|clad)/i],
  installation: [/\bsupply\s+only\b/i, /\bno\s+install(ation)?\s+service/i, /\bwe\s+do\s+not\s+install/i],
  manufacture: [/\bwe\s+do\s+not\s+manufactur/i, /\bwe\s+do\s+not\s+make\s+staircase/i, /\bwe\s+don'?t\s+make\s+staircase/i],
};

const MATERIAL_SIGNALS = ['oak','walnut','ash','pine','beech','maple','sapele','iroko','mahogany','glass','stainless steel','mild steel','wrought iron','concrete','carpet'];

// ─── fetch + evidence ───

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
  const text = stripHtml(html).slice(0, 60000);
  const evidence = {};
  for (const [cap, patterns] of Object.entries(SIGNALS)) {
    let matched = null;
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) { matched = m[0]; break; }
    }
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

// ─── cross-source dedup vs live UK 471 ───

const normName = s => (s || '').toLowerCase().replace(/\b(ltd|limited|llp|plc|co|company|inc|the)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
const normPhone = s => (s || '').replace(/\D/g, '');
const normDomain = url => {
  if (!url) return '';
  try { const u = new URL(url.startsWith('http') ? url : 'https://' + url); return u.hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
};

async function loadUKLiveIndex() {
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('directory_seeds').select('id, slug, business_name, website, telephone, email, postcode, town, country').range(from, from + pageSize - 1);
    if (error) throw new Error(`UK live fetch failed: ${error.message}`);
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

function checkAgainstUK(rec, idx) {
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

// ─── concurrency helper ───

async function pMap(items, fn, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ─── main ───

async function main() {
  const all = JSON.parse(await readFile(CONSOLIDATED, 'utf8'));
  console.log(`Loaded ${all.length} Irish candidates`);

  console.log(`\nLoading live UK 471 for cross-source dedup...`);
  const uk = await loadUKLiveIndex();
  console.log(`  Loaded ${uk.rows.length} UK production rows for cross-check`);

  console.log(`\nFetching all ${all.length} Irish URLs · concurrency=${CONCURRENCY} · timeout=${FETCH_TIMEOUT_MS}ms · ~2-5 min wall time`);
  const t0 = Date.now();

  const results = await pMap(all, async (r, idx) => {
    const url = (r.website || r.source_url || '').trim();
    const label = `[${String(idx + 1).padStart(2, ' ')}/${all.length}] ${r.business_name.slice(0, 48)}`;
    const crossMatches = checkAgainstUK(r, uk.idx);

    if (!url) {
      console.log(`${label} · no URL · SEARCH_DISCOVERED${crossMatches.length ? ' · UK_DUPE' : ''}`);
      return { ...r, _stage4ie: { fetch: { ok: false, error: 'no_url' }, identity_confirmed: false, evidence: null, verification: 'SEARCH_DISCOVERED', quality_band: 'D', business_group: null, uk_cross_matches: crossMatches, is_uk_duplicate: crossMatches.length > 0, capability_comparison: compareCapabilities(r.capabilities_claimed, null, 'SEARCH_DISCOVERED') } };
    }

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
    console.log(`${label} · ${fetchResult.ok ? fetchResult.status : `ERR:${(fetchResult.error||'').slice(0,20)}`} · ${verif} · ${group}${crossMatches.length ? ` · UK_DUPE(${crossMatches[0].signal})` : ''}`);
    return { ...r, _stage4ie: { fetch: fetchResult.ok ? { ok: true, status: fetchResult.status, final_url: fetchResult.url, size_bytes: fetchResult.html?.length ?? 0 } : { ok: false, error: fetchResult.error }, identity_confirmed: identityConfirmed, evidence: pageEvidence, verification: verif, quality_band: qualityBand(verif), business_group: group, uk_cross_matches: crossMatches, is_uk_duplicate: crossMatches.length > 0, capability_comparison: capComparison } };
  }, CONCURRENCY);

  const wallSecs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll ${results.length} fetched in ${wallSecs}s`);

  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));

  const reviewQueue = results.filter(r => r._stage4ie.verification === 'SEARCH_DISCOVERED' || r._stage4ie.verification === 'DIRECTLY_REACHABLE' || r._stage4ie.is_uk_duplicate);
  await writeFile(OUT_REVIEW, JSON.stringify(reviewQueue, null, 2));
  const duplicates = results.filter(r => r._stage4ie.is_uk_duplicate);
  await writeFile(OUT_DUPS, JSON.stringify(duplicates, null, 2));

  // Aggregate
  const agg = {
    total_discovered: results.length,
    directly_reachable: results.filter(r => r._stage4ie.fetch.ok).length,
    fetch_errors: results.filter(r => !r._stage4ie.fetch.ok && r._stage4ie.fetch.error !== 'no_url').length,
    no_url: results.filter(r => r._stage4ie.fetch.error === 'no_url').length,
    identity_confirmed: results.filter(r => r._stage4ie.identity_confirmed).length,
    fully_verified: results.filter(r => r._stage4ie.verification === 'FULLY_VERIFIED').length,
    service_evidenced: results.filter(r => r._stage4ie.verification === 'SERVICE_EVIDENCED').length,
    directly_reachable_only: results.filter(r => r._stage4ie.verification === 'DIRECTLY_REACHABLE').length,
    search_discovered_state: results.filter(r => r._stage4ie.verification === 'SEARCH_DISCOVERED').length,
    manual_review: reviewQueue.length,
    duplicates_vs_uk_471: duplicates.length,
    groups: {},
    capability_direct_evidence: {},
    capability_comparison: {},
    quality_bands: { A: 0, B: 0, C: 0, D: 0 },
    by_county: {},
    verification_by_county: {},
    verification_by_agent: {},
  };
  for (const r of results) {
    agg.groups[r._stage4ie.business_group] = (agg.groups[r._stage4ie.business_group] || 0) + 1;
    agg.quality_bands[r._stage4ie.quality_band] = (agg.quality_bands[r._stage4ie.quality_band] || 0) + 1;
    if (r.county) agg.by_county[r.county] = (agg.by_county[r.county] || 0) + 1;
    if (r._stage4ie.evidence) for (const [cap, ev] of Object.entries(r._stage4ie.evidence.capabilities)) { if (!agg.capability_direct_evidence[cap]) agg.capability_direct_evidence[cap] = 0; if (ev.present) agg.capability_direct_evidence[cap]++; }
    for (const [cap, cmp] of Object.entries(r._stage4ie.capability_comparison)) {
      if (!agg.capability_comparison[cap]) agg.capability_comparison[cap] = { CONFIRMED: 0, NOT_CONFIRMED: 0, CONTRADICTED: 0, NOT_CHECKABLE: 0, NEWLY_EVIDENCED: 0, NOT_CLAIMED_NOT_EVIDENCED: 0 };
      agg.capability_comparison[cap][cmp]++;
    }
    if (r.county) {
      if (!agg.verification_by_county[r.county]) agg.verification_by_county[r.county] = { FULLY_VERIFIED: 0, SERVICE_EVIDENCED: 0, DIRECTLY_REACHABLE: 0, SEARCH_DISCOVERED: 0 };
      agg.verification_by_county[r.county][r._stage4ie.verification] = (agg.verification_by_county[r.county][r._stage4ie.verification] || 0) + 1;
    }
    if (r._agent) {
      if (!agg.verification_by_agent[r._agent]) agg.verification_by_agent[r._agent] = { FULLY_VERIFIED: 0, SERVICE_EVIDENCED: 0, DIRECTLY_REACHABLE: 0, SEARCH_DISCOVERED: 0 };
      agg.verification_by_agent[r._agent][r._stage4ie.verification] = (agg.verification_by_agent[r._agent][r._stage4ie.verification] || 0) + 1;
    }
  }

  const md = renderReport(results, agg, wallSecs);
  await writeFile(OUT_MD, md);
  console.log(`\n─── AGGREGATE ───`);
  console.log(JSON.stringify(agg, null, 2));
  console.log(`\nReport: ${OUT_MD}`);
}

function renderReport(results, agg, wallSecs) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 4-IE · Ireland Full Direct-Verify`);
  lines.push(``);
  lines.push(`_All ${agg.total_discovered} Irish candidates · direct HTTP fetched · evidence from actual page content · cross-checked against live 471 UK production · ${wallSecs}s wall time · 2026-08-16_`);
  lines.push(``);
  lines.push(`## Headline numbers (as requested)`);
  lines.push(``);
  lines.push(`- **TOTAL DISCOVERED:** ${agg.total_discovered}`);
  lines.push(`- **DIRECTLY REACHABLE** (HTTP 2xx-3xx): ${agg.directly_reachable}`);
  lines.push(`- **IDENTITY CONFIRMED** on page: ${agg.identity_confirmed}`);
  lines.push(`- **FULLY VERIFIED** (identity + ≥3 caps directly evidenced): ${agg.fully_verified}`);
  lines.push(`- **SERVICE EVIDENCED** (identity + ≥1 cap): ${agg.service_evidenced}`);
  lines.push(`- **DIRECTLY REACHABLE only** (identity, no caps): ${agg.directly_reachable_only}`);
  lines.push(`- **SEARCH DISCOVERED** (fetch/identity failed · preserved): ${agg.search_discovered_state}`);
  lines.push(`- **MANUAL REVIEW queue:** ${agg.manual_review}`);
  lines.push(`- **DUPLICATES vs UK 471:** ${agg.duplicates_vs_uk_471}`);
  lines.push(`- **Fetch errors:** ${agg.fetch_errors}`);
  lines.push(`- **No URL:** ${agg.no_url}`);
  lines.push(``);
  lines.push(`> Standing rule: "**not evidenced**" ≠ "**does not provide the service**". A page may not mention refacing while the company still does refacing. The 4-state comparison below preserves this distinction.`);
  lines.push(``);
  lines.push(`## Capability comparison · Stage 2 claim → Stage 4 direct evidence`);
  lines.push(``);
  lines.push(`| Capability | CONFIRMED | NOT_CONFIRMED | CONTRADICTED | NOT_CHECKABLE | NEWLY_EVIDENCED |`);
  lines.push(`|---|---:|---:|---:|---:|---:|`);
  for (const cap of ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal']) {
    const c = agg.capability_comparison[cap]; if (!c) continue;
    lines.push(`| ${cap} | ${c.CONFIRMED} | ${c.NOT_CONFIRMED} | ${c.CONTRADICTED} | ${c.NOT_CHECKABLE} | ${c.NEWLY_EVIDENCED} |`);
  }
  lines.push(``);
  lines.push(`## Per-agent verification (answers the Munster question)`);
  lines.push(``);
  lines.push(`| Agent | FULLY_VERIFIED | SERVICE_EVIDENCED | DIRECTLY_REACHABLE | SEARCH_DISCOVERED |`);
  lines.push(`|---|---:|---:|---:|---:|`);
  for (const [a, v] of Object.entries(agg.verification_by_agent)) lines.push(`| ${a} | ${v.FULLY_VERIFIED} | ${v.SERVICE_EVIDENCED} | ${v.DIRECTLY_REACHABLE} | ${v.SEARCH_DISCOVERED} |`);
  lines.push(``);
  lines.push(`## Per-county verification`);
  lines.push(``);
  lines.push(`| County | Total | FULLY_VERIFIED | SEARCH_DISCOVERED |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const [c, v] of Object.entries(agg.verification_by_county).sort((a,b) => (b[1].FULLY_VERIFIED + b[1].SERVICE_EVIDENCED + b[1].SEARCH_DISCOVERED) - (a[1].FULLY_VERIFIED + a[1].SERVICE_EVIDENCED + a[1].SEARCH_DISCOVERED))) {
    const total = (v.FULLY_VERIFIED || 0) + (v.SERVICE_EVIDENCED || 0) + (v.DIRECTLY_REACHABLE || 0) + (v.SEARCH_DISCOVERED || 0);
    lines.push(`| ${c} | ${total} | ${v.FULLY_VERIFIED} | ${v.SEARCH_DISCOVERED} |`);
  }
  lines.push(``);
  lines.push(`## Business-group classification`);
  lines.push(``);
  lines.push(`| Group | Count |`);
  lines.push(`|---|---:|`);
  for (const [g, n] of Object.entries(agg.groups).sort((a,b) => b[1]-a[1])) lines.push(`| ${g} | ${n} |`);
  lines.push(``);
  lines.push(`## Quality bands`);
  lines.push(``);
  lines.push(`| Band | Verification state | Count |`);
  lines.push(`|---|---|---:|`);
  lines.push(`| A | FULLY_VERIFIED | ${agg.quality_bands.A} |`);
  lines.push(`| B | SERVICE_EVIDENCED | ${agg.quality_bands.B} |`);
  lines.push(`| C | DIRECTLY_REACHABLE (identity only) | ${agg.quality_bands.C} |`);
  lines.push(`| D | SEARCH_DISCOVERED | ${agg.quality_bands.D} |`);
  lines.push(``);
  lines.push(`## Cross-source dedup vs live UK 471`);
  lines.push(``);
  lines.push(`${agg.duplicates_vs_uk_471} Irish candidates matched a UK production row. ${agg.duplicates_vs_uk_471 === 0 ? 'Clean · Ireland is a genuinely new country dataset.' : 'These need human review · possible edge cases (UK-based company serving Ireland, Northern Ireland leakage, cross-border operator).'} Preserved in \`stage4-ie-cross-source-duplicates.json\`.`);
  if (agg.duplicates_vs_uk_471 > 0) {
    lines.push(``);
    lines.push(`| Ireland candidate | Match | UK match |`);
    lines.push(`|---|---|---|`);
    for (const r of results) {
      if (!r._stage4ie.is_uk_duplicate) continue;
      const m = r._stage4ie.uk_cross_matches[0];
      lines.push(`| ${r.business_name} (${r.county}) | ${m.signal} | ${m.other.business_name} (${m.other.slug}) |`);
    }
  }
  lines.push(``);
  lines.push(`## Manual review queue`);
  lines.push(``);
  lines.push(`- SEARCH_DISCOVERED: ${agg.search_discovered_state}`);
  lines.push(`- DIRECTLY_REACHABLE only: ${agg.directly_reachable_only}`);
  lines.push(`- UK cross-source duplicates: ${agg.duplicates_vs_uk_471}`);
  lines.push(`- Total: ${agg.manual_review} · preserved in \`stage4-ie-manual-review-queue.json\` (NOT auto-imported)`);
  lines.push(``);
  lines.push(`## What Stage 4-IE did NOT do`);
  lines.push(``);
  lines.push(`- Did NOT modify any UK 471 record (read-only cross-check)`);
  lines.push(`- Did NOT write to Supabase directory_seeds`);
  lines.push(`- Did NOT contact any Irish company`);
  lines.push(`- Did NOT delete any identity-failure record`);
  lines.push(`- Did NOT flip any Stage 2 capability claim to false based on absence of evidence`);
  lines.push(`- Did NOT touch NEX brain / M4 freeze`);
  lines.push(`- Did NOT start Stage 5-IE · blocked pending Philip's review`);
  return lines.join('\n');
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
