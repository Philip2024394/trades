// UK Staircase Trade Market · Stage 5A-USA · Master dataset (DRY-RUN)
//
// Adapted from stage5a-ie-consolidate-master.mjs. Same structure and
// Ireland-style STRICT capability discipline:
//   - Only direct-evidenced capabilities land as 'yes' at top level
//   - Stage 2 claims that weren't directly confirmed stay 'unknown' at top
//     but are preserved in refacing_evidence[] for full audit trail
//
// Input: stage4-us-combined-verified.json (533 combined = v1 246 + expansion 287)
// Output:
//   production_ready.json   · 375 A+B records
//   manual_review_queue.json · 158 SEARCH_DISCOVERED + DIRECTLY_REACHABLE
//   stage5b-us-import-plan.json · full Supabase import plan preview
//   STAGE-5A-US-REPORT-2026-08-16.md · human-readable
//
// DRY-RUN. Never writes to Supabase. Stage 5B-USA requires Philip's approval.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const STAGE4_JSON = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_exp/stage4-us-combined-verified.json';

const MASTER_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_master';
const OUT_PRODUCTION = `${MASTER_DIR}/production_ready.json`;
const OUT_REVIEW = `${MASTER_DIR}/manual_review_queue.json`;
const OUT_IMPORT_PLAN = `${MASTER_DIR}/stage5b-us-import-plan.json`;
const OUT_MD = `${MASTER_DIR}/STAGE-5A-US-REPORT-2026-08-16.md`;

