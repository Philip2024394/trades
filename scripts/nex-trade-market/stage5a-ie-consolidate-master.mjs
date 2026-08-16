// UK Staircase Trade Market · Stage 5A-IE · Ireland master dataset (DRY-RUN)
//
// Adapted from stage5a-consolidate-master.mjs (UK). Same schema shape and
// business_type classifier. Two disciplined differences from UK:
//
//   1. STRICTER CAPABILITY NORMALISATION (Philip 2026-08-16):
//      Ireland preserves Stage 2 claims in the evidence trail but does NOT
//      elevate them to capabilities.<cap>='yes' unless Stage 4 direct-fetch
//      confirmed. UK let claim-only records land as 'yes'; Ireland tightens
//      to preserve the distinction between "we saw them claim this" and
//      "we directly confirmed this on their page".
//
//   2. NO LEGACY-JSON CROSS-DEDUP:
//      UK had 223 pre-existing legacy JSON files to check against; Ireland
//      is a clean new country dataset. Cross-source dedup vs live UK 471
//      already ran in Stage 4-IE (0 hits). No re-check needed.
//
// Outputs to `data/directory-seeds/_staircase_ie_master/`:
//   · production_ready.json   · 40 A + 10 B = 50 records ready to INSERT
//   · manual_review_queue.json · 30 SEARCH_DISCOVERED + 7 DIRECTLY_REACHABLE = 37
//   · stage5b-ie-import-plan.json · full Supabase import plan preview
//   · STAGE-5A-IE-REPORT-2026-08-16.md · human-readable
//
// DRY-RUN. Does NOT write to Supabase. Stage 5B-IE requires:
//   (a) Philip's approval on this dry-run
//   (b) Migration 053 (drop region CHECK constraint) applied via Dashboard

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const STAGE4_JSON = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_stage2/stage4-ie-full-verified.json';

const MASTER_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_master';
const OUT_PRODUCTION = `${MASTER_DIR}/production_ready.json`;
const OUT_REVIEW = `${MASTER_DIR}/manual_review_queue.json`;
const OUT_IMPORT_PLAN = `${MASTER_DIR}/stage5b-ie-import-plan.json`;
const OUT_MD = `${MASTER_DIR}/STAGE-5A-IE-REPORT-2026-08-16.md`;

// ─── helpers ───

function toSlug(name, county) {
  const bits = [name, county].filter(Boolean).join('-');
  return bits.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function customerFacingLabel(verification) {
  if (verification === 'FULLY_VERIFIED') return 'Business information checked';
  if (verification === 'SERVICE_EVIDENCED') return 'Business information partially checked';
  return null;
}

// ─── STRICTER capability normalisation (Ireland · Philip 2026-08-16) ───
// UK let claim-only records land as 'yes' (which was too generous). Ireland
// tightens: only direct-evidence records earn 'yes'. Stage 2 claims that
// weren't directly confirmed stay as 'unknown' at the top-level capabilities
// field but are preserved in refacing_evidence[] for full audit trail.
//
// This is what protects the eventual Trade Centre filter accuracy: when a
// customer searches "refacing companies in Ireland", they get the 6 with
// direct evidence of refacing, not the 6 whose Stage 2 snippet mentioned it.
function normaliseCapabilitiesStrict(claimed, evidence) {
  const CAPS = ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal','bespoke','design','kit_or_product_supplier'];
  const out = {};
  for (const cap of CAPS) {
    const evPresent = evidence?.capabilities?.[cap]?.present === true;
    const evNegated = evidence?.capabilities?.[cap]?.explicit_negation != null;
    if (evNegated) out[cap] = 'no';
    else if (evPresent) out[cap] = 'yes';
    else out[cap] = 'unknown'; // claim-only cases stay 'unknown' · full claim in evidence trail
  }
  return out;
}

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
    default: return 'Multi-Service Staircase Company';
  }
}

function tagsFor(caps, evidenceClaimed) {
  const t = new Set();
  for (const [k, v] of Object.entries(caps)) if (v === 'yes') t.add(k.replace(/_/g, '-'));
  // Also add "claimed-but-unverified-X" tags for Stage-2 claims that weren't confirmed
  for (const [k, v] of Object.entries(evidenceClaimed || {})) {
    if (v === true && caps[k] !== 'yes' && caps[k] !== 'no') t.add(`claimed-unverified-${k.replace(/_/g, '-')}`);
  }
  return [...t];
}

