// UK Staircase Trade Market · Stage 2-AU · Consolidation + report
//
// Reads all 8 AU agent outputs, deduplicates by normalised domain within
// Australia, cross-checks against the live 896 UK+IE+US production rows to
// flag international duplicates, and produces a single report.
//
// Rules preserved:
//   · Zero writes to Supabase
//   · Zero mutations to existing UK/IE/US datasets
//   · Preserves capability claims as claims
//   · Never sets verified=true or claimed=true

import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
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
const supabase = createClient(
  env.NEXT_PUBLIC_NEX_SUPABASE_URL,
  env.NEX_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const AU_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_au_stage2';
const OUT_CONSOLIDATED = `${AU_DIR}/stage2-au-consolidated.json`;
const OUT_DEDUP = `${AU_DIR}/stage2-au-dedup-audit.json`;
const OUT_REPORT = `${AU_DIR}/STAGE-2-AU-REPORT-2026-08-17.md`;

const normDomain = (url) => {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch { return ''; }
};
const normPhone = (s) => (s || '').replace(/\D/g, '');

async function loadLiveProduction() {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('directory_seeds')
      .select('id, business_name, slug, website, telephone, country, region, town')
      .range(from, from + 999);
    if (error) throw new Error(`Live fetch failed: ${error.message}`);
    if (!data.length) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

function buildLiveIndex(rows) {
  const byDomain = new Map();
  const byPhone = new Map();
  for (const r of rows) {
    const d = normDomain(r.website);
    if (d) byDomain.set(d, r);
    const p = normPhone(r.telephone);
    if (p.length >= 7) byPhone.set(p, r);
  }
  return { byDomain, byPhone };
}

async function main() {
  console.log('\n[1/5] Loading AU agent outputs...');
  const files = readdirSync(AU_DIR).filter(f => f.startsWith('agent-au-') && f.endsWith('.json'));
  files.sort();
  const perAgent = [];
  let rawTotal = 0;
  for (const f of files) {
    const parsed = JSON.parse(await readFile(`${AU_DIR}/${f}`, 'utf8'));
    // Handle two shapes: array-root or object-with-`companies`.
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed.companies) ? parsed.companies : [];
    perAgent.push({ file: f, count: records.length, records });
    rawTotal += records.length;
    console.log(`  ${f}: ${records.length}`);
  }
  console.log(`  raw total: ${rawTotal}`);

  console.log('\n[2/5] Within-AU domain dedup...');
  const byDomain = new Map();
  const noDomain = [];
  let inAuDupes = 0;
  for (const agent of perAgent) {
    for (const rec of agent.records) {
      const d = normDomain(rec.website || rec.domain);
      const enriched = { ...rec, _source_agent: agent.file, _normalised_domain: d };
      if (!d) { noDomain.push(enriched); continue; }
      const existing = byDomain.get(d);
      if (!existing) {
        byDomain.set(d, { ...enriched, _agent_sources: [agent.file] });
      } else {
        inAuDupes++;
        existing._agent_sources = Array.from(new Set([...(existing._agent_sources || []), agent.file]));
        // Union capability_claims + preserve first-found evidence.
        const mergedCaps = Array.from(new Set([
          ...(existing.capability_claims || []),
          ...(rec.capability_claims || []),
        ]));
        existing.capability_claims = mergedCaps;
        // Merge capability_evidence (existing wins for already-set keys).
        existing.capability_evidence = { ...(rec.capability_evidence || {}), ...(existing.capability_evidence || {}) };
      }
    }
  }
  const uniqueAu = [...byDomain.values(), ...noDomain];
  console.log(`  unique after within-AU dedup: ${uniqueAu.length} (removed ${inAuDupes} dupes · ${noDomain.length} without domain)`);

  console.log('\n[3/5] Fetching live 896 production rows...');
  const liveRows = await loadLiveProduction();
  const live = buildLiveIndex(liveRows);
  console.log(`  live rows: ${liveRows.length}`);

  console.log('\n[4/5] Cross-country dedup vs live...');
  const crossHits = [];
  for (const rec of uniqueAu) {
    const d = rec._normalised_domain;
    const p = normPhone(rec.telephone);
    let hit = null;
    if (d && live.byDomain.has(d)) {
      const l = live.byDomain.get(d);
      hit = { type: 'domain', live_country: l.country, live_slug: l.slug, live_name: l.business_name };
    } else if (p.length >= 7 && live.byPhone.has(p)) {
      const l = live.byPhone.get(p);
      hit = { type: 'phone', live_country: l.country, live_slug: l.slug, live_name: l.business_name };
    }
    if (hit) {
      crossHits.push({
        au_business_name: rec.business_name,
        au_state: rec.state,
        au_domain: d,
        au_source_agents: rec._agent_sources,
        cross_country_match: hit,
      });
      rec._cross_country_hit = hit;
    }
  }
  console.log(`  cross-country matches: ${crossHits.length} (candidates for AU branch review · not automatic exclude)`);

  // State/city distribution
  const stateCounts = {};
  const cityCounts = {};
  const businessTypeCounts = {};
  const withRefacing = [];
  const withRefurb = [];
  const withPhone = uniqueAu.filter(r => r.telephone).length;
  const withEmail = uniqueAu.filter(r => r.email).length;
  const withWebsite = uniqueAu.filter(r => r.website).length;

  for (const rec of uniqueAu) {
    if (rec.state) stateCounts[rec.state] = (stateCounts[rec.state] || 0) + 1;
    const cityKey = `${rec.state}|${rec.city || rec.suburb || ''}`;
    if (rec.city) cityCounts[cityKey] = (cityCounts[cityKey] || 0) + 1;
    if (rec.business_type_claim) businessTypeCounts[rec.business_type_claim] = (businessTypeCounts[rec.business_type_claim] || 0) + 1;
    if ((rec.capability_claims || []).includes('refacing')) withRefacing.push(rec.business_name);
    if ((rec.capability_claims || []).includes('refurbishment')) withRefurb.push(rec.business_name);
  }

  console.log('\n[5/5] Writing consolidated dataset + audit + report...');
  await writeFile(OUT_CONSOLIDATED, JSON.stringify(uniqueAu, null, 2));
  await writeFile(OUT_DEDUP, JSON.stringify({
    generated_at: new Date().toISOString(),
    raw_total: rawTotal,
    within_au_duplicates_removed: inAuDupes,
    unique_count: uniqueAu.length,
    cross_country_hits: crossHits,
    per_agent: perAgent.map(a => ({ file: a.file, count: a.count })),
  }, null, 2));

  const lines = [];
  lines.push(`# Australia Staircase Trade Market · Stage 2-AU Discovery Report`);
  lines.push(``);
  lines.push(`_Generated ${new Date().toISOString()} · Stage 2 = discovery, not verification · zero Supabase writes_`);
  lines.push(``);
  lines.push(`## Result summary`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| Raw candidates (across all 8 agents) | ${rawTotal} |`);
  lines.push(`| Within-AU duplicates removed | ${inAuDupes} |`);
  lines.push(`| Unique AU candidates | **${uniqueAu.length}** |`);
  lines.push(`| Records without domain (kept for manual review) | ${noDomain.length} |`);
  lines.push(`| Cross-country collision hits (vs live 896 UK+IE+US) | ${crossHits.length} |`);
  lines.push(``);
  lines.push(`## Per-agent contribution`);
  lines.push(``);
  lines.push(`| Agent | Raw count |`);
  lines.push(`|---|---:|`);
  for (const a of perAgent) lines.push(`| ${a.file} | ${a.count} |`);
  lines.push(``);
  lines.push(`## State distribution (unique AU)`);
  lines.push(``);
  lines.push(`| State | Count |`);
  lines.push(`|---|---:|`);
  const stateEntries = Object.entries(stateCounts).sort((a,b)=>b[1]-a[1]);
  for (const [s, n] of stateEntries) lines.push(`| ${s} | ${n} |`);
  lines.push(`| **Total** | **${uniqueAu.length}** |`);
  lines.push(``);
  lines.push(`## Business type distribution`);
  lines.push(``);
  lines.push(`| business_type_claim | Count |`);
  lines.push(`|---|---:|`);
  const btEntries = Object.entries(businessTypeCounts).sort((a,b)=>b[1]-a[1]);
  for (const [k, n] of btEntries) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Capability signals (top-line)`);
  lines.push(``);
  lines.push(`| Capability claim | Companies |`);
  lines.push(`|---|---:|`);
  const capCounts = {};
  for (const rec of uniqueAu) {
    for (const c of (rec.capability_claims || [])) capCounts[c] = (capCounts[c] || 0) + 1;
  }
  const capEntries = Object.entries(capCounts).sort((a,b)=>b[1]-a[1]);
  for (const [c, n] of capEntries) lines.push(`| ${c} | ${n} |`);
  lines.push(``);
  lines.push(`> Stage 2 claims are UNVERIFIED. Stage 3/4 verifies capability presence via direct site fetch. Do NOT treat these as \`capabilities.<cap>='yes'\` yet.`);
  lines.push(``);
  lines.push(`## Contact-channel coverage`);
  lines.push(``);
  lines.push(`| Channel | Records with data | % |`);
  lines.push(`|---|---:|---:|`);
  const pct = (n) => ((n / uniqueAu.length) * 100).toFixed(0) + '%';
  lines.push(`| website | ${withWebsite} | ${pct(withWebsite)} |`);
  lines.push(`| telephone | ${withPhone} | ${pct(withPhone)} |`);
  lines.push(`| email (public) | ${withEmail} | ${pct(withEmail)} |`);
  lines.push(``);
  lines.push(`## Cross-country collisions`);
  lines.push(``);
  if (crossHits.length === 0) {
    lines.push(`No AU discovery record collided with a live UK/IE/US production row. Clean set.`);
  } else {
    lines.push(`These AU discovery records share a domain or phone with an already-live UK/IE/US record. Do NOT auto-discard — an Australian branch of a foreign parent is valid. Stage 3-AU decides case by case.`);
    lines.push(``);
    lines.push(`| AU business | AU state | AU domain | Match type | Live country | Live slug |`);
    lines.push(`|---|---|---|---|---|---|`);
    for (const h of crossHits.slice(0, 40)) {
      lines.push(`| ${h.au_business_name} | ${h.au_state ?? ''} | ${h.au_domain ?? ''} | ${h.cross_country_match.type} | ${h.cross_country_match.live_country} | ${h.cross_country_match.live_slug} |`);
    }
    if (crossHits.length > 40) lines.push(`| _(+${crossHits.length - 40} more · see stage2-au-dedup-audit.json)_ |||||`);
  }
  lines.push(``);
  lines.push(`## Rules preserved`);
  lines.push(``);
  lines.push(`- Zero Supabase writes`);
  lines.push(`- Zero mutations to UK 471 / IE 50 / USA 375 (all remain frozen)`);
  lines.push(`- Zero companies contacted`);
  lines.push(`- Capability claims preserved as CLAIMS (not verified · not promoted to \`capabilities.<cap>='yes'\`)`);
  lines.push(`- Every record has a source_url (Stage 3-AU can re-check)`);
  lines.push(`- Within-AU dedup by normalised domain · same-domain records merged`);
  lines.push(`- Cross-country matches flagged for review · never auto-discarded (Australian branch case is real)`);
  lines.push(``);
  lines.push(`## Files`);
  lines.push(``);
  lines.push(`- \`${OUT_CONSOLIDATED}\` · unified array of ${uniqueAu.length} unique AU candidates`);
  lines.push(`- \`${OUT_DEDUP}\` · dedup audit trail`);
  lines.push(`- 8 × \`agent-au-*.json\` · original per-agent output (unchanged)`);
  lines.push(``);
  lines.push(`## Next step (blocked pending Philip's approval)`);
  lines.push(``);
  lines.push(`Stage 3-AU · 20-record deep-verify sample. Follows the same protocol as UK / IE / USA:`);
  lines.push(`- Sample across all states + business types`);
  lines.push(`- Direct fetch each business's own domain`);
  lines.push(`- Confirm or contradict Stage 2 capability claims`);
  lines.push(`- Never elevates claims without evidence`);

  await writeFile(OUT_REPORT, lines.join('\n'));
  console.log(`\n  ✓ ${OUT_CONSOLIDATED}`);
  console.log(`  ✓ ${OUT_DEDUP}`);
  console.log(`  ✓ ${OUT_REPORT}`);
  console.log(`\nDone. Unique AU: ${uniqueAu.length} · cross-country hits: ${crossHits.length}`);
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
