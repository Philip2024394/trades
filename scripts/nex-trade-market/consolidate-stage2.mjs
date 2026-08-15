// UK Staircase Trade Market · Stage 2 · consolidation + report
//
// Reads all agent-N-*.json files under data/directory-seeds/_staircase_uk_stage2/,
// deduplicates them into canonical company records (one company one record with
// merged capabilities · same rules as directorySeedsDb.mergeCapabilitiesIntoSeed),
// and writes:
//   1. stage2-consolidated.json  · machine-readable unique companies
//   2. STAGE-2-REPORT-2026-08-15.md · numeric report Philip asked for
//   3. stage2-duplicates.json    · which agents' records merged (audit trail)
//
// Rules honoured:
//   - Observed numbers only · no forecasts
//   - Missing data stays missing (never fabricated in this script)
//   - Coverage and quality reported on separate axes
//   - One company one record · multiple capabilities

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const STAGE_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_stage2';
const CONSOLIDATED = join(STAGE_DIR, 'stage2-consolidated.json');
const DUPLICATES = join(STAGE_DIR, 'stage2-duplicates.json');
const REPORT = join(STAGE_DIR, 'STAGE-2-REPORT-2026-08-15.md');

// ─── deduplication (mirrors directorySeedsDb.findDuplicateCandidates rules) ───

function normalizeName(s) {
  return (s || '').toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|co|company|inc|the)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
function normalizePhone(s) {
  return (s || '').replace(/\D/g, '');
}
function normalizeDomain(url) {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch { return ''; }
}
function normalizeEmail(e) {
  return (e || '').toLowerCase().trim();
}
function normalizePostcode(p) {
  return (p || '').replace(/\s+/g, '').toUpperCase();
}

// Merge two capability objects with OR semantics (once true, stays true).
function mergeCapabilities(a = {}, b = {}) {
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] === true) out[k] = true;
    else if (out[k] === undefined) out[k] = b[k];
  }
  return out;
}

// Merge two records into one canonical record.
function mergeRecords(existing, incoming) {
  // Prefer non-null fields; existing wins for identity fields.
  const merged = { ...existing };
  const fields = ['business_name','website','town','county','region','postcode','telephone','email'];
  for (const f of fields) {
    if (!merged[f] && incoming[f]) merged[f] = incoming[f];
  }
  merged.capabilities_claimed = mergeCapabilities(existing.capabilities_claimed, incoming.capabilities_claimed);
  merged.evidence_notes = [existing.evidence_notes, incoming.evidence_notes]
    .filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' · ');
  merged.source_queries = [...new Set([
    ...(existing.source_queries || (existing.source_query ? [existing.source_query] : [])),
    ...(incoming.source_queries || (incoming.source_query ? [incoming.source_query] : [])),
  ])];
  merged.source_urls = [...new Set([
    ...(existing.source_urls || (existing.source_url ? [existing.source_url] : [])),
    ...(incoming.source_urls || (incoming.source_url ? [incoming.source_url] : [])),
  ])];
  merged.discovered_by_agents = [...new Set([
    ...(existing.discovered_by_agents || (existing._agent ? [existing._agent] : [])),
    incoming._agent,
  ].filter(Boolean))];
  if (incoming.national_indicators) {
    merged.national_indicators = [...new Set([
      ...(existing.national_indicators || []),
      ...(incoming.national_indicators || []),
    ])];
  }
  if (incoming.refurbishment_specialism && !existing.refurbishment_specialism) {
    merged.refurbishment_specialism = incoming.refurbishment_specialism;
  }
  return merged;
}

// ─── main ───