function buildMasterRecord(stage4Record) {
  const s4 = stage4Record._stage4ie;
  const verification = s4.verification;
  const evidence = s4.evidence;
  const claimed = stage4Record.capabilities_claimed;

  // STRICT normalisation · claim-only stays 'unknown' at top level
  const caps = normaliseCapabilitiesStrict(claimed, evidence);
  const businessType = s4.business_group;
  const label = customerFacingLabel(verification);

  const evidenceItems = [];

  // Stage 2 discovery evidence (preserves original claims · full audit)
  evidenceItems.push({
    url: stage4Record.source_url || null,
    type: 'discovery_source',
    category: 'stage2_ie_discovery',
    summary: `Stage 2-IE agent ${stage4Record._agent} · claim shape: ${JSON.stringify(Object.entries(claimed || {}).filter(([, v]) => v === true).map(([k]) => k))} · evidence_notes: ${(stage4Record.evidence_notes || '').slice(0, 300)}`,
    checked_at: '2026-08-15',
    agent_source: stage4Record._agent,
    stage2_claimed_capabilities: Object.entries(claimed || {}).filter(([, v]) => v === true).map(([k]) => k),
  });

  // Stage 4 direct-fetch evidence
  if (s4.fetch?.ok && s4.identity_confirmed) {
    const capMatches = [];
    for (const [cap, ev] of Object.entries(evidence?.capabilities || {})) {
      if (ev.present) capMatches.push(`${cap}("${(ev.matched_phrase || '').slice(0, 40)}")`);
    }
    evidenceItems.push({
      url: s4.fetch.final_url || stage4Record.website,
      type: 'company_website',
      category: 'stage4_ie_direct_fetch',
      summary: `Direct-fetch HTTP ${s4.fetch.status} · identity confirmed · directly evidenced capabilities: ${capMatches.join(', ') || '(none)'} · materials: ${(evidence?.materials_mentioned || []).join(', ') || '(none)'}`,
      checked_at: '2026-08-16',
      http_status: s4.fetch.status,
      size_bytes: s4.fetch.size_bytes,
      directly_evidenced_capabilities: Object.entries(evidence?.capabilities || {}).filter(([, ev]) => ev.present).map(([k]) => k),
    });
  } else if (s4.fetch?.ok && !s4.identity_confirmed) {
    evidenceItems.push({
      url: s4.fetch.final_url || stage4Record.website,
      type: 'company_website_identity_unconfirmed',
      category: 'stage4_ie_direct_fetch',
      summary: `Direct-fetch HTTP ${s4.fetch.status} but page did not surface company name · possible JS-render / trading-name variance / Stage 2 snippet ambiguity`,
      checked_at: '2026-08-16',
      http_status: s4.fetch.status,
    });
  } else if (!s4.fetch?.ok) {
    evidenceItems.push({
      url: stage4Record.website,
      type: 'fetch_failed',
      category: 'stage4_ie_direct_fetch',
      summary: `Direct-fetch failed: ${s4.fetch?.error || 'unknown'}`,
      checked_at: '2026-08-16',
    });
  }

  // Preserved-but-unverified capability claims (Philip's discipline)
  const claimedNotEvidenced = Object.entries(claimed || {}).filter(([k, v]) => v === true && caps[k] !== 'yes' && caps[k] !== 'no').map(([k]) => k);
  if (claimedNotEvidenced.length > 0) {
    evidenceItems.push({
      url: null,
      type: 'stage2_claim_not_directly_evidenced',
      category: 'discipline_boundary',
      summary: `Stage 2-IE claimed but Stage 4-IE could not directly evidence: ${claimedNotEvidenced.join(', ')}. Preserved as claim · NOT elevated to capabilities.${claimedNotEvidenced[0]}='yes'. Review before promoting.`,
      checked_at: '2026-08-16',
      claims_pending_verification: claimedNotEvidenced,
    });
  }

  return {
    id: randomUUID(),
    slug: toSlug(stage4Record.business_name, stage4Record.county || stage4Record.town),
    business_name: stage4Record.business_name,
    category: categoryFor(businessType),
    primary_trade: primaryTradeFor(businessType),
    business_type: businessType,
    capabilities: caps,
    tags: tagsFor(caps, claimed),
    enrichment_status: 'partial',
    last_verified_at: '2026-08-16T00:00:00.000Z',
    address_line_1: null,
    address_line_2: null,
    town: stage4Record.town || null,
    county: stage4Record.county || null,
    postcode: stage4Record.postcode || null,
    country: 'Ireland',
    telephone: stage4Record.telephone || null,
    website: stage4Record.website || null,
    email: stage4Record.email || null,
    opening_hours: null,
    description: stage4Record.evidence_notes || null,
    services: [],
    google_rating: null,
    google_review_count: null,
    google_maps_url: null,
    latitude: null,
    longitude: null,
    status: 'listed',
    claimed: false,
    verified: false,
    visibility: 'public',
    photos: [],
    cover_image: null,
    source: 'philip_manual_seed', // matches existing CHECK constraint values
    imported_at: '2026-08-16T00:00:00.000Z',
    refacing_evidence: evidenceItems,
    refacing_qualification: verification === 'FULLY_VERIFIED' ? 'A' : (verification === 'SERVICE_EVIDENCED' ? 'B' : null),
    email_source: null,
    email_verified: false,
    email_checked_at: null,
    lifecycle_status: 'unclaimed',
    directory_state: 'listed',
    internal_verification_state: verification,
    customer_facing_label: label,
    region: stage4Record.county || null, // Ireland: region = county
    provenance: {
      discovered_by_agents: [stage4Record._agent].filter(Boolean),
      stage2_source_queries: [stage4Record.source_query].filter(Boolean),
      stage2_source_urls: [stage4Record.source_url].filter(Boolean),
      stage2_capabilities_claimed: claimed,
      stage2_evidence_notes: stage4Record.evidence_notes,
      stage4_direct_fetch: s4.fetch,
      stage4_identity_confirmed: s4.identity_confirmed,
      stage4_page_evidence_summary: evidence
        ? Object.fromEntries(Object.entries(evidence.capabilities).filter(([, v]) => v.present).map(([k, v]) => [k, v.matched_phrase]))
        : null,
      stage4_capability_comparison: s4.capability_comparison,
      claims_pending_verification: claimedNotEvidenced,
    },
  };
}

