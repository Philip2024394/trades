// UK Staircase Trade Market · Stage 4 · full 311 direct-verify + cross-source dedup
//
// For every canonical Stage 2 record:
//   1. Direct HTTP fetch (concurrency = 8)
//   2. Identity check against page HTML
//   3. Per-capability evidence extraction from actual page content
//   4. Capability comparison: Stage 2 claim → Stage 4 direct evidence
//        CONFIRMED · NOT_CONFIRMED · CONTRADICTED · NOT_CHECKABLE
//      (NOT_CONFIRMED does NOT mean "does not provide" — it means "not evidenced on this page")
//   5. Cross-source deduplication vs existing 5 refacing seeds + 223 legacy seeds
//
// Rules (Philip 2026-08-15):
//   · SEARCH_DISCOVERED records preserved for manual review — never auto-deleted
//   · "not evidenced" ≠ "does not provide" — never flip claimed capability to false
//   · No Supabase writes · staging only · dry-run before promotion
//   · No contact · Stage 5 blocked pending sign-off

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const STAGE_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_stage2';
const CONSOLIDATED = join(STAGE_DIR, 'stage2-consolidated.json');
const OUT_JSON = join(STAGE_DIR, 'stage4-full-verified.json');
const OUT_DUPS = join(STAGE_DIR, 'stage4-cross-source-duplicates.json');
const OUT_REVIEW = join(STAGE_DIR, 'stage4-manual-review-queue.json');
const OUT_MD = join(STAGE_DIR, 'STAGE-4-REPORT-2026-08-15.md');

const EXISTING_ROOT = 'C:/Users/Victus/trades/data/directory-seeds';
const REFACING_DIR = join(EXISTING_ROOT, '_refacing');

const FETCH_TIMEOUT_MS = 15000;
const CONCURRENCY = 8;
const USER_AGENT = 'Mozilla/5.0 (compatible; NEXTradeMarketBot/1.0; +https://thenetworkers.app/nex/about-bot)';

// ─── signal libraries (reused from Stage 3) ───

