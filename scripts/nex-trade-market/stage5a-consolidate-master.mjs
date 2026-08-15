// UK Staircase Trade Market · Stage 5A · Master dataset consolidation (DRY-RUN)
//
// Consolidates:
//   · 311 canonical Stage 2 records (with Stage 4 direct-fetch evidence)
//   · 5 existing refacing seeds
//   · ~223 legacy town seeds
//
// Produces the UK Staircase Trade Master Dataset:
//   · One canonical record per business
//   · Two-dimension classification: business_type (single) + capabilities (multi)
//   · Preserves every source URL and evidence item
//   · Never overwrites stronger existing data with weaker new data
//   · Customer-facing label follows Philip's "verified" language caution
//   · Splits into 3 tiers:
//       production_ready.json   · 205 A-band + 16 B-band = 221 records
//       merge_pending.json      · 16 cross-source duplicates for review
//       manual_review_queue.json · 89 SEARCH_DISCOVERED + 1 DIRECTLY_REACHABLE
//
// DRY-RUN. Does NOT write to Supabase. Emits an import-plan preview only.
// Stage 5B (actual import) requires Philip's approval on the dry-run.
//
// Rules (Philip 2026-08-15):
//   · Never invent
//   · Never contact
//   · Preserve original evidence · never overwrite stronger with weaker
//   · "Verified" reserved for claimed+ · use "Business information checked" for FULLY_VERIFIED
//   · No M4 / brain touching

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const STAGE4_JSON = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_stage2/stage4-full-verified.json';
const EXISTING_ROOT = 'C:/Users/Victus/trades/data/directory-seeds';
const REFACING_DIR = join(EXISTING_ROOT, '_refacing');

const MASTER_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_master';
const OUT_PRODUCTION = join(MASTER_DIR, 'production_ready.json');
const OUT_MERGE_PENDING = join(MASTER_DIR, 'merge_pending.json');
const OUT_REVIEW = join(MASTER_DIR, 'manual_review_queue.json');
const OUT_IMPORT_PLAN = join(MASTER_DIR, 'stage5b-import-plan.json');
const OUT_MD = join(MASTER_DIR, 'STAGE-5A-REPORT-2026-08-15.md');

// ─── helpers ───

const normName = s => (s || '').toLowerCase().replace(/\b(ltd|limited|llp|plc|co|company|inc|the)\b/g, '').replace(/[^a-z0-9]+/g, '').trim();
const normPhone = s => (s || '').replace(/\D/g, '');
const normEmail = e => (e || '').toLowerCase().trim();
const normPc = p => (p || '').replace(/\s+/g, '').toUpperCase();
const normDomain = url => {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch { return ''; }
};