// ─── main ───

async function main() {
  await mkdir(MASTER_DIR, { recursive: true });

  console.log('Loading Stage 4-IE verified dataset...');
  const stage4 = JSON.parse(await readFile(STAGE4_JSON, 'utf8'));
  console.log(`  ${stage4.length} Irish records\n`);

  // Build master records
  const masterRecords = stage4.map(buildMasterRecord);
  console.log(`Built ${masterRecords.length} master records\n`);

  // Split into tiers
  const productionReady = [];
  const reviewQueue = [];
  for (const rec of masterRecords) {
    const v = rec.internal_verification_state;
    if (v === 'FULLY_VERIFIED' || v === 'SERVICE_EVIDENCED') productionReady.push(rec);
    else reviewQueue.push(rec);
  }

  console.log(`Production ready (A + B): ${productionReady.length}`);
  console.log(`Manual review queue: ${reviewQueue.length}\n`);

  await writeFile(OUT_PRODUCTION, JSON.stringify(productionReady, null, 2));
  await writeFile(OUT_REVIEW, JSON.stringify(reviewQueue, null, 2));

  // Import plan preview
  const importPlan = {
    generated_at: '2026-08-16T00:00:00.000Z',
    dry_run: true,
    schema_prerequisite: 'deploy/postgres/init/053_drop_region_check.sql must be applied first',
    inserts: productionReady.map(r => ({
      slug: r.slug,
      business_name: r.business_name,
      country: r.country,
      region: r.region,
      business_type: r.business_type,
      category: r.category,
      internal_verification_state: r.internal_verification_state,
      customer_facing_label: r.customer_facing_label,
      claimed: false,
      verified: false,
      capabilities_count_yes: Object.values(r.capabilities).filter(v => v === 'yes').length,
      claims_pending_verification: r.provenance?.claims_pending_verification || [],
    })),
    deferred_review: reviewQueue.map(r => ({
      slug: r.slug,
      business_name: r.business_name,
      county: r.county,
      internal_verification_state: r.internal_verification_state,
      reason: r.internal_verification_state === 'SEARCH_DISCOVERED' ? 'identity_not_confirmed' : 'no_capability_evidence',
    })),
    totals: {
      insert_count: productionReady.length,
      deferred_review_count: reviewQueue.length,
      total_covered: masterRecords.length,
    },
  };
  await writeFile(OUT_IMPORT_PLAN, JSON.stringify(importPlan, null, 2));

  // Aggregate
  const agg = {
    inputs: { stage4_records: stage4.length },
    master_records_built: masterRecords.length,
    production_ready: productionReady.length,
    review_queue: reviewQueue.length,
    business_type_distribution: {},
    capabilities_yes_distribution: {},
    claims_preserved_but_not_yes: {}, // Philip's discipline · claims kept in evidence, not elevated
    internal_verification_distribution: {},
    customer_facing_label_distribution: {},
    quality_band_distribution: { A: 0, B: 0, null: 0 },
    by_county: {},
  };
  for (const r of masterRecords) {
    agg.business_type_distribution[r.business_type] = (agg.business_type_distribution[r.business_type] || 0) + 1;
    agg.internal_verification_distribution[r.internal_verification_state] = (agg.internal_verification_distribution[r.internal_verification_state] || 0) + 1;
    const lbl = r.customer_facing_label || '(none)';
    agg.customer_facing_label_distribution[lbl] = (agg.customer_facing_label_distribution[lbl] || 0) + 1;
    const q = r.refacing_qualification || 'null';
    agg.quality_band_distribution[q] = (agg.quality_band_distribution[q] || 0) + 1;
    if (r.county) agg.by_county[r.county] = (agg.by_county[r.county] || 0) + 1;
    for (const [k, v] of Object.entries(r.capabilities || {})) {
      if (v === 'yes') agg.capabilities_yes_distribution[k] = (agg.capabilities_yes_distribution[k] || 0) + 1;
    }
    for (const c of (r.provenance?.claims_pending_verification || [])) {
      agg.claims_preserved_but_not_yes[c] = (agg.claims_preserved_but_not_yes[c] || 0) + 1;
    }
  }

  const md = renderReport(agg, productionReady, reviewQueue, importPlan);
  await writeFile(OUT_MD, md);

  console.log('─── FILES WRITTEN ───');
  console.log(`  ${OUT_PRODUCTION}`);
  console.log(`  ${OUT_REVIEW}`);
  console.log(`  ${OUT_IMPORT_PLAN}`);
  console.log(`  ${OUT_MD}`);
  console.log('\n─── AGGREGATE ───');
  console.log(JSON.stringify(agg, null, 2));
}