async function main() {
  const files = (await readdir(STAGE_DIR)).filter(f => /^agent-\d+.*\.json$/.test(f));
  if (files.length === 0) { console.error('No agent-N-*.json files found in', STAGE_DIR); process.exit(1); }

  const raw = [];
  const perAgentCounts = {};
  for (const f of files.sort()) {
    try {
      const data = JSON.parse(await readFile(join(STAGE_DIR, f), 'utf8'));
      const arr = Array.isArray(data) ? data : (Array.isArray(data.candidates) ? data.candidates : []);
      const agentTag = f.replace(/\.json$/, '');
      for (const r of arr) raw.push({ ...r, _agent: agentTag });
      perAgentCounts[agentTag] = arr.length;
      console.log(`  read ${f}: ${arr.length} candidates`);
    } catch (e) {
      console.error(`  FAILED to read ${f}:`, e.message);
      perAgentCounts[f] = 'READ_ERROR';
    }
  }
  console.log(`\nTotal raw candidate rows across agents: ${raw.length}`);

  // Deduplication · walk records and merge into canonical set
  const canonical = []; // array of records
  const mergeLog = [];  // { canonical_index, incoming_index, match_signal }

  const indexByDomain = new Map();
  const indexByPhone = new Map();
  const indexByEmail = new Map();
  const indexByPcName = new Map();
  const indexByNormName = new Map();

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    const domain = normalizeDomain(r.website);
    const phone = normalizePhone(r.telephone);
    const email = normalizeEmail(r.email);
    const pc = normalizePostcode(r.postcode);
    const name = normalizeName(r.business_name);
    const town = normalizeName(r.town);
    const pcNameKey = pc && name ? `${pc}|${name}` : null;
    const nameTownKey = name && town ? `${name}|${town}` : null;

    // Match priority: domain > phone(≥7 digits) > email > postcode+name > name+town > fuzzy-name
    let hitIdx = null;
    let signal = null;
    if (domain && indexByDomain.has(domain)) { hitIdx = indexByDomain.get(domain); signal = 'domain'; }
    else if (phone.length >= 7 && indexByPhone.has(phone)) { hitIdx = indexByPhone.get(phone); signal = 'phone'; }
    else if (email && indexByEmail.has(email)) { hitIdx = indexByEmail.get(email); signal = 'email'; }
    else if (pcNameKey && indexByPcName.has(pcNameKey)) { hitIdx = indexByPcName.get(pcNameKey); signal = 'postcode+name'; }
    else if (nameTownKey && indexByNormName.has(nameTownKey)) { hitIdx = indexByNormName.get(nameTownKey); signal = 'name+town'; }
    else if (name && name.length >= 8) {
      // Fuzzy: normalised-name substring match (≥8 chars to avoid noise)
      for (let j = 0; j < canonical.length; j++) {
        const other = normalizeName(canonical[j].business_name);
        if (!other) continue;
        if (other.includes(name) || name.includes(other)) {
          hitIdx = j; signal = 'fuzzy-name'; break;
        }
      }
    }

    if (hitIdx !== null) {
      canonical[hitIdx] = mergeRecords(canonical[hitIdx], r);
      mergeLog.push({ into: hitIdx, incoming_agent: r._agent, incoming_name: r.business_name, signal });
      // Update indexes to point to the merged (possibly enriched) canonical entry
      const c = canonical[hitIdx];
      const cDomain = normalizeDomain(c.website);
      const cPhone = normalizePhone(c.telephone);
      const cEmail = normalizeEmail(c.email);
      const cPc = normalizePostcode(c.postcode);
      const cName = normalizeName(c.business_name);
      const cTown = normalizeName(c.town);
      if (cDomain) indexByDomain.set(cDomain, hitIdx);
      if (cPhone.length >= 7) indexByPhone.set(cPhone, hitIdx);
      if (cEmail) indexByEmail.set(cEmail, hitIdx);
      if (cPc && cName) indexByPcName.set(`${cPc}|${cName}`, hitIdx);
      if (cName && cTown) indexByNormName.set(`${cName}|${cTown}`, hitIdx);
    } else {
      canonical.push(r);
      const idx = canonical.length - 1;
      if (domain) indexByDomain.set(domain, idx);
      if (phone.length >= 7) indexByPhone.set(phone, idx);
      if (email) indexByEmail.set(email, idx);
      if (pcNameKey) indexByPcName.set(pcNameKey, idx);
      if (nameTownKey) indexByNormName.set(nameTownKey, idx);
    }
  }

  console.log(`\nCanonical unique companies after dedup: ${canonical.length}`);
  console.log(`Merges performed: ${mergeLog.length}`);

  // ─── M4-scope clarification (Philip 2026-08-15) ───
  // Refurbishment INCLUDES: handrail replacement · baluster/spindle replacement ·
  // staircase upgrade · renovation · restoration. Agents varied in how they read
  // this — some only set refurbishment=true when the site literally said "refurb".
  // This pass expands refurbishment=true whenever the evidence describes any of
  // those service types, so the report reflects Philip's definition uniformly.
  //
  // Two counts are reported below: raw (agent-reported) and expanded (this pass).
  const REFURB_SIGNAL_PATTERNS = [
    /\brefurb(ish(ment|ing|ed)?)?\b/i,
    /\brefac(e|ing|ed)\b/i,
    /\brenovat(e|ing|ed|ion)\b/i,
    /\brestor(e|ing|ed|ation)\b/i,
    /\bupgrad(e|ing|ed)\b/i,
    /\bhandrail(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\breplac(e|ing|ed|ement)\s+handrail/i,
    /\bspindl(e|es)\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\breplac(e|ing|ed|ement)\s+spindl/i,
    /\bbaluster(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\breplac(e|ing|ed|ement)\s+baluster/i,
    /\bnewel(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\btread(s)?\s+(replac|chang|upgrad|new|swap|updat)/i,
    /\bstair(case)?\s+(upgrad|makeover|transform|update|change|revamp)/i,
    /\bmakeover\b/i,
    /\btransform(ing|ation|ed)?\s+(your\s+)?(stair|staircase)/i,
    /\bexisting\s+stair(case)?\b/i,
  ];
  let expanded_refurb_promotions = 0;
  const expansionLog = [];
  for (const c of canonical) {
    if (c.capabilities_claimed?.refurbishment === true) continue;
    const evidence = (c.evidence_notes || '') + ' ' + (c.refurbishment_specialism || '');
    for (const rx of REFURB_SIGNAL_PATTERNS) {
      if (rx.test(evidence)) {
        c.capabilities_claimed = c.capabilities_claimed || {};
        c.capabilities_claimed.refurbishment = true;
        c._refurbishment_expanded_by = rx.source;
        expanded_refurb_promotions++;
        expansionLog.push({ business_name: c.business_name, matched: rx.source, evidence_snippet: evidence.slice(0, 200) });
        break;
      }
    }
  }

  // ─── M-scope clarification · MANUFACTURE (Philip 2026-08-15) ───
  // Manufacture includes: staircase maker · stair supply · stairs producer ·
  // staircase manufacture · bespoke staircases · custom stairs · design + build.
  // Agents that only set manufacture=true when they saw the literal word
  // "manufacturer" under-count. This pass expands based on vocabulary variants.
  const MANUFACTURE_SIGNAL_PATTERNS = [
    /\bmanufactur(e|ing|er|ers|es|ed)\b/i,
    /\bstair(case)?\s+mak(er|ers|ing|e)\b/i,
    /\bmak(e|er|ers|ing)\s+(bespoke\s+|custom\s+|timber\s+|oak\s+|glass\s+|hardwood\s+|new\s+)?stair/i,
    /\bstair(case)?s?\s+(supply|supplier|suppliers|supplied)\b/i,
    /\bstair(case)?s?\s+(producer|producers|produced|produce|production)\b/i,
    /\bstair(case)?s?\s+(build|built|building|builder|builders)\b/i,
    /\b(bespoke|custom|handmade|hand[- ]crafted|made[- ]to[- ]measure)\s+stair/i,
    /\bstair(case)?s?\s+(workshop|joinery)\b/i,
    /\b(design(ed)?|craft(ed|ing)?)\s+(and|&)\s+(build|built|make|made|manufactur|install)/i,
    /\b(we|our)\s+(make|build|manufacture|craft|produce)\s+(bespoke\s+|custom\s+)?stair/i,
    /\bin-house\s+(manufactur|production|joinery)/i,
    /\bown\s+(workshop|factory|manufacturing)\b/i,
  ];
  let expanded_manufacture_promotions = 0;
  const manufactureExpansionLog = [];
  for (const c of canonical) {
    if (c.capabilities_claimed?.manufacture === true) continue;
    const evidence = c.evidence_notes || '';
    for (const rx of MANUFACTURE_SIGNAL_PATTERNS) {
      if (rx.test(evidence)) {
        c.capabilities_claimed = c.capabilities_claimed || {};
        c.capabilities_claimed.manufacture = true;
        c._manufacture_expanded_by = rx.source;
        expanded_manufacture_promotions++;
        manufactureExpansionLog.push({ business_name: c.business_name, matched: rx.source, evidence_snippet: evidence.slice(0, 200) });
        break;
      }
    }
  }

  // ─── numeric roll-ups ───

  const CAPS = ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal','bespoke','design'];
  const capCounts = Object.fromEntries(CAPS.map(k => [k, 0]));
  let rawRefurbBeforeExpansion = 0;
  let rawManufactureBeforeExpansion = 0;
  for (const c of canonical) {
    const caps = c.capabilities_claimed || {};
    for (const k of CAPS) if (caps[k] === true) capCounts[k]++;
    if (caps.refurbishment === true && !c._refurbishment_expanded_by) rawRefurbBeforeExpansion++;
    if (caps.manufacture === true && !c._manufacture_expanded_by) rawManufactureBeforeExpansion++;
  }

  const byRegion = {};
  const byCounty = {};
  const byTown = {};
  const withWebsite = canonical.filter(c => c.website).length;
  const withPhone = canonical.filter(c => c.telephone).length;
  const withEmail = canonical.filter(c => c.email).length;
  const withPostcode = canonical.filter(c => c.postcode).length;
  for (const c of canonical) {
    if (c.region) byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    if (c.county) byCounty[c.county] = (byCounty[c.county] || 0) + 1;
    if (c.town) byTown[c.town] = (byTown[c.town] || 0) + 1;
  }

  // Quality band per Philip's Stage 2 ask (rough banding based on evidence count)
  //   A = website + phone + address + ≥2 capability flags · fully verifiable
  //   B = website + (phone OR email) + ≥1 capability flag
  //   C = website + minimal evidence
  //   D = no verifiable website
  function scoreRecord(c) {
    if (!c.website) return 'D';
    const capCount = Object.values(c.capabilities_claimed || {}).filter(v => v === true).length;
    const hasAddr = !!(c.postcode || c.town);
    if (c.website && c.telephone && hasAddr && capCount >= 2) return 'A';
    if (c.website && (c.telephone || c.email) && capCount >= 1) return 'B';
    if (c.website) return 'C';
    return 'D';
  }
  const bands = { A: 0, B: 0, C: 0, D: 0 };
  for (const c of canonical) bands[scoreRecord(c)]++;

  // Coverage vs quality (kept separate per standing rule)
  const coverage = {
    total_raw_candidates_from_agents: raw.length,
    total_files_read: files.length,
    per_agent_counts: perAgentCounts,
    canonical_unique_companies: canonical.length,
    duplicates_merged: mergeLog.length,
  };
  const quality = {
    band_A: bands.A,
    band_B: bands.B,
    band_C: bands.C,
    band_D: bands.D,
    with_verified_website: withWebsite,
    with_public_phone: withPhone,
    with_public_email: withEmail,
    with_postcode: withPostcode,
    requiring_manual_review: bands.C + bands.D,
  };

  // ─── write outputs ───

  await writeFile(CONSOLIDATED, JSON.stringify(canonical, null, 2));
  await writeFile(DUPLICATES, JSON.stringify(mergeLog, null, 2));

  const md = renderReport({ files, coverage, quality, capCounts, byRegion, byCounty, byTown, canonical, rawRefurbBeforeExpansion, expanded_refurb_promotions, expansionLog, rawManufactureBeforeExpansion, expanded_manufacture_promotions, manufactureExpansionLog });
  await writeFile(REPORT, md);

  console.log(`\nWrote:\n  ${CONSOLIDATED}\n  ${DUPLICATES}\n  ${REPORT}`);
}

function renderReport({ files, coverage, quality, capCounts, byRegion, byCounty, byTown, canonical, rawRefurbBeforeExpansion, expanded_refurb_promotions, expansionLog, rawManufactureBeforeExpansion, expanded_manufacture_promotions, manufactureExpansionLog }) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 2 · Report`);
  lines.push(``);
  lines.push(`_Generated 2026-08-15 · observed numbers only · no forecasts · Stage 3 blocked until Philip signs off._`);
  lines.push(``);
  lines.push(`## Coverage (real candidate businesses discovered / reached)`);
  lines.push(``);
  lines.push(`- Agents run: ${files.length}`);
  lines.push(`- Total raw candidate rows across all agents: ${coverage.total_raw_candidates_from_agents}`);
  lines.push(`- Canonical unique companies after deduplication: ${coverage.canonical_unique_companies}`);
  lines.push(`- Duplicate rows merged into existing: ${coverage.duplicates_merged}`);
  lines.push(``);
  lines.push(`### Per-agent output`);
  lines.push(``);
  lines.push(`| Agent file | Rows |`);
  lines.push(`|---|---:|`);
  for (const [f, n] of Object.entries(coverage.per_agent_counts)) {
    lines.push(`| ${f} | ${n} |`);
  }
  lines.push(``);
  lines.push(`## Quality (evidence bands · independent of coverage)`);
  lines.push(``);
  lines.push(`- Band A (website + phone + address + ≥2 capabilities): ${quality.band_A}`);
  lines.push(`- Band B (website + phone or email + ≥1 capability): ${quality.band_B}`);
  lines.push(`- Band C (website only · minimal evidence): ${quality.band_C}`);
  lines.push(`- Band D (no verifiable website): ${quality.band_D}`);
  lines.push(`- Records requiring manual review (Band C + D): ${quality.requiring_manual_review}`);
  lines.push(``);
  lines.push(`- Companies with verified website: ${quality.with_verified_website}`);
  lines.push(`- Companies with public phone number: ${quality.with_public_phone}`);
  lines.push(`- Companies with public business email: ${quality.with_public_email}`);
  lines.push(`- Companies with public postcode: ${quality.with_postcode}`);
  lines.push(``);
  lines.push(`## Capability evidence (a company may have several)`);
  lines.push(``);
  lines.push(`| Capability | Companies with evidence |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(capCounts)) {
    if (k === 'manufacture') {
      lines.push(`| manufacture (raw · agent-reported) | ${rawManufactureBeforeExpansion} |`);
      lines.push(`| manufacture (Philip-scope · includes staircase maker, stair supply, stairs producer, bespoke build) | ${n} |`);
      lines.push(`| _· of which promoted by expansion pass_ | ${expanded_manufacture_promotions} |`);
    } else if (k === 'refurbishment') {
      lines.push(`| refurbishment (raw · agent-reported) | ${rawRefurbBeforeExpansion} |`);
      lines.push(`| refurbishment (Philip-scope · includes handrail/spindle/baluster replacement + upgrade + renovation + restoration) | ${n} |`);
      lines.push(`| _· of which promoted by expansion pass_ | ${expanded_refurb_promotions} |`);
    } else {
      lines.push(`| ${k} | ${n} |`);
    }
  }
  lines.push(``);
  lines.push(`## Geographic distribution`);
  lines.push(``);
  lines.push(`### By region`);
  lines.push(``);
  lines.push(`| Region | Count |`);
  lines.push(`|---|---:|`);
  const sortedRegion = Object.entries(byRegion).sort((a,b) => b[1]-a[1]);
  for (const [r, n] of sortedRegion) lines.push(`| ${r} | ${n} |`);
  const noRegion = canonical.length - sortedRegion.reduce((s, [,n]) => s + n, 0);
  if (noRegion > 0) lines.push(`| _(unspecified)_ | ${noRegion} |`);
  lines.push(``);
  lines.push(`### By county (top 20)`);
  lines.push(``);
  lines.push(`| County | Count |`);
  lines.push(`|---|---:|`);
  const sortedCounty = Object.entries(byCounty).sort((a,b) => b[1]-a[1]).slice(0, 20);
  for (const [c, n] of sortedCounty) lines.push(`| ${c} | ${n} |`);
  lines.push(``);
  lines.push(`### By town (top 20)`);
  lines.push(``);
  lines.push(`| Town | Count |`);
  lines.push(`|---|---:|`);
  const sortedTown = Object.entries(byTown).sort((a,b) => b[1]-a[1]).slice(0, 20);
  for (const [t, n] of sortedTown) lines.push(`| ${t} | ${n} |`);
  lines.push(``);
  lines.push(`## Coverage vs Quality — kept separate`);
  lines.push(``);
  lines.push(`> Per standing rule (project_nex_coverage_vs_quality_separation_2026_08_14.md), these two numbers are NEVER combined into a single "success" percentage.`);
  lines.push(`>`);
  lines.push(`> **Coverage** = ${coverage.canonical_unique_companies} unique companies discovered.`);
  lines.push(`> **Quality**  = ${quality.band_A + quality.band_B} passed evidence threshold (bands A + B), ${quality.requiring_manual_review} require manual review (C + D).`);
  lines.push(``);
  lines.push(`## Manufacture scope clarification (Philip 2026-08-15)`);
  lines.push(``);
  lines.push(`> Manufacture vocabulary variants: **staircase maker · stair supply · stairs producer · staircase manufacture · staircase · stairs · bespoke build · in-house workshop**.`);
  lines.push(``);
  lines.push(`- Agent-reported manufacture: ${rawManufactureBeforeExpansion}`);
  lines.push(`- Expanded (Philip-scope) manufacture: ${capCounts.manufacture}`);
  lines.push(`- Newly-promoted records: ${expanded_manufacture_promotions}`);
  lines.push(``);
  if (manufactureExpansionLog.length > 0) {
    lines.push(`### Sample of manufacture promotions (first 10)`);
    lines.push(``);
    lines.push(`| Business | Matched signal | Evidence snippet |`);
    lines.push(`|---|---|---|`);
    for (const p of manufactureExpansionLog.slice(0, 10)) {
      const snippet = (p.evidence_snippet || '').replace(/\|/g, '\\|').slice(0, 120);
      lines.push(`| ${p.business_name} | \`${p.matched}\` | ${snippet}${(p.evidence_snippet || '').length > 120 ? '…' : ''} |`);
    }
    lines.push(``);
  }

  lines.push(`## Refurbishment scope clarification (Philip 2026-08-15)`);
  lines.push(``);
  lines.push(`> Refurbishment INCLUDES: handrail replacement · baluster/spindle replacement · staircase upgrade · renovation · restoration.`);
  lines.push(``);
  lines.push(`Agents varied in interpretation. Some set refurbishment=true only when the site literally said the word "refurbish". The expansion pass at consolidation time scanned evidence_notes for the broader signals above and promoted refurbishment=true accordingly.`);
  lines.push(``);
  lines.push(`- Agent-reported refurbishment: ${rawRefurbBeforeExpansion}`);
  lines.push(`- Expanded (Philip-scope) refurbishment: ${capCounts.refurbishment}`);
  lines.push(`- Newly-promoted records: ${expanded_refurb_promotions}`);
  lines.push(``);
  if (expansionLog.length > 0) {
    lines.push(`### Sample of promotions (first 10)`);
    lines.push(``);
    lines.push(`| Business | Matched signal | Evidence snippet |`);
    lines.push(`|---|---|---|`);
    for (const p of expansionLog.slice(0, 10)) {
      const snippet = (p.evidence_snippet || '').replace(/\|/g, '\\|').slice(0, 120);
      lines.push(`| ${p.business_name} | \`${p.matched}\` | ${snippet}${(p.evidence_snippet || '').length > 120 ? '…' : ''} |`);
    }
    lines.push(``);
  }

  lines.push(`## What was NOT done`);
  lines.push(``);
  lines.push(`- No companies contacted (email / phone / form). Rule: never contact in Stage 2.`);
  lines.push(`- No writes to Supabase directory_seeds. Rule: staging file first, dry-run before any production write.`);
  lines.push(`- No records invented to hit a target. Rule: never fabricate.`);
  lines.push(`- No directory-profile URLs (Yell / Checkatrade / Bark / Houzz) written as company records. Rule: those are discovery bookmarks, not companies.`);
  lines.push(`- Stage 3 sample review not started · waiting for Philip's sign-off.`);
  lines.push(``);
  lines.push(`## Next step (blocked pending Philip's review)`);
  lines.push(``);
  lines.push(`Stage 3 · pick 20 records from the canonical set for manual inspection (fields · evidence quality · classification correctness). Requires explicit approval before proceeding.`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