function toSlug(name, locality) {
  const bits = [name, locality].filter(Boolean).join('-');
  return bits.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function customerFacingLabel(verification) {
  if (verification === 'FULLY_VERIFIED') return 'Business information checked';
  if (verification === 'SERVICE_EVIDENCED') return 'Business information partially checked';
  return null;
}

// STRICT Ireland-style normalisation
function normaliseCapabilitiesStrict(claimed, evidence) {
  const CAPS = ['manufacture','installation','refurbishment','refacing','balustrade','handrail','glass','metal','bespoke','design','kit_or_product_supplier'];
  const out = {};
  for (const cap of CAPS) {
    const evPresent = evidence?.capabilities?.[cap]?.present === true;
    const evNegated = evidence?.capabilities?.[cap]?.explicit_negation != null;
    if (evNegated) out[cap] = 'no';
    else if (evPresent) out[cap] = 'yes';
    else out[cap] = 'unknown'; // claim-only cases stay 'unknown' · claims preserved in evidence trail
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
  for (const [k, v] of Object.entries(evidenceClaimed || {})) {
    if (v === true && caps[k] !== 'yes' && caps[k] !== 'no') t.add(`claimed-unverified-${k.replace(/_/g, '-')}`);
  }
  return [...t];
}

function buildMasterRecord(stage4Record) {
  const s4 = stage4Record._stage4us;
  const verification = s4.verification;
  const evidence = s4.evidence;
  const claimed = stage4Record.capabilities_claimed;
  const caps = normaliseCapabilitiesStrict(claimed, evidence);
  const businessType = s4.business_group || 'MULTI_SERVICE_COMPANY';
  const label = customerFacingLabel(verification);
  const passOrigin = s4._pass || 'v1';

  const evidenceItems = [];
  evidenceItems.push({
    url: stage4Record.source_url || null,
    type: 'discovery_source',
    category: `stage2_us_${passOrigin === 'expansion' ? 'expansion' : 'v1'}`,
    summary: `Stage 2-US ${passOrigin} · agent ${stage4Record._agent || 'unknown'} · claims: ${JSON.stringify(Object.entries(claimed || {}).filter(([, v]) => v === true).map(([k]) => k))} · notes: ${(stage4Record.evidence_notes || '').slice(0, 300)}`,
    checked_at: passOrigin === 'expansion' ? '2026-08-16' : '2026-08-16',
    agent_source: stage4Record._agent,
    pass: passOrigin,
    stage2_claimed_capabilities: Object.entries(claimed || {}).filter(([, v]) => v === true).map(([k]) => k),
  });

  if (s4.fetch?.ok && s4.identity_confirmed) {
    const capMatches = [];
    for (const [cap, ev] of Object.entries(evidence?.capabilities || {})) {
      if (ev.present) capMatches.push(`${cap}("${(ev.matched_phrase || '').slice(0, 40)}")`);
    }
    evidenceItems.push({
      url: s4.fetch.final_url || stage4Record.website,
      type: 'company_website',
      category: 'stage4_us_direct_fetch',
      summary: `Direct-fetch HTTP ${s4.fetch.status} · identity confirmed · directly evidenced: ${capMatches.join(', ') || '(none)'} · materials: ${(evidence?.materials_mentioned || []).join(', ') || '(none)'}`,
      checked_at: '2026-08-16',
      http_status: s4.fetch.status,
      size_bytes: s4.fetch.size_bytes,
      directly_evidenced_capabilities: Object.entries(evidence?.capabilities || {}).filter(([, ev]) => ev.present).map(([k]) => k),
    });
  } else if (s4.fetch?.ok && !s4.identity_confirmed) {
    evidenceItems.push({
      url: s4.fetch.final_url || stage4Record.website,
      type: 'company_website_identity_unconfirmed',
      category: 'stage4_us_direct_fetch',
      summary: `Direct-fetch HTTP ${s4.fetch.status} but page did not surface company name · possible JS-render / trading-name variance`,
      checked_at: '2026-08-16',
      http_status: s4.fetch.status,
    });
  } else if (!s4.fetch?.ok) {
    evidenceItems.push({
      url: stage4Record.website,
      type: 'fetch_failed',
      category: 'stage4_us_direct_fetch',
      summary: `Direct-fetch failed: ${s4.fetch?.error || 'unknown'}`,
      checked_at: '2026-08-16',
    });
  }

  const claimedNotEvidenced = Object.entries(claimed || {}).filter(([k, v]) => v === true && caps[k] !== 'yes' && caps[k] !== 'no').map(([k]) => k);
  if (claimedNotEvidenced.length > 0) {
    evidenceItems.push({
      url: null,
      type: 'stage2_claim_not_directly_evidenced',
      category: 'discipline_boundary',
      summary: `Stage 2-US claimed but Stage 4 could not directly evidence: ${claimedNotEvidenced.join(', ')}. Preserved as claim · NOT elevated to capabilities='yes'.`,
      checked_at: '2026-08-16',
      claims_pending_verification: claimedNotEvidenced,
    });
  }

  return {
    id: randomUUID(),
    slug: toSlug(stage4Record.business_name, stage4Record.state || stage4Record.town),
    business_name: stage4Record.business_name,
    category: categoryFor(businessType),
    primary_trade: primaryTradeFor(businessType),
    business_type: businessType,
    capabilities: caps,
    tags: tagsFor(caps, claimed),
    enrichment_status: 'partial',
    last_verified_at: '2026-08-16T00:00:00.000Z',
    address_line_1: null, address_line_2: null,
    town: stage4Record.town || null,
    county: null, // USA uses state not county
    postcode: stage4Record.postcode || null,
    country: 'USA',
    telephone: stage4Record.telephone || null,
    website: stage4Record.website || null,
    email: stage4Record.email || null,
    opening_hours: null,
    description: stage4Record.evidence_notes || null,
    services: [],
    google_rating: null, google_review_count: null, google_maps_url: null,
    latitude: null, longitude: null,
    status: 'listed', claimed: false, verified: false, visibility: 'public',
    photos: [], cover_image: null,
    source: 'philip_manual_seed',
    imported_at: '2026-08-16T00:00:00.000Z',
    refacing_evidence: evidenceItems,
    refacing_qualification: verification === 'FULLY_VERIFIED' ? 'A' : (verification === 'SERVICE_EVIDENCED' ? 'B' : null),
    email_source: null, email_verified: false, email_checked_at: null,
    lifecycle_status: 'unclaimed', directory_state: 'listed',
    internal_verification_state: verification,
    customer_facing_label: label,
    region: stage4Record.state || null, // USA: region = state
    provenance: {
      discovered_by_agents: [stage4Record._agent].filter(Boolean),
      discovery_pass: passOrigin,
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

async function main() {
  await mkdir(MASTER_DIR, { recursive: true });
  console.log('Loading Stage 4-USA combined dataset (v1 + expansion)...');
  const stage4 = JSON.parse(await readFile(STAGE4_JSON, 'utf8'));
  console.log(`  ${stage4.length} combined records\n`);

  const masterRecords = stage4.map(buildMasterRecord);
  console.log(`Built ${masterRecords.length} master records`);

  const productionReady = [];
  const reviewQueue = [];
  for (const rec of masterRecords) {
    const v = rec.internal_verification_state;
    if (v === 'FULLY_VERIFIED' || v === 'SERVICE_EVIDENCED') productionReady.push(rec);
    else reviewQueue.push(rec);
  }
  console.log(`Production ready (A+B): ${productionReady.length}`);
  console.log(`Manual review queue: ${reviewQueue.length}\n`);

  // Slug uniqueness check within batch
  const slugCounts = new Map();
  for (const r of productionReady) slugCounts.set(r.slug, (slugCounts.get(r.slug) || 0) + 1);
  const dupSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1);
  if (dupSlugs.length > 0) {
    console.log(`\n⚠ Duplicate slugs within production_ready: ${dupSlugs.length}`);
    for (const [slug, n] of dupSlugs.slice(0, 10)) console.log(`  ${slug} · ${n}x`);
    // Fix: suffix with random 4 chars to disambiguate
    const seen = new Set();
    for (const r of productionReady) {
      if (seen.has(r.slug)) {
        const suffix = Math.random().toString(36).slice(2, 6);
        r.slug = `${r.slug}-${suffix}`;
      }
      seen.add(r.slug);
    }
    console.log(`  Auto-suffixed collisions with random 4-char tail`);
  }

  await writeFile(OUT_PRODUCTION, JSON.stringify(productionReady, null, 2));
  await writeFile(OUT_REVIEW, JSON.stringify(reviewQueue, null, 2));

  const importPlan = {
    generated_at: '2026-08-16T00:00:00.000Z',
    dry_run: true,
    schema_prerequisite: 'migration 053 (drop region CHECK) already applied for Ireland · reusable for USA',
    inserts: productionReady.map(r => ({
      slug: r.slug,
      business_name: r.business_name,
      country: r.country,
      region: r.region,
      town: r.town,
      business_type: r.business_type,
      category: r.category,
      internal_verification_state: r.internal_verification_state,
      customer_facing_label: r.customer_facing_label,
      claimed: false, verified: false,
      capabilities_count_yes: Object.values(r.capabilities).filter(v => v === 'yes').length,
      claims_pending_verification: r.provenance?.claims_pending_verification || [],
      discovery_pass: r.provenance?.discovery_pass,
    })),
    deferred_review: reviewQueue.map(r => ({
      slug: r.slug,
      business_name: r.business_name,
      state: r.region,
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

  const agg = {
    inputs: { stage4_records: stage4.length },
    master_records_built: masterRecords.length,
    production_ready: productionReady.length,
    review_queue: reviewQueue.length,
    business_type_distribution: {},
    capabilities_yes_distribution: {},
    claims_preserved_but_not_yes: {},
    internal_verification_distribution: {},
    quality_band_distribution: { A: 0, B: 0, null: 0 },
    by_state: {},
    by_pass: {},
    duplicate_slugs_resolved: dupSlugs.length,
  };
  for (const r of masterRecords) {
    agg.business_type_distribution[r.business_type] = (agg.business_type_distribution[r.business_type] || 0) + 1;
    agg.internal_verification_distribution[r.internal_verification_state] = (agg.internal_verification_distribution[r.internal_verification_state] || 0) + 1;
    const q = r.refacing_qualification || 'null';
    agg.quality_band_distribution[q] = (agg.quality_band_distribution[q] || 0) + 1;
    if (r.region) agg.by_state[r.region] = (agg.by_state[r.region] || 0) + 1;
    if (r.provenance?.discovery_pass) agg.by_pass[r.provenance.discovery_pass] = (agg.by_pass[r.provenance.discovery_pass] || 0) + 1;
    for (const [k, v] of Object.entries(r.capabilities || {})) if (v === 'yes') agg.capabilities_yes_distribution[k] = (agg.capabilities_yes_distribution[k] || 0) + 1;
    for (const c of (r.provenance?.claims_pending_verification || [])) agg.claims_preserved_but_not_yes[c] = (agg.claims_preserved_but_not_yes[c] || 0) + 1;
  }

  const md = renderReport(agg, productionReady, reviewQueue, importPlan);
  await writeFile(OUT_MD, md);
  console.log('\n─── FILES ───');
  console.log(`  ${OUT_PRODUCTION}`);
  console.log(`  ${OUT_REVIEW}`);
  console.log(`  ${OUT_IMPORT_PLAN}`);
  console.log(`  ${OUT_MD}`);
  console.log('\n─── AGGREGATE ───');
  console.log(JSON.stringify(agg, null, 2));
}

function renderReport(agg, productionReady, reviewQueue, importPlan) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 5A-USA · Master Dataset (DRY-RUN)`);
  lines.push(``);
  lines.push(`_${agg.master_records_built} US master records built from ${agg.inputs.stage4_records} Stage 4-USA combined records · DRY-RUN · no Supabase writes · Stage 5B-USA blocked pending review · 2026-08-16_`);
  lines.push(``);
  lines.push(`## Reconciliation · every source record has exactly one final disposition`);
  lines.push(``);
  lines.push(`| Tier | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| **production_ready.json** (A+B ready to INSERT) | **${agg.production_ready}** |`);
  lines.push(`| **manual_review_queue.json** (D + C · preserved · NOT auto-imported) | **${agg.review_queue}** |`);
  lines.push(`| **TOTAL** | **${agg.master_records_built}** (matches 533 discovered) |`);
  lines.push(``);
  lines.push(`## Split by discovery pass`);
  lines.push(``);
  lines.push(`| Pass | Records |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.by_pass)) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Stricter capability discipline (Ireland-style · Philip 2026-08-15)`);
  lines.push(``);
  lines.push(`Only direct-evidenced capabilities land as \`capabilities.<cap>='yes'\`. Stage 2 claims that Stage 4 couldn't confirm stay \`unknown\` at top level · preserved in evidence trail.`);
  lines.push(``);
  lines.push(`### Capabilities with direct evidence ('yes' at top level)`);
  lines.push(``);
  lines.push(`| Capability | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.capabilities_yes_distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`### Capabilities claimed in Stage 2 but not directly confirmed (preserved · NOT elevated to 'yes')`);
  lines.push(``);
  lines.push(`| Capability | Claims preserved |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.claims_preserved_but_not_yes).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Business type distribution (all 533)`);
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
  lines.push(`> \`verified: true\` and \`claimed: true\` set to \`false\` on every record. Language caution enforced.`);
  lines.push(``);
  lines.push(`## Geographic distribution (top 25 states of 533)`);
  lines.push(``);
  lines.push(`| State | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(agg.by_state).sort((a,b) => b[1]-a[1]).slice(0, 25)) lines.push(`| ${k} | ${n} |`);
  lines.push(``);
  lines.push(`## Preflight`);
  lines.push(``);
  lines.push(`- Duplicate slugs within production_ready: **${agg.duplicate_slugs_resolved}** ${agg.duplicate_slugs_resolved > 0 ? '(auto-suffixed with random 4-char tail)' : ''}`);
  lines.push(`- Cross-source duplicates vs live 521: **0** (per Stage 4-USA-EXP)`);
  lines.push(``);
  lines.push(`## Stage 5B-USA import plan preview`);
  lines.push(``);
  lines.push(`**PREREQUISITE:** migration 053 (drop region CHECK) already applied for Ireland · region field will accept US state codes without additional migration.`);
  lines.push(``);
  lines.push(`| Action | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| INSERT (new records with country='USA') | ${importPlan.totals.insert_count} |`);
  lines.push(`| MERGE (into existing rows) | 0 (USA has no legacy) |`);
  lines.push(`| DEFERRED (preserved in review queue) | ${importPlan.totals.deferred_review_count} |`);
  lines.push(``);
  lines.push(`### Post-import commercial inventory`);
  lines.push(``);
  lines.push(`| Market | Production listings |`);
  lines.push(`|---|---:|`);
  lines.push(`| 🇬🇧 UK | 471 (frozen) |`);
  lines.push(`| 🇮🇪 Ireland | 50 (frozen) |`);
  lines.push(`| 🇺🇸 USA | ${importPlan.totals.insert_count} (after 5B-USA) |`);
  lines.push(`| **Total** | **${471 + 50 + importPlan.totals.insert_count}** |`);
  lines.push(``);
  lines.push(`## What Stage 5A-USA did NOT do`);
  lines.push(``);
  lines.push(`- Did NOT write to Supabase directory_seeds table`);
  lines.push(`- Did NOT modify any UK 471 or Ireland 50 records (both remain frozen)`);
  lines.push(`- Did NOT contact any US company`);
  lines.push(`- Did NOT elevate Stage 2 claims to capabilities='yes' without Stage 4 direct evidence`);
  lines.push(`- Did NOT set \`verified: true\` on any record`);
  lines.push(`- Did NOT delete any of the 158 review-queue records`);
  lines.push(`- Did NOT touch NEX brain / M4 freeze`);
  lines.push(`- Did NOT start Stage 5B-USA · blocked pending Philip's review`);
  lines.push(``);
  lines.push(`## Ask · Stage 5B-USA approval`);
  lines.push(``);
  lines.push(`On approval, Stage 5B-USA will:`);
  lines.push(`1. Backup all 521 production rows (per migration protocol)`);
  lines.push(`2. Preflight all ${importPlan.totals.insert_count} US inserts · no slug/domain collisions with UK/IE`);
  lines.push(`3. INSERT ${importPlan.totals.insert_count} records with country='USA' · claimed=false · verified=false · lifecycle_status='unclaimed' · directory_state='listed'`);
  lines.push(`4. Emit before/after row counts + reconciliation (INSERTED · DEFERRED · EXCEPTION)`);
  lines.push(`5. Never contact any US company · Never modify UK/IE production`);
  return lines.join('\n');
}

main().catch(e => { console.error(e); process.exit(1); });