function renderReport(agg, productionReady, reviewQueue, importPlan) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 5A-IE · Ireland Master Dataset (DRY-RUN)`);
  lines.push(``);
  lines.push(`_${agg.master_records_built} Irish master records built from ${agg.inputs.stage4_records} Stage 4-IE records · DRY-RUN · no Supabase writes · Stage 5B-IE blocked pending review + migration 053 · 2026-08-16_`);
  lines.push(``);
  lines.push(`## Tier split`);
  lines.push(``);
  lines.push(`| Tier | Count | Notes |`);
  lines.push(`|---|---:|---|`);
  lines.push(`| **production_ready.json** | **${agg.production_ready}** | A + B band · ready to INSERT with country='Ireland' |`);
  lines.push(`| **manual_review_queue.json** | **${agg.review_queue}** | SEARCH_DISCOVERED / DIRECTLY_REACHABLE · preserved · NOT auto-imported |`);
  lines.push(``);
  lines.push(`## Stricter capability discipline (Philip 2026-08-16)`);
  lines.push(``);
  lines.push(`Unlike UK Stage 5A (which let claim-only records land as capabilities.<cap>='yes'), Ireland enforces: **only direct-evidenced capabilities earn 'yes' at the top level. Stage 2 claims that weren't directly confirmed stay as 'unknown' but are preserved in the evidence trail.**`);
  lines.push(``);
  lines.push(`### Capabilities with direct evidence ('yes' at top level)`);
  lines.push(``);
  lines.push(`| Capability | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.capabilities_yes_distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`### Capabilities claimed in Stage 2 but not directly confirmed (preserved in evidence · NOT elevated to 'yes')`);
  lines.push(``);
  lines.push(`| Capability | Claims preserved |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.claims_preserved_but_not_yes).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`> Trade Centre filters for "who does refacing" will surface only the directly-evidenced ones. Admins reviewing individual records still see the Stage 2 claim in the evidence trail.`);
  lines.push(``);
  lines.push(`## Business type distribution`);
  lines.push(``);
  lines.push(`| business_type | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.business_type_distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Language discipline`);
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
  lines.push(`> \`verified: true\` and \`claimed: true\` set to \`false\` on every record.`);
  lines.push(``);
  lines.push(`## Geographic distribution`);
  lines.push(``);
  lines.push(`| County | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.by_county).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Stage 5B-IE import plan preview`);
  lines.push(``);
  lines.push(`**PREREQUISITE:** apply \`deploy/postgres/init/053_drop_region_check.sql\` via Supabase Dashboard first (drops the UK-only region CHECK · scales to Germany/USA/etc.).`);
  lines.push(``);
  lines.push(`| Action | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| INSERT (new records with country='Ireland') | ${importPlan.totals.insert_count} |`);
  lines.push(`| MERGE (into existing rows) | 0 (Ireland has no legacy) |`);
  lines.push(`| DEFERRED (preserved in review queue · not imported) | ${importPlan.totals.deferred_review_count} |`);
  lines.push(``);
  lines.push(`### Post-import commercial inventory`);
  lines.push(``);
  lines.push(`| Market | Production listings |`);
  lines.push(`|---|---:|`);
  lines.push(`| 🇬🇧 United Kingdom | 471 |`);
  lines.push(`| 🇮🇪 Ireland | ${importPlan.totals.insert_count} (after 5B-IE) |`);
  lines.push(`| **Total** | **${471 + importPlan.totals.insert_count}** |`);
  lines.push(``);
  lines.push(`## What Stage 5A-IE did NOT do`);
  lines.push(``);
  lines.push(`- Did NOT write to Supabase directory_seeds table`);
  lines.push(`- Did NOT modify any UK 471 records (they remain frozen)`);
  lines.push(`- Did NOT contact any Irish company`);
  lines.push(`- Did NOT elevate Stage 2 claims to capabilities='yes' without Stage 4 direct evidence`);
  lines.push(`- Did NOT set \`verified: true\` on any record`);
  lines.push(`- Did NOT touch NEX brain / M4 freeze`);
  lines.push(`- Did NOT start Stage 5B-IE · blocked pending Philip's review + migration 053 apply`);
  lines.push(``);
  lines.push(`## Files produced`);
  lines.push(``);
  lines.push(`- \`production_ready.json\` — ${agg.production_ready} records ready to INSERT`);
  lines.push(`- \`manual_review_queue.json\` — ${agg.review_queue} records preserved`);
  lines.push(`- \`stage5b-ie-import-plan.json\` — full Supabase import plan preview`);
  lines.push(`- \`STAGE-5A-IE-REPORT-2026-08-16.md\` — this report`);
  lines.push(``);
  lines.push(`## Ask · Stage 5B-IE approval`);
  lines.push(``);
  lines.push(`On approval, Stage 5B-IE will:`);
  lines.push(`1. Verify migration 053 (drop region CHECK) is applied`);
  lines.push(`2. Backup current 471 UK production rows (per migration protocol)`);
  lines.push(`3. Preflight: validate all 50 IE inserts · no slug/domain collisions with UK`);
  lines.push(`4. INSERT ${importPlan.totals.insert_count} Irish records with country='Ireland' · claimed=false · verified=false · lifecycle_status='unclaimed' · directory_state='listed'`);
  lines.push(`5. Emit before/after row counts + reconciliation (INSERTED · DEFERRED · EXCEPTION)`);
  lines.push(`6. Never contact any Irish company`);
  lines.push(`7. Never modify any UK 471 record`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