function toSlug(name, town) {
  const bits = [name, town].filter(Boolean).join('-');
  return bits.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function customerFacingLabel(verification) {
  if (verification === 'FULLY_VERIFIED') return 'Business information checked';
  if (verification === 'SERVICE_EVIDENCED') return 'Business information partially checked';
  return null;
}

// ─── business type + capability normalisation for master schema ───

// business_type comes straight from Stage 4 (already classified per Philip's 6-group)
// Capabilities: convert boolean → "yes" | "no" | "unknown" per existing DirectorySeed schema
function normaliseCapabilities(claimed, evidence) {
  const CAPS = ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal','bespoke','design','kit_or_product_supplier'];
  const out = {};
  for (const cap of CAPS) {
    const wasClaimed = claimed?.[cap] === true;
    const evPresent = evidence?.capabilities?.[cap]?.present === true;
    if (evPresent) out[cap] = 'yes'; // direct evidence wins
    else if (wasClaimed) out[cap] = 'yes'; // claim retained per "not evidenced ≠ does not provide"
    else out[cap] = 'unknown'; // never "no" unless explicit negation was found
  }
  // If Stage 4 found explicit negation, downgrade to "no"
  if (evidence?.capabilities) {
    for (const [cap, ev] of Object.entries(evidence.capabilities)) {
      if (ev?.explicit_negation && out[cap]) out[cap] = 'no';
    }
  }
  return out;
}

// Primary trade slug for existing directory_seeds compatibility
function primaryTradeFor(businessType) {
  switch (businessType) {
    case 'REFACING_SERVICE_SPECIALIST': return 'staircase_refacing';
    case 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER': return 'staircase_refacing';
    case 'REFURBISHMENT_SERVICE_SPECIALIST': return 'staircase_refurbishment';
    case 'STAIRCASE_MANUFACTURER': return 'staircase_manufacture';
    case 'STAIRCASE_INSTALLER': return 'staircase_installer';
    case 'MULTI_SERVICE_COMPANY':
    default: return 'staircase_manufacture';
  }
}

function categoryFor(businessType) {
  switch (businessType) {
    case 'REFACING_SERVICE_SPECIALIST':
    case 'REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER': return 'Staircase Refacing';
    case 'REFURBISHMENT_SERVICE_SPECIALIST': return 'Staircase Refurbishment';
    case 'STAIRCASE_MANUFACTURER': return 'Staircase Manufacturer';
    case 'STAIRCASE_INSTALLER': return 'Staircase Installer';
    case 'MULTI_SERVICE_COMPANY':
    default: return 'Multi-Service Staircase Company';
  }
}

function tagsFor(caps, businessType, materials) {
  const t = new Set();
  if (caps.manufacture === 'yes') t.add('staircase-manufacture');
  if (caps.installation === 'yes') t.add('staircase-installation');
  if (caps.refurbishment === 'yes') t.add('staircase-refurbishment');
  if (caps.refacing === 'yes') t.add('staircase-refacing');
  if (caps.balustrade === 'yes') t.add('balustrade');
  if (caps.handrail === 'yes') t.add('handrail');
  if (caps.glass === 'yes') t.add('glass-staircase');
  if (caps.metal === 'yes') t.add('metal-staircase');
  if (caps.bespoke === 'yes') t.add('bespoke');
  if (caps.design === 'yes') t.add('design');
  if (caps.kit_or_product_supplier === 'yes') t.add('kit-or-product-supplier');
  for (const m of (materials || [])) t.add(`material-${m.replace(/\s+/g, '-')}`);
  return [...t];
}

// ─── master-record builder ───

function buildMasterRecord(stage4Record) {
  const s4 = stage4Record._stage4;
  const verification = s4.verification;
  const evidence = s4.evidence;
  const claimed = stage4Record.capabilities_claimed;
  const caps = normaliseCapabilities(claimed, evidence);
  const businessType = s4.business_group;
  const label = customerFacingLabel(verification);

  const evidenceItems = [];
  // Stage 2 origin evidence (source pages found by discovery agents)
  for (const url of (stage4Record.source_urls || [])) {
    evidenceItems.push({
      url,
      type: 'discovery_source',
      category: 'stage2_discovery',
      summary: (stage4Record.evidence_notes || '').slice(0, 400),
      checked_at: '2026-08-15',
    });
  }
  // Stage 4 direct-fetch evidence
  if (s4.fetch?.ok && s4.identity_confirmed) {
    const capMatches = [];
    for (const [cap, ev] of Object.entries(evidence?.capabilities || {})) {
      if (ev.present) capMatches.push(`${cap}(“${(ev.matched_phrase || '').slice(0, 40)}”)`);
    }
    evidenceItems.push({
      url: s4.fetch.final_url || stage4Record.website,
      type: 'company_website',
      category: 'stage4_direct_fetch',
      summary: `Direct-fetch HTTP ${s4.fetch.status} · identity confirmed · capabilities on page: ${capMatches.join(', ') || '(none matched)'}. Materials mentioned: ${(evidence?.materials_mentioned || []).join(', ') || '(none)'}.`,
      checked_at: '2026-08-15',
      http_status: s4.fetch.status,
      size_bytes: s4.fetch.size_bytes,
    });
  } else if (s4.fetch?.ok && !s4.identity_confirmed) {
    evidenceItems.push({
      url: s4.fetch.final_url || stage4Record.website,
      type: 'company_website_identity_unconfirmed',
      category: 'stage4_direct_fetch',
      summary: `Direct-fetch HTTP ${s4.fetch.status} but page did not surface company name in first 30k chars. Possible JS-render, trading-name variance, or Stage 2 snippet ambiguity. Needs manual identity check.`,
      checked_at: '2026-08-15',
      http_status: s4.fetch.status,
    });
  } else if (!s4.fetch?.ok) {
    evidenceItems.push({
      url: stage4Record.website,
      type: 'fetch_failed',
      category: 'stage4_direct_fetch',
      summary: `Direct-fetch failed: ${s4.fetch?.error || 'unknown_error'}. Only search-snippet evidence available.`,
      checked_at: '2026-08-15',
    });
  }

  const record = {
    id: randomUUID(),
    slug: toSlug(stage4Record.business_name, stage4Record.town),
    business_name: stage4Record.business_name,
    category: categoryFor(businessType),
    primary_trade: primaryTradeFor(businessType),
    // NEW · two-dimension schema
    business_type: businessType,
    capabilities: caps,
    // Standard directory-seed fields
    tags: tagsFor(caps, businessType, evidence?.materials_mentioned),
    enrichment_status: verification === 'FULLY_VERIFIED' ? 'enriched' : (verification === 'SERVICE_EVIDENCED' ? 'partial' : 'raw'),
    last_verified_at: '2026-08-15T00:00:00.000Z',
    address_line_1: null,
    address_line_2: null,
    town: stage4Record.town || null,
    county: stage4Record.county || null,
    postcode: stage4Record.postcode || null,
    country: 'United Kingdom',
    telephone: stage4Record.telephone || null,
    website: stage4Record.website || null,
    email: stage4Record.email || null,
    opening_hours: null,
    description: stage4Record.evidence_notes || null,
    services: [], // reserved for later enrichment
    google_rating: null,
    google_review_count: null,
    google_maps_url: null,
    latitude: null,
    longitude: null,
    status: 'listed',
    claimed: false,
    verified: false, // Philip's language caution · reserved for claimed+ companies
    visibility: 'public',
    photos: [],
    cover_image: null,
    source: 'uk_staircase_market_stage_2_4_5',
    imported_at: '2026-08-15T00:00:00.000Z',
    // Evidence items (append-only trail)
    refacing_evidence: evidenceItems, // reused name; broader than refacing
    refacing_qualification: verification === 'FULLY_VERIFIED' ? 'A' : (verification === 'SERVICE_EVIDENCED' ? 'B' : (verification === 'DIRECTLY_REACHABLE' ? 'C' : null)),
    email_source: null,
    email_verified: false,
    email_checked_at: null,
    // Lifecycle
    lifecycle_status: 'unclaimed',
    directory_state: 'listed',
    // NEW · Philip's Stage 5 additions
    internal_verification_state: verification,
    customer_facing_label: label,
    // Provenance
    region: stage4Record.region || null,
    discovered_by_agents: stage4Record.discovered_by_agents || [],
    stage2_source_queries: stage4Record.source_queries || [],
    stage2_source_urls: stage4Record.source_urls || [],
    stage4_direct_fetch: s4.fetch,
    stage4_identity_confirmed: s4.identity_confirmed,
    stage4_page_evidence_summary: evidence
      ? Object.fromEntries(Object.entries(evidence.capabilities).filter(([, v]) => v.present).map(([k, v]) => [k, v.matched_phrase]))
      : null,
  };

  return record;
}

// ─── existing-seed loader (for cross-source dedup + merge) ───

async function loadExistingSeeds() {
  const seeds = [];
  try {
    const rfiles = (await readdir(REFACING_DIR)).filter(f => f.endsWith('.json'));
    for (const f of rfiles) {
      try {
        const d = JSON.parse(await readFile(join(REFACING_DIR, f), 'utf8'));
        seeds.push({ ...d, _existing_source: `_refacing/${f}` });
      } catch {}
    }
  } catch {}
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

// ─── safe merge: existing takes precedence, new adds evidence + fills nulls ───

function mergeIntoExisting(existing, incoming) {
  // Never overwrite existing values · only backfill nulls
  const merged = { ...existing };
  const backfillFields = ['telephone','email','postcode','county','town','address_line_1','address_line_2','description','website'];
  for (const f of backfillFields) if (merged[f] == null && incoming[f] != null) merged[f] = incoming[f];

  // Capabilities: existing "yes" wins · new "yes" adds · never overwrite "yes" with "no"
  merged.capabilities = { ...(existing.capabilities || {}) };
  for (const [k, v] of Object.entries(incoming.capabilities || {})) {
    if (merged.capabilities[k] === 'yes') continue;
    if (v === 'yes') merged.capabilities[k] = 'yes';
    else if (merged.capabilities[k] === undefined || merged.capabilities[k] === 'unknown') merged.capabilities[k] = v;
  }

  // Add new business_type + customer_facing_label to existing record
  if (!merged.business_type && incoming.business_type) merged.business_type = incoming.business_type;
  if (!merged.internal_verification_state && incoming.internal_verification_state) merged.internal_verification_state = incoming.internal_verification_state;
  if (!merged.customer_facing_label && incoming.customer_facing_label) merged.customer_facing_label = incoming.customer_facing_label;

  // Evidence items: append + dedupe by (url, category)
  const existingEvidence = existing.refacing_evidence || [];
  const incomingEvidence = incoming.refacing_evidence || [];
  const combined = [...existingEvidence];
  for (const item of incomingEvidence) {
    if (!combined.some(e => e.url === item.url && e.category === item.category)) combined.push(item);
  }
  merged.refacing_evidence = combined;

  // Qualification: upgrade only (never downgrade)
  const rank = { 'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, excluded: 0 };
  const existingRank = rank[existing.refacing_qualification] ?? 0;
  const incomingRank = rank[incoming.refacing_qualification] ?? 0;
  if (incomingRank > existingRank) merged.refacing_qualification = incoming.refacing_qualification;

  // Tags: union
  merged.tags = [...new Set([...(existing.tags || []), ...(incoming.tags || [])])];

  // Preserve provenance
  merged.stage2_discovery_at = incoming.imported_at;
  merged.discovered_by_agents = [...new Set([...(existing.discovered_by_agents || []), ...(incoming.discovered_by_agents || [])])];
  merged.merge_history = [
    ...(existing.merge_history || []),
    { merged_at: '2026-08-15T00:00:00.000Z', from_source: 'stage_5a_master_consolidation', reason: 'cross_source_duplicate_matched', signals: incoming._merge_signals || [] },
  ];

  return merged;
}

// ─── main ───

async function main() {
  await mkdir(MASTER_DIR, { recursive: true });

  console.log('Loading Stage 4 verified dataset...');
  const stage4 = JSON.parse(await readFile(STAGE4_JSON, 'utf8'));
  console.log(`  ${stage4.length} records`);

  console.log('Loading existing seeds (refacing + legacy towns)...');
  const existingSeeds = await loadExistingSeeds();
  console.log(`  ${existingSeeds.length} existing seeds\n`);

  // ─── build master records for all 311 ───

  const masterRecords = stage4.map(buildMasterRecord);
  console.log(`Built ${masterRecords.length} master records\n`);

  // ─── split into tiers based on Stage 4 verification + duplicate status ───

  const productionReady = [];
  const mergePending = [];
  const reviewQueue = [];

  for (const rec of masterRecords) {
    // Look up the Stage 4 dup match
    const s4Match = stage4.find(s => s.business_name === rec.business_name && s.region === rec.region);
    const isDup = s4Match?._stage4?.is_duplicate_of_existing === true;
    const dupMatches = s4Match?._stage4?.cross_source_matches || [];

    if (isDup) {
      // Find the matched existing seed and produce a MERGE PLAN
      const primaryMatch = dupMatches[0];
      const existing = existingSeeds.find(e => e._existing_source === primaryMatch.existing);
      const mergePreview = existing ? mergeIntoExisting(existing, { ...rec, _merge_signals: dupMatches }) : null;
      mergePending.push({
        incoming: rec,
        matched_existing_source: primaryMatch.existing,
        match_signals: dupMatches,
        existing_record: existing,
        merged_preview: mergePreview,
      });
      continue;
    }

    const v = rec.internal_verification_state;
    if (v === 'FULLY_VERIFIED' || v === 'SERVICE_EVIDENCED') productionReady.push(rec);
    else reviewQueue.push(rec); // SEARCH_DISCOVERED, DIRECTLY_REACHABLE, no_url
  }

  console.log(`Production ready (A + B band, non-duplicate): ${productionReady.length}`);
  console.log(`Merge pending (cross-source duplicates): ${mergePending.length}`);
  console.log(`Manual review queue: ${reviewQueue.length}\n`);

  await writeFile(OUT_PRODUCTION, JSON.stringify(productionReady, null, 2));
  await writeFile(OUT_MERGE_PENDING, JSON.stringify(mergePending, null, 2));
  await writeFile(OUT_REVIEW, JSON.stringify(reviewQueue, null, 2));

  // ─── import plan (Stage 5B preview) ───

  const importPlan = {
    generated_at: '2026-08-15T00:00:00.000Z',
    dry_run: true,
    inserts: productionReady.map(r => ({
      slug: r.slug,
      business_name: r.business_name,
      business_type: r.business_type,
      category: r.category,
      internal_verification_state: r.internal_verification_state,
      customer_facing_label: r.customer_facing_label,
      claimed: false,
      verified: false, // Philip's language caution
      capabilities_count_yes: Object.values(r.capabilities).filter(v => v === 'yes').length,
    })),
    merges: mergePending.map(m => ({
      existing_source: m.matched_existing_source,
      incoming_business_name: m.incoming.business_name,
      match_signals: m.match_signals,
      existing_qualification: m.existing_record?.refacing_qualification,
      incoming_qualification: m.incoming.refacing_qualification,
      merged_business_type: m.merged_preview?.business_type,
      merged_capabilities_yes: m.merged_preview ? Object.values(m.merged_preview.capabilities || {}).filter(v => v === 'yes').length : null,
      existing_evidence_count: (m.existing_record?.refacing_evidence || []).length,
      merged_evidence_count: (m.merged_preview?.refacing_evidence || []).length,
    })),
    deferred_review: reviewQueue.map(r => ({
      slug: r.slug,
      business_name: r.business_name,
      internal_verification_state: r.internal_verification_state,
      reason: r.internal_verification_state === 'SEARCH_DISCOVERED' ? 'identity_not_confirmed_on_page' : (r.internal_verification_state === 'DIRECTLY_REACHABLE' ? 'no_capability_evidence_on_homepage' : 'other'),
    })),
    totals: {
      insert_count: productionReady.length,
      merge_count: mergePending.length,
      deferred_review_count: reviewQueue.length,
      total_covered: masterRecords.length,
    },
  };
  await writeFile(OUT_IMPORT_PLAN, JSON.stringify(importPlan, null, 2));

  // ─── report ───

  const agg = {
    inputs: {
      stage4_records: stage4.length,
      existing_seeds: existingSeeds.length,
    },
    master_records_built: masterRecords.length,
    production_ready: productionReady.length,
    merge_pending: mergePending.length,
    review_queue: reviewQueue.length,
    business_type_distribution: {},
    capabilities_yes_distribution: {},
    internal_verification_distribution: {},
    customer_facing_label_distribution: {},
    quality_band_distribution: { 'A': 0, 'B': 0, 'C': 0, 'null': 0 },
    by_region: {},
  };
  for (const r of masterRecords) {
    agg.business_type_distribution[r.business_type] = (agg.business_type_distribution[r.business_type] || 0) + 1;
    agg.internal_verification_distribution[r.internal_verification_state] = (agg.internal_verification_distribution[r.internal_verification_state] || 0) + 1;
    const lbl = r.customer_facing_label || '(none)';
    agg.customer_facing_label_distribution[lbl] = (agg.customer_facing_label_distribution[lbl] || 0) + 1;
    const q = r.refacing_qualification || 'null';
    agg.quality_band_distribution[q] = (agg.quality_band_distribution[q] || 0) + 1;
    if (r.region) agg.by_region[r.region] = (agg.by_region[r.region] || 0) + 1;
    for (const [k, v] of Object.entries(r.capabilities || {})) {
      if (v === 'yes') agg.capabilities_yes_distribution[k] = (agg.capabilities_yes_distribution[k] || 0) + 1;
    }
  }

  const md = renderReport(agg, productionReady, mergePending, reviewQueue, importPlan);
  await writeFile(OUT_MD, md);

  console.log('─── FILES WRITTEN ───');
  console.log(`  ${OUT_PRODUCTION}`);
  console.log(`  ${OUT_MERGE_PENDING}`);
  console.log(`  ${OUT_REVIEW}`);
  console.log(`  ${OUT_IMPORT_PLAN}`);
  console.log(`  ${OUT_MD}`);
  console.log('\n─── AGGREGATE ───');
  console.log(JSON.stringify(agg, null, 2));
}

function renderReport(agg, productionReady, mergePending, reviewQueue, importPlan) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 5A · Master Dataset (DRY-RUN)`);
  lines.push(``);
  lines.push(`_${agg.master_records_built} master records built · consolidated from ${agg.inputs.stage4_records} Stage 4 records + ${agg.inputs.existing_seeds} existing seeds · DRY-RUN · no Supabase writes · Stage 5B blocked pending review · 2026-08-15_`);
  lines.push(``);
  lines.push(`## Tier split`);
  lines.push(``);
  lines.push(`| Tier | Count | Notes |`);
  lines.push(`|---|---:|---|`);
  lines.push(`| **production_ready.json** | **${agg.production_ready}** | A + B band · non-duplicate · ready to INSERT |`);
  lines.push(`| **merge_pending.json** | **${agg.merge_pending}** | Cross-source duplicates · MERGE-preview per record · needs human decision |`);
  lines.push(`| **manual_review_queue.json** | **${agg.review_queue}** | SEARCH_DISCOVERED / DIRECTLY_REACHABLE only · preserved for review · NOT auto-imported |`);
  lines.push(``);
  lines.push(`## Two-dimension schema (Philip 2026-08-15)`);
  lines.push(``);
  lines.push(`Every master record carries TWO independent classification fields:`);
  lines.push(``);
  lines.push(`### 1. business_type (single value)`);
  lines.push(``);
  lines.push(`| business_type | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.business_type_distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`### 2. capabilities (multi-flag · "yes" count per capability)`);
  lines.push(``);
  lines.push(`| capability | Count with "yes" |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.capabilities_yes_distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Language discipline (Philip's "verified" caution)`);
  lines.push(``);
  lines.push(`Internal states are precise engineering labels. Customer-facing labels are softer until the company opts in.`);
  lines.push(``);
  lines.push(`| Internal state | Count | Customer-facing label |`);
  lines.push(`|---|---:|---|`);
  for (const [k, n] of Object.entries(agg.internal_verification_distribution).sort((a,b) => b[1]-a[1])) {
    let lbl = null;
    if (k === 'FULLY_VERIFIED') lbl = 'Business information checked';
    else if (k === 'SERVICE_EVIDENCED') lbl = 'Business information partially checked';
    lines.push(`| ${k} | ${n} | ${lbl || '_(no badge)_'} |`);
  }
  lines.push(``);
  lines.push(`> \`verified: true\` is set to \`false\` for every record in this tier. \`verified\` is reserved for CLAIMED+ companies — never applied to a company that hasn't opted into NEX.`);
  lines.push(``);
  lines.push(`## Stage 5B · Import plan preview`);
  lines.push(``);
  lines.push(`| Action | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| INSERT (new records to Supabase directory_seeds) | ${importPlan.totals.insert_count} |`);
  lines.push(`| MERGE (into existing legacy/refacing seeds) | ${importPlan.totals.merge_count} |`);
  lines.push(`| DEFERRED (preserved in review queue · not imported) | ${importPlan.totals.deferred_review_count} |`);
  lines.push(``);
  lines.push(`### First 10 INSERT preview`);
  lines.push(``);
  lines.push(`| Business | business_type | Category | Caps=yes | Cust-label |`);
  lines.push(`|---|---|---|---:|---|`);
  for (const i of importPlan.inserts.slice(0, 10)) {
    lines.push(`| ${i.business_name} | \`${i.business_type}\` | ${i.category} | ${i.capabilities_count_yes} | ${i.customer_facing_label || '_(none)_'} |`);
  }
  lines.push(``);
  lines.push(`### All ${importPlan.merges.length} MERGE previews (full detail)`);
  lines.push(``);
  lines.push(`| Existing source | Incoming | Match | Existing qual → Merged | Existing evid → Merged evid | Merged caps=yes |`);
  lines.push(`|---|---|---|---|---|---:|`);
  for (const m of importPlan.merges) {
    const signals = m.match_signals.map(s => s.signal).join(',');
    lines.push(`| \`${m.existing_source}\` | ${m.incoming_business_name} | ${signals} | ${m.existing_qualification || '—'} → ${m.merged_preview?.refacing_qualification || m.existing_qualification || '—'} | ${m.existing_evidence_count} → ${m.merged_evidence_count} | ${m.merged_capabilities_yes ?? '—'} |`);
  }
  lines.push(``);
  lines.push(`## Merge policy (existing wins · never overwrite stronger with weaker)`);
  lines.push(``);
  lines.push(`- Canonical fields (name, phone, email, address, postcode, website) — existing value never overwritten; only backfilled where existing is null`);
  lines.push(`- Capabilities — existing "yes" never downgraded; incoming "yes" adds; "unknown" backfilled where existing is undefined`);
  lines.push(`- Evidence items — appended + deduped by (url, category); both sources' evidence preserved`);
  lines.push(`- Qualification band — upgrade-only (A+ > A > B > C > D > excluded)`);
  lines.push(`- Tags — union of both sets`);
  lines.push(`- Provenance — merge_history array records every merge event`);
  lines.push(``);
  lines.push(`## Quality bands`);
  lines.push(``);
  lines.push(`| Band | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.quality_band_distribution).sort((a,b) => (b[1]-a[1]))) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Geographic distribution`);
  lines.push(``);
  lines.push(`| Region | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.by_region).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## What Stage 5A did NOT do`);
  lines.push(``);
  lines.push(`- Did not write to Supabase directory_seeds table`);
  lines.push(`- Did not run any HTTP requests (all consolidation from cached Stage 4 fetch results)`);
  lines.push(`- Did not contact any company`);
  lines.push(`- Did not delete or downgrade any Stage 4 record`);
  lines.push(`- Did not overwrite any existing seed field with a weaker value`);
  lines.push(`- Did not set \`verified: true\` on any unclaimed record`);
  lines.push(`- Did not touch NEX brain / M4 freeze`);
  lines.push(`- Did not start Stage 5B · blocked pending Philip's review of this dry-run`);
  lines.push(``);
  lines.push(`## Files produced`);
  lines.push(``);
  lines.push(`- \`production_ready.json\` — ${agg.production_ready} records ready to INSERT`);
  lines.push(`- \`merge_pending.json\` — ${agg.merge_pending} MERGE previews for review`);
  lines.push(`- \`manual_review_queue.json\` — ${agg.review_queue} records preserved for human review`);
  lines.push(`- \`stage5b-import-plan.json\` — full Supabase import plan preview`);
  lines.push(`- \`STAGE-5A-REPORT-2026-08-15.md\` — this report`);
  lines.push(``);
  lines.push(`## Ask · Stage 5B approval`);
  lines.push(``);
  lines.push(`On approval, Stage 5B will:`);
  lines.push(``);
  lines.push(`1. Backup existing Supabase directory_seeds (per migration-verification-protocol step 1)`);
  lines.push(`2. INSERT ${importPlan.totals.insert_count} new records (business_type + capabilities + customer_facing_label + full evidence trail)`);
  lines.push(`3. MERGE ${importPlan.totals.merge_count} incoming records into their matched existing seeds (existing wins · evidence appended · never overwrite stronger with weaker)`);
  lines.push(`4. Leave ${importPlan.totals.deferred_review_count} records in \`manual_review_queue.json\` (never imported)`);
  lines.push(`5. Emit post-import audit: row counts before/after + exceptions list`);
  lines.push(`6. Never contact any company`);
  lines.push(`7. Never set \`verified: true\` on any unclaimed record`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