const SIGNALS = {
  manufacture: [
    /\bmanufactur(e|ing|er|es|ed)\b/i,
    /\bstair(case)?\s+mak(er|ers|ing|e)\b/i,
    /\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair/i,
    /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i,
    /\bin-house\s+(manufactur|production|joinery)/i,
    /\bown\s+(workshop|factory|manufacturing)\b/i,
    /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i,
    /\bstair(case)?s?\s+(supply|supplier|suppliers)\b/i,
  ],
  installation: [
    /\binstall(ation|s|ed|ing|er|ers)\b/i,
    /\bfitting\b/i,
    /\bfit(ted|ting)\s+by\s+us\b/i,
    /\bwe\s+fit\b/i,
    /\bon-site\s+install/i,
    /\bfully\s+install/i,
  ],
  refurbishment: [
    /\brefurb(ish(ment|ing|ed)?)?\b/i,
    /\brenovat(e|ing|ed|ion)\b/i,
    /\brestor(e|ing|ed|ation)\b/i,
    /\bupgrad(e|ing|ed)\s+(your\s+)?(stair|staircase)/i,
    /\bhandrail(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bspindl(e|es)\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bbaluster(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bmakeover\b/i,
    /\btransform(ing|ation|ed)?\s+(your\s+)?(stair|staircase)/i,
    /\bexisting\s+stair(case)?\b/i,
    /\bmodernis(e|ing|ed|ation)\b/i,
    /\brepair(s|ing|ed)?\b/i,
  ],
  refacing: [
    /\brefac(e|ing|ed)\b/i,
    /\bstair(case)?\s+(overlay|clad(ding)?|cover(ing)?|resurfac(e|ing))/i,
    /\bstair(case)?\s+(kit|kits)\b/i,
    /\boverlay\s+(your\s+)?stair/i,
    /\bclad(ding|s|ded)\s+over/i,
    /\bcover\s+(your\s+)?(carpet\s+|existing\s+)?stair/i,
    /\bveneer(ed|ing)?\s+stair/i,
  ],
  balustrade: [/\bbalustrad(e|es|ing)\b/i, /\bhandrail\s+system\b/i],
  handrail: [/\bhandrail(s)?\b/i, /\bhand[- ]rail(s)?\b/i],
  glass: [/\bglass\s+(stair|balustrad|panel|infill|handrail)/i, /\bglass\s+staircase/i, /\bframeless\s+glass\b/i],
  metal: [/\bmetal\s+(stair|staircase)/i, /\bsteel\s+(stair|staircase|balustrad)/i, /\b(mild|stainless)\s+steel\b/i, /\bwrought\s+iron\b/i],
  bespoke: [/\bbespoke\b/i, /\bmade[- ]to[- ]measure\b/i, /\bcustom(ised|ized)?\s+(stair|staircase|design)/i, /\bone[- ]off\b/i],
  design: [/\bdesign(er|ers|ed|s|ing)?\b/i, /\bcad\s+drawings?\b/i, /\b3d\s+(visualisation|render)/i],
  kit_or_product_supplier: [/\bkit(s)?\b/i, /\bself[- ]assembly\b/i, /\bdiy\s+(stair|kit)/i, /\bshop\s+(stair|parts|components)/i, /\bbuy\s+online\b/i, /\badd\s+to\s+(basket|cart)\b/i, /\bfree\s+delivery\b/i, /\bcatalog(ue)?\b/i],
};

// Explicit-negation patterns (rare · used for CONTRADICTED detection).
const NEGATION_PATTERNS_PER_CAP = {
  refurbishment: [/\bwe\s+(do\s+not|don'?t)\s+(refurb|renovat|restor|repair)/i, /\bnew\s+builds?\s+only\b/i],
  refacing: [/\bwe\s+(do\s+not|don'?t)\s+(refac|overlay|clad)/i],
  installation: [/\bsupply\s+only\b/i, /\bno\s+install(ation)?\s+service/i, /\bwe\s+do\s+not\s+install/i],
  manufacture: [/\bwe\s+do\s+not\s+manufactur/i, /\bwe\s+do\s+not\s+make\s+staircase/i, /\bwe\s+don'?t\s+make\s+staircase/i],
};

const MATERIAL_SIGNALS = ['oak','walnut','ash','pine','beech','maple','sapele','iroko','mahogany','glass','stainless steel','mild steel','wrought iron','concrete','carpet'];

// ─── HTTP fetch with timeout ───

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
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
    // Check for explicit negation
    let negated = null;
    const negPatterns = NEGATION_PATTERNS_PER_CAP[cap];
    if (negPatterns) {
      for (const rx of negPatterns) {
        const m = text.match(rx);
        if (m) { negated = m[0]; break; }
      }
    }
    evidence[cap] = { present: !!matched, matched_phrase: matched, explicit_negation: negated };
  }
  const materialsFound = MATERIAL_SIGNALS.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(text));
  return { capabilities: evidence, materials_mentioned: materialsFound };
}

// ─── verification state (Philip 4-state) ───

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

// ─── capability comparison (Philip 4-state) ───

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
    else if (wasClaimed && !evPresent) result[cap] = 'NOT_CONFIRMED'; // not the same as "does not provide"
    else if (!wasClaimed && evPresent) result[cap] = 'NEWLY_EVIDENCED'; // Stage 4 found what Stage 2 missed
    else result[cap] = 'NOT_CLAIMED_NOT_EVIDENCED';
  }
  return result;
}

// ─── business group classifier (Philip 6-group) ───

function classifyBusinessGroup(record, pageEvidence) {
  const evOr = (cap) => pageEvidence?.capabilities?.[cap]?.present === true || record.capabilities_claimed?.[cap] === true;
  const has = {
    mfr: evOr('manufacture'),
    inst: evOr('installation'),
    refurb: evOr('refurbishment'),
    reface: evOr('refacing'),
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

// ─── cross-source dedup ───

function normalizeName(s) {
  return (s || '').toLowerCase().replace(/\b(ltd|limited|llp|plc|co|company|inc|the)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
}
function normalizePhone(s) { return (s || '').replace(/\D/g, ''); }
function normalizeDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch { return ''; }
}
function normalizePostcode(p) { return (p || '').replace(/\s+/g, '').toUpperCase(); }

async function loadExistingSeeds() {
  const seeds = [];
  // Refacing seeds
  try {
    const rfiles = (await readdir(REFACING_DIR)).filter(f => f.endsWith('.json'));
    for (const f of rfiles) {
      try {
        const d = JSON.parse(await readFile(join(REFACING_DIR, f), 'utf8'));
        seeds.push({ ...d, _existing_source: `_refacing/${f}` });
      } catch {}
    }
  } catch {}
  // Legacy town seeds
  try {
    const dirs = (await readdir(EXISTING_ROOT, { withFileTypes: true }))
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name);
    for (const town of dirs) {
      try {
        const tfiles = (await readdir(join(EXISTING_ROOT, town))).filter(f => f.endsWith('.json'));
        for (const f of tfiles) {
          try {
            const d = JSON.parse(await readFile(join(EXISTING_ROOT, town, f), 'utf8'));
            seeds.push({ ...d, _existing_source: `${town}/${f}` });
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return seeds;
}

function findCrossSourceMatches(newRecord, existingSeeds) {
  const nDomain = normalizeDomain(newRecord.website);
  const nPhone = normalizePhone(newRecord.telephone);
  const nEmail = (newRecord.email || '').toLowerCase().trim();
  const nPc = normalizePostcode(newRecord.postcode);
  const nName = normalizeName(newRecord.business_name);
  const nTown = normalizeName(newRecord.town);
  const matches = [];
  for (const e of existingSeeds) {
    const eDomain = normalizeDomain(e.website);
    const ePhone = normalizePhone(e.telephone);
    const eEmail = (e.email || '').toLowerCase().trim();
    const ePc = normalizePostcode(e.postcode);
    const eName = normalizeName(e.business_name);
    const eTown = normalizeName(e.town);
    if (nDomain && nDomain === eDomain) { matches.push({ signal: 'domain', existing: e._existing_source }); continue; }
    if (nPhone.length >= 7 && nPhone === ePhone) { matches.push({ signal: 'phone', existing: e._existing_source }); continue; }
    if (nEmail && nEmail === eEmail) { matches.push({ signal: 'email', existing: e._existing_source }); continue; }
    if (nPc && eName && nName && nPc === ePc && (nName === eName || nName.includes(eName) || eName.includes(nName))) { matches.push({ signal: 'postcode+name', existing: e._existing_source }); continue; }
    if (nName && nTown && nName === eName && nTown === eTown) { matches.push({ signal: 'name+town', existing: e._existing_source }); continue; }
    if (nName && nName.length >= 8 && (nName === eName || (eName && (nName.includes(eName) || eName.includes(nName))))) { matches.push({ signal: 'fuzzy-name', existing: e._existing_source }); continue; }
  }
  return matches;
}

// ─── concurrency ───

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
  console.log(`Loaded ${all.length} canonical Stage 2 records`);

  const existingSeeds = await loadExistingSeeds();
  console.log(`Loaded ${existingSeeds.length} existing seeds (refacing + legacy towns)`);

  console.log(`\nFetching all ${all.length} URLs · concurrency=${CONCURRENCY} · timeout=${FETCH_TIMEOUT_MS}ms · this will take ~5-15 minutes`);
  const t0 = Date.now();

  const results = await pMap(all, async (r, idx) => {
    const url = (r.website || (r.source_urls?.[0]) || '').trim();
    const printPrefix = `[${String(idx + 1).padStart(3, ' ')}/${all.length}] ${r.business_name.slice(0, 50)}`;

    // Cross-source dedup FIRST (doesn't need HTTP)
    const crossSourceMatches = findCrossSourceMatches(r, existingSeeds);

    if (!url) {
      console.log(`${printPrefix} · no URL · SEARCH_DISCOVERED`);
      return {
        ...r,
        _stage4: {
          fetch: { ok: false, error: 'no_url' },
          identity_confirmed: false,
          evidence: null,
          verification: 'SEARCH_DISCOVERED',
          quality_band: 'D',
          business_group: 'MULTI_SERVICE_COMPANY',
          cross_source_matches: crossSourceMatches,
          is_duplicate_of_existing: crossSourceMatches.length > 0,
          capability_comparison: compareCapabilities(r.capabilities_claimed, null, 'SEARCH_DISCOVERED'),
        },
      };
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

    console.log(`${printPrefix} · ${fetchResult.ok ? fetchResult.status : `ERR:${(fetchResult.error||'').slice(0,20)}`} · ${verif} · ${group}${crossSourceMatches.length ? ` · DUPE(${crossSourceMatches[0].signal})` : ''}`);
    return {
      ...r,
      _stage4: {
        fetch: fetchResult.ok
          ? { ok: true, status: fetchResult.status, final_url: fetchResult.url, content_type: fetchResult.contentType, size_bytes: fetchResult.html?.length ?? 0 }
          : { ok: false, error: fetchResult.error },
        identity_confirmed: identityConfirmed,
        evidence: pageEvidence,
        verification: verif,
        quality_band: qualityBand(verif),
        business_group: group,
        cross_source_matches: crossSourceMatches,
        is_duplicate_of_existing: crossSourceMatches.length > 0,
        capability_comparison: capComparison,
      },
    };
  }, CONCURRENCY);

  const wallSecs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nAll ${results.length} fetched in ${wallSecs}s`);

  await writeFile(OUT_JSON, JSON.stringify(results, null, 2));

  // Manual-review queue: records that need human eyes
  const reviewQueue = results.filter(r =>
    r._stage4.verification === 'SEARCH_DISCOVERED' ||
    r._stage4.verification === 'DIRECTLY_REACHABLE' ||
    r._stage4.is_duplicate_of_existing
  );
  await writeFile(OUT_REVIEW, JSON.stringify(reviewQueue, null, 2));

  const duplicates = results.filter(r => r._stage4.is_duplicate_of_existing);
  await writeFile(OUT_DUPS, JSON.stringify(duplicates, null, 2));

  // ─── aggregate ───

  const agg = {
    total_discovered: results.length,
    directly_reachable: results.filter(r => r._stage4.fetch.ok).length,
    fetch_errors: results.filter(r => !r._stage4.fetch.ok && r._stage4.fetch.error !== 'no_url').length,
    no_url: results.filter(r => r._stage4.fetch.error === 'no_url').length,
    identity_confirmed: results.filter(r => r._stage4.identity_confirmed).length,
    fully_verified: results.filter(r => r._stage4.verification === 'FULLY_VERIFIED').length,
    service_evidenced: results.filter(r => r._stage4.verification === 'SERVICE_EVIDENCED').length,
    directly_reachable_only: results.filter(r => r._stage4.verification === 'DIRECTLY_REACHABLE').length,
    search_discovered_state: results.filter(r => r._stage4.verification === 'SEARCH_DISCOVERED').length,
    manual_review: reviewQueue.length,
    duplicates_vs_existing: duplicates.length,
    groups: {},
    capability_direct_evidence: {},
    capability_comparison: {},
    quality_bands: { A: 0, B: 0, C: 0, D: 0 },
    by_region: {},
    by_county: {},
  };
  for (const r of results) {
    agg.groups[r._stage4.business_group] = (agg.groups[r._stage4.business_group] || 0) + 1;
    agg.quality_bands[r._stage4.quality_band] = (agg.quality_bands[r._stage4.quality_band] || 0) + 1;
    if (r.region) agg.by_region[r.region] = (agg.by_region[r.region] || 0) + 1;
    if (r.county) agg.by_county[r.county] = (agg.by_county[r.county] || 0) + 1;
    if (r._stage4.evidence) {
      for (const [cap, ev] of Object.entries(r._stage4.evidence.capabilities)) {
        if (!agg.capability_direct_evidence[cap]) agg.capability_direct_evidence[cap] = 0;
        if (ev.present) agg.capability_direct_evidence[cap]++;
      }
    }
    for (const [cap, comparison] of Object.entries(r._stage4.capability_comparison)) {
      if (!agg.capability_comparison[cap]) agg.capability_comparison[cap] = { CONFIRMED: 0, NOT_CONFIRMED: 0, CONTRADICTED: 0, NOT_CHECKABLE: 0, NEWLY_EVIDENCED: 0, NOT_CLAIMED_NOT_EVIDENCED: 0 };
      agg.capability_comparison[cap][comparison]++;
    }
  }

  const md = renderReport(results, agg, existingSeeds.length, wallSecs);
  await writeFile(OUT_MD, md);

  console.log(`\n─── AGGREGATE ───`);
  console.log(JSON.stringify(agg, null, 2));
  console.log(`\nReport: ${OUT_MD}`);
  console.log(`Data:   ${OUT_JSON}`);
  console.log(`Manual review queue: ${OUT_REVIEW} (${reviewQueue.length} records)`);
  console.log(`Cross-source duplicates: ${OUT_DUPS} (${duplicates.length} records)`);
}

function renderReport(results, agg, existingSeedCount, wallSecs) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 4 · Full Direct-Verify + Cross-Source Dedup`);
  lines.push(``);
  lines.push(`_All ${agg.total_discovered} canonical Stage 2 records · direct HTTP fetched · evidence extracted from actual page content · cross-deduplicated against ${existingSeedCount} existing seeds · ${wallSecs}s wall time · 2026-08-15_`);
  lines.push(``);
  lines.push(`## Headline numbers (as requested)`);
  lines.push(``);
  lines.push(`- **TOTAL DISCOVERED:** ${agg.total_discovered}`);
  lines.push(`- **DIRECTLY REACHABLE** (HTTP 2xx-3xx): ${agg.directly_reachable}`);
  lines.push(`- **IDENTITY CONFIRMED** on page: ${agg.identity_confirmed}`);
  lines.push(`- **FULLY VERIFIED** (identity + ≥3 capabilities directly on page): ${agg.fully_verified}`);
  lines.push(`- **SERVICE EVIDENCED** (identity + ≥1 capability directly on page): ${agg.service_evidenced}`);
  lines.push(`- **DIRECTLY REACHABLE only** (identity confirmed, no capability evidence): ${agg.directly_reachable_only}`);
  lines.push(`- **SEARCH DISCOVERED** (fetch failed OR identity not confirmed · preserved for review): ${agg.search_discovered_state}`);
  lines.push(`- **MANUAL REVIEW queue** (SEARCH_DISCOVERED + DIRECTLY_REACHABLE_only + cross-source duplicates): ${agg.manual_review}`);
  lines.push(`- **DUPLICATES vs existing seeds:** ${agg.duplicates_vs_existing}`);
  lines.push(`- **Fetch errors:** ${agg.fetch_errors}`);
  lines.push(`- **No URL in record:** ${agg.no_url}`);
  lines.push(``);
  lines.push(`> Standing rule reminder: "**not evidenced**" ≠ "**does not provide the service**". A homepage may not mention refacing while the company still does refacing. The 4-state comparison below preserves this distinction.`);
  lines.push(``);
  lines.push(`## Capability direct evidence (of ${agg.total_discovered})`);
  lines.push(``);
  lines.push(`| Capability | Records with direct page evidence |`);
  lines.push(`|---|---:|`);
  const capOrder = ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal','kit_or_product_supplier','bespoke','design'];
  for (const c of capOrder) if (c in agg.capability_direct_evidence) lines.push(`| ${c} | ${agg.capability_direct_evidence[c]} |`);
  lines.push(``);
  lines.push(`## Capability comparison · Stage 2 claim → Stage 4 direct evidence`);
  lines.push(``);
  lines.push(`> Four states per capability:`);
  lines.push(`> - **CONFIRMED** — Stage 2 claimed AND Stage 4 evidence found on page`);
  lines.push(`> - **NOT_CONFIRMED** — Stage 2 claimed BUT Stage 4 evidence not found on homepage (does NOT mean company doesn't do it)`);
  lines.push(`> - **CONTRADICTED** — Stage 2 claimed BUT page explicitly negates the service (rare)`);
  lines.push(`> - **NOT_CHECKABLE** — fetch failed OR identity did not confirm — cannot verify either way`);
  lines.push(`> - **NEWLY_EVIDENCED** — Stage 2 didn't claim BUT Stage 4 evidence found on page`);
  lines.push(``);
  lines.push(`| Capability | CONFIRMED | NOT_CONFIRMED | CONTRADICTED | NOT_CHECKABLE | NEWLY_EVIDENCED |`);
  lines.push(`|---|---:|---:|---:|---:|---:|`);
  for (const cap of ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal']) {
    const c = agg.capability_comparison[cap];
    if (!c) continue;
    lines.push(`| ${cap} | ${c.CONFIRMED} | ${c.NOT_CONFIRMED} | ${c.CONTRADICTED} | ${c.NOT_CHECKABLE} | ${c.NEWLY_EVIDENCED} |`);
  }
  lines.push(``);
  lines.push(`## Business-group classification`);
  lines.push(``);
  lines.push(`| Group | Count |`);
  lines.push(`|---|---:|`);
  for (const [g, n] of Object.entries(agg.groups).sort((a,b) => b[1]-a[1])) lines.push(`| ${g} | ${n} |`);
  lines.push(``);
  lines.push(`## Quality bands (from 4-state verification)`);
  lines.push(``);
  lines.push(`| Band | Verification state | Count |`);
  lines.push(`|---|---|---:|`);
  lines.push(`| A | FULLY_VERIFIED | ${agg.quality_bands.A} |`);
  lines.push(`| B | SERVICE_EVIDENCED | ${agg.quality_bands.B} |`);
  lines.push(`| C | DIRECTLY_REACHABLE (identity only) | ${agg.quality_bands.C} |`);
  lines.push(`| D | SEARCH_DISCOVERED (not directly verified) | ${agg.quality_bands.D} |`);
  lines.push(``);
  lines.push(`## Geographic distribution`);
  lines.push(``);
  lines.push(`### By region`);
  lines.push(``);
  lines.push(`| Region | Count |`);
  lines.push(`|---|---:|`);
  for (const [r, n] of Object.entries(agg.by_region).sort((a,b) => b[1]-a[1])) lines.push(`| ${r} | ${n} |`);
  lines.push(``);
  lines.push(`### By county (top 20)`);
  lines.push(``);
  lines.push(`| County | Count |`);
  lines.push(`|---|---:|`);
  for (const [c, n] of Object.entries(agg.by_county).sort((a,b) => b[1]-a[1]).slice(0, 20)) lines.push(`| ${c} | ${n} |`);
  lines.push(``);
  lines.push(`## Cross-source duplicates`);
  lines.push(``);
  lines.push(`${agg.duplicates_vs_existing} Stage 2 records matched an existing seed (from \`_refacing/\` or legacy town directories). Preserved in \`stage4-cross-source-duplicates.json\` for merge-review — never auto-deleted, never auto-merged into production.`);
  lines.push(``);
  if (agg.duplicates_vs_existing > 0) {
    lines.push(`### First 20 cross-source duplicates`);
    lines.push(``);
    lines.push(`| Business | Matched-by | Existing source |`);
    lines.push(`|---|---|---|`);
    let shown = 0;
    for (const r of results) {
      if (!r._stage4.is_duplicate_of_existing) continue;
      if (shown >= 20) break;
      const m = r._stage4.cross_source_matches[0];
      lines.push(`| ${r.business_name} | \`${m.signal}\` | \`${m.existing}\` |`);
      shown++;
    }
    lines.push(``);
  }
  lines.push(`## Manual-review queue (preserved · NOT auto-deleted)`);
  lines.push(``);
  lines.push(`Per Philip's Stage 4 discipline (2026-08-15): identity failures and low-evidence records are preserved for human eyes. They are NOT dropped from the dataset.`);
  lines.push(``);
  lines.push(`- SEARCH_DISCOVERED (need re-fetch or manual identity check): ${agg.search_discovered_state}`);
  lines.push(`- DIRECTLY_REACHABLE_only (identity OK but no capability evidence on homepage — may need deeper crawl): ${agg.directly_reachable_only}`);
  lines.push(`- Cross-source duplicates (need merge decision): ${agg.duplicates_vs_existing}`);
  lines.push(`- Total review queue file: \`stage4-manual-review-queue.json\` (${agg.manual_review} records)`);
  lines.push(``);
  lines.push(`## What Stage 4 did NOT do`);
  lines.push(``);
  lines.push(`- Did not write to Supabase directory_seeds`);
  lines.push(`- Did not contact any company`);
  lines.push(`- Did not auto-merge cross-source duplicates into existing seeds`);
  lines.push(`- Did not delete or downgrade any identity-failure record`);
  lines.push(`- Did not flip any Stage 2 capability claim to false based on absence of evidence`);
  lines.push(`- Did not touch NEX brain, conversation architecture, or M4 freeze`);
  lines.push(`- Did not start Stage 5 · blocked pending Philip's approval`);
  lines.push(``);
  lines.push(`## Files produced`);
  lines.push(``);
  lines.push(`- \`stage4-full-verified.json\` — all ${agg.total_discovered} records with \`_stage4\` verification data merged`);
  lines.push(`- \`stage4-cross-source-duplicates.json\` — ${agg.duplicates_vs_existing} records matching existing seeds`);
  lines.push(`- \`stage4-manual-review-queue.json\` — ${agg.manual_review} records needing human review`);
  lines.push(`- \`STAGE-4-REPORT-2026-08-15.md\` — this report`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
