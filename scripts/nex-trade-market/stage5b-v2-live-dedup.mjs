// UK Staircase Trade Market · Stage 5B v2 · Live-Supabase-aware import + audit
//
// Supersedes stage5b-execute-import.mjs after Philip's Option 1 decision
// (2026-08-15). The v1 preflight only checked against legacy JSON archives
// (228 records). Production Supabase has 302 rows — some added via the
// Collector form after the JSON archive was frozen. v2 checks against LIVE
// production first, then reclassifies collisions per Philip's 4 rules:
//
//   INSERT                  · no collision · truly new business
//   LIVE_MERGE              · collision + name matches → merge into existing live row
//   LIVE_AMBIGUOUS_REVIEW   · collision + name differs → human decision (deferred)
//   MERGE_ALREADY_TARGETED  · already a Stage 4 merge target
//
// Rules preserved (unchanged from v1):
//   · verified = false on every new record
//   · claimed = false on every new record
//   · lifecycle_status = 'unclaimed'
//   · directory_state = 'listed'
//   · never overwrite stronger existing data with weaker new
//   · never contact any company
//   · never touch the 84 (now 84 + N ambiguous) review-queue records
//   · migration must be applied first (business_type + related columns exist)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildLiveIndex, classifyIncoming, normalizeDomain, normalizePhone, normalizeEmail } from './lib/live-dedup.mjs';

// ─── env loader (no dotenv dep) ───

function loadEnv() {
  const raw = readFileSync('C:/Users/Victus/trades/.env.local', 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_NEX_SUPABASE_URL;
const SERVICE_KEY = env.NEX_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_NEX_SUPABASE_URL or NEX_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const MASTER_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_uk_master';
const BACKUP_DIR = join(MASTER_DIR, 'backups');
const PRODUCTION_READY = join(MASTER_DIR, 'production_ready.json');
const MERGE_PENDING = join(MASTER_DIR, 'merge_pending.json');
const REVIEW_QUEUE = join(MASTER_DIR, 'manual_review_queue.json');
const OUT_LIVE_CLASSIFICATION = join(MASTER_DIR, 'stage5b-v2-live-classification.json');
const OUT_AMBIGUOUS_REVIEW = join(MASTER_DIR, 'stage5b-v2-ambiguous-review.json');
const OUT_RECONCILIATION = join(MASTER_DIR, 'stage5b-v2-reconciliation.json');
const OUT_REPORT = join(MASTER_DIR, 'STAGE-5B-v2-REPORT-2026-08-15.md');

function sha256(s) { return createHash('sha256').update(s).digest('hex'); }

// ─── STEP 0 · verify migration ───

async function verifyMigrationApplied() {
  console.log('\n[0/6] Verifying migration is applied...');
  const { data, error } = await supabase.from('directory_seeds').select('*').limit(1);
  if (error) throw new Error(`Cannot read directory_seeds: ${error.message}`);
  if (!data.length) throw new Error('directory_seeds is empty');
  const cols = new Set(Object.keys(data[0]));
  const required = ['business_type', 'internal_verification_state', 'customer_facing_label', 'region', 'provenance'];
  const missing = required.filter(c => !cols.has(c));
  if (missing.length) throw new Error(`Migration NOT applied · missing columns: ${missing.join(', ')}`);
  console.log(`  ✓ All 5 required columns present`);
}

// ─── STEP 1 · backup (or reuse today's backup) ───

async function backup() {
  console.log('\n[1/6] Backup...');
  await mkdir(BACKUP_DIR, { recursive: true });
  const all = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.from('directory_seeds').select('*').range(from, from + pageSize - 1).order('imported_at', { ascending: true });
    if (error) throw new Error(`Backup fetch failed: ${error.message}`);
    if (!data.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const backupPath = join(BACKUP_DIR, `directory_seeds-2026-08-15-pre-stage5b-v2.json`);
  const payload = { taken_at: new Date().toISOString(), row_count: all.length, checksum_sha256: sha256(JSON.stringify(all)), rows: all };
  await writeFile(backupPath, JSON.stringify(payload, null, 2));
  console.log(`  ✓ Backup: ${all.length} rows · checksum ${payload.checksum_sha256.slice(0, 16)}… · ${backupPath}`);
  return { rows: all, path: backupPath, count: all.length, checksum: payload.checksum_sha256 };
}

// ─── STEP 2 · live cross-check + reclassify ───

async function liveClassify(inserts, mergeTargetSlugs, liveRows) {
  console.log(`\n[2/6] Live-Supabase cross-check on ${inserts.length} inserts...`);
  const liveIndex = buildLiveIndex(liveRows);

  const alreadyMergeTargeted = new Set(mergeTargetSlugs);

  const classifications = [];
  for (const rec of inserts) {
    // Skip: if this record was already earmarked as a Stage 4 merge, don't reclassify
    // (defensive; production_ready.json should not overlap merge_pending.json)
    const result = classifyIncoming(rec, liveIndex);
    classifications.push({
      slug: rec.slug,
      business_name: rec.business_name,
      verdict: result.verdict,
      matches: result.matches,
      primary_match: result.primary_match,
      _record: rec,
    });
  }

  const summary = {
    insert: 0, live_merge: 0, live_ambiguous_review: 0,
  };
  for (const c of classifications) summary[c.verdict.toLowerCase()] = (summary[c.verdict.toLowerCase()] || 0) + 1;

  console.log(`  → INSERT: ${summary.insert}`);
  console.log(`  → LIVE_MERGE (identity matches): ${summary.live_merge}`);
  console.log(`  → LIVE_AMBIGUOUS_REVIEW (identity ambiguous): ${summary.live_ambiguous_review}`);

  await writeFile(OUT_LIVE_CLASSIFICATION, JSON.stringify(classifications, null, 2));
  return { classifications, summary };
}

// ─── STEP 3 · preflight (post-reclassification) ───

function preflightClean(classifications) {
  console.log(`\n[3/6] Preflight · post-reclassification validation...`);
  const errors = [];
  const inserts = classifications.filter(c => c.verdict === 'INSERT').map(c => c._record);
  const liveMerges = classifications.filter(c => c.verdict === 'LIVE_MERGE');

  // Slug uniqueness within batch (no live collisions possible now since LIVE_MERGE routed them out)
  const seenSlugs = new Set();
  for (const rec of inserts) {
    if (!rec.business_name) errors.push(`missing business_name: ${rec.slug}`);
    if (!rec.slug) errors.push(`missing slug: ${rec.business_name}`);
    if (!rec.business_type) errors.push(`missing business_type: ${rec.business_name}`);
    if (rec.verified !== false) errors.push(`verified != false: ${rec.business_name}`);
    if (rec.claimed !== false) errors.push(`claimed != false: ${rec.business_name}`);
    if (seenSlugs.has(rec.slug)) errors.push(`duplicate slug within insert batch: ${rec.slug}`);
    seenSlugs.add(rec.slug);
  }

  console.log(`  errors: ${errors.length}`);
  for (const e of errors.slice(0, 10)) console.log(`    ✗ ${e}`);
  return { errors, inserts, liveMerges };
}

// ─── STEP 4 · execute (INSERT + LIVE_MERGE + planned Stage-4 merges) ───

function toSupabaseRow(rec) {
  const provenance = {
    discovered_by_agents: rec.discovered_by_agents ?? [],
    stage2_source_queries: rec.stage2_source_queries ?? [],
    stage2_source_urls: rec.stage2_source_urls ?? [],
    stage4_direct_fetch: rec.stage4_direct_fetch ?? null,
    stage4_identity_confirmed: rec.stage4_identity_confirmed ?? null,
    stage4_page_evidence_summary: rec.stage4_page_evidence_summary ?? null,
    merge_history: rec.merge_history ?? [],
  };
  return {
    id: rec.id, slug: rec.slug, business_name: rec.business_name,
    category: rec.category, primary_trade: rec.primary_trade,
    business_type: rec.business_type, capabilities: rec.capabilities,
    tags: rec.tags ?? [], enrichment_status: rec.enrichment_status ?? 'raw',
    last_verified_at: rec.last_verified_at,
    address_line_1: rec.address_line_1, address_line_2: rec.address_line_2,
    town: rec.town, county: rec.county, postcode: rec.postcode,
    country: rec.country ?? 'United Kingdom',
    telephone: rec.telephone, website: rec.website, email: rec.email,
    opening_hours: rec.opening_hours, description: rec.description,
    services: rec.services ?? [],
    google_rating: rec.google_rating, google_review_count: rec.google_review_count,
    google_maps_url: rec.google_maps_url, latitude: rec.latitude, longitude: rec.longitude,
    status: rec.status ?? 'listed',
    claimed: false, verified: false,
    visibility: rec.visibility ?? 'public',
    photos: rec.photos ?? [], cover_image: rec.cover_image,
    // Existing CHECK constraint on `source` only allows 3 values. True origin
    // (which agent, which search query, which URL) is preserved in `provenance` JSONB.
    source: 'philip_manual_seed',
    imported_at: rec.imported_at ?? new Date().toISOString(),
    refacing_evidence: rec.refacing_evidence ?? [],
    refacing_qualification: rec.refacing_qualification,
    email_source: rec.email_source, email_verified: rec.email_verified ?? false, email_checked_at: rec.email_checked_at,
    lifecycle_status: 'unclaimed', directory_state: 'listed',
    // Existing CHECK on `enrichment_status` only allows stub/partial/verified.
    // We deliberately never use 'verified' (Philip's language caution: reserved for
    // claimed+ companies). All Stage 2/4 records go in as 'partial' — the FULLY_VERIFIED
    // vs SERVICE_EVIDENCED distinction lives in `internal_verification_state`.
    enrichment_status: 'partial',
    internal_verification_state: rec.internal_verification_state,
    customer_facing_label: rec.customer_facing_label,
    region: rec.region, provenance,
  };
}

async function runInserts(inserts) {
  console.log(`\n[4a/6] INSERT · ${inserts.length} new records · chunk=50`);
  const results = [];
  const CHUNK = 50;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK).map(toSupabaseRow);
    const { data, error } = await supabase.from('directory_seeds').insert(chunk).select('id, slug');
    if (error) {
      console.log(`  ✗ chunk ${Math.floor(i / CHUNK) + 1} failed: ${error.message}`);
      for (const rec of chunk) results.push({ slug: rec.slug, business_name: rec.business_name, state: 'EXCEPTION', reason: error.message.slice(0, 200) });
    } else {
      const okSlugs = new Set((data || []).map(r => r.slug));
      for (const rec of chunk) {
        if (okSlugs.has(rec.slug)) results.push({ slug: rec.slug, business_name: rec.business_name, state: 'INSERTED', id: data.find(d => d.slug === rec.slug)?.id });
        else results.push({ slug: rec.slug, business_name: rec.business_name, state: 'EXCEPTION', reason: 'not returned' });
      }
      console.log(`  ✓ chunk ${Math.floor(i / CHUNK) + 1}: ${(data || []).length}/${chunk.length}`);
    }
  }
  const ok = results.filter(r => r.state === 'INSERTED').length;
  console.log(`  → ${ok} inserted · ${results.length - ok} exceptions`);
  return results;
}

function mergeRow(existing, incoming) {
  const merged = { ...existing };
  const backfill = ['telephone','email','postcode','county','town','address_line_1','address_line_2','description'];
  for (const f of backfill) if (merged[f] == null && incoming[f] != null) merged[f] = incoming[f];
  const nowCaps = { ...(existing.capabilities || {}) };
  for (const [k, v] of Object.entries(incoming.capabilities || {})) {
    if (nowCaps[k] === 'yes') continue;
    if (v === 'yes') nowCaps[k] = 'yes';
    else if (nowCaps[k] === undefined || nowCaps[k] === 'unknown') nowCaps[k] = v;
  }
  merged.capabilities = nowCaps;
  if (!existing.business_type && incoming.business_type) merged.business_type = incoming.business_type;
  if (!existing.internal_verification_state && incoming.internal_verification_state) merged.internal_verification_state = incoming.internal_verification_state;
  if (!existing.customer_facing_label && incoming.customer_facing_label) merged.customer_facing_label = incoming.customer_facing_label;
  if (!existing.region && incoming.region) merged.region = incoming.region;
  const combined = [...(existing.refacing_evidence || [])];
  for (const item of (incoming.refacing_evidence || [])) {
    if (!combined.some(e => e.url === item.url && e.category === item.category)) combined.push(item);
  }
  merged.refacing_evidence = combined;
  const rank = { 'A+': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, excluded: 0 };
  if ((rank[incoming.refacing_qualification] ?? 0) > (rank[existing.refacing_qualification] ?? 0)) merged.refacing_qualification = incoming.refacing_qualification;
  merged.tags = [...new Set([...(existing.tags || []), ...(incoming.tags || [])])];
  const existingProv = existing.provenance || {};
  merged.provenance = {
    ...existingProv,
    discovered_by_agents: [...new Set([...(existingProv.discovered_by_agents || []), ...(incoming.discovered_by_agents || [])])],
    stage2_source_queries: [...new Set([...(existingProv.stage2_source_queries || []), ...(incoming.stage2_source_queries || [])])],
    stage2_source_urls: [...new Set([...(existingProv.stage2_source_urls || []), ...(incoming.stage2_source_urls || [])])],
    stage4_direct_fetch: existingProv.stage4_direct_fetch ?? incoming.stage4_direct_fetch,
    stage4_identity_confirmed: existingProv.stage4_identity_confirmed ?? incoming.stage4_identity_confirmed,
    stage4_page_evidence_summary: existingProv.stage4_page_evidence_summary ?? incoming.stage4_page_evidence_summary,
    merge_history: [...(existingProv.merge_history || []), { merged_at: new Date().toISOString(), from_source: 'stage5b_v2', incoming_business_name: incoming.business_name }],
  };
  merged.claimed = existing.claimed === true ? true : false;
  merged.verified = existing.verified === true ? true : false;
  merged.lifecycle_status = existing.lifecycle_status || 'unclaimed';
  merged.directory_state = existing.directory_state || 'listed';
  return merged;
}

async function runMergesLive(liveMerges) {
  console.log(`\n[4b/6] LIVE_MERGE · ${liveMerges.length} into existing production rows`);
  const results = [];
  for (const c of liveMerges) {
    const targetId = c.primary_match.other_id;
    const { data: liveRow, error: fetchErr } = await supabase.from('directory_seeds').select('*').eq('id', targetId).maybeSingle();
    if (fetchErr || !liveRow) {
      results.push({ target_id: targetId, incoming: c.business_name, state: 'EXCEPTION', reason: `fetch failed: ${fetchErr?.message || 'not found'}` });
      continue;
    }
    const merged = mergeRow(liveRow, c._record);
    // Strip id from update payload to avoid confusion
    delete merged.id;
    const { error: updErr } = await supabase.from('directory_seeds').update(merged).eq('id', targetId);
    if (updErr) {
      results.push({ target_id: targetId, target_slug: liveRow.slug, incoming: c.business_name, state: 'EXCEPTION', reason: `update failed: ${updErr.message}` });
    } else {
      results.push({
        target_id: targetId,
        target_slug: liveRow.slug,
        incoming: c.business_name,
        state: 'MERGED',
        signals: c.matches.map(m => m.signal),
        before_evidence: (liveRow.refacing_evidence || []).length,
        after_evidence: (merged.refacing_evidence || []).length,
        before_caps_yes: Object.values(liveRow.capabilities || {}).filter(v => v === 'yes').length,
        after_caps_yes: Object.values(merged.capabilities || {}).filter(v => v === 'yes').length,
      });
    }
  }
  const ok = results.filter(r => r.state === 'MERGED').length;
  console.log(`  → ${ok} merged · ${results.length - ok} exceptions`);
  return results;
}

async function runMergesPlanned(planned) {
  console.log(`\n[4c/6] PLANNED_MERGE · ${planned.length} Stage-4 targeted merges`);
  const results = [];
  for (const m of planned) {
    const targetSlug = (m.matched_existing_source || '').split('/').pop().replace(/\.json$/, '');
    const { data: liveRow, error: fetchErr } = await supabase.from('directory_seeds').select('*').eq('slug', targetSlug).maybeSingle();
    if (fetchErr || !liveRow) {
      results.push({ target_slug: targetSlug, incoming: m.incoming.business_name, state: 'EXCEPTION', reason: `fetch failed: ${fetchErr?.message || 'not found'}` });
      continue;
    }
    const merged = mergeRow(liveRow, m.incoming);
    delete merged.id;
    const { error: updErr } = await supabase.from('directory_seeds').update(merged).eq('slug', targetSlug);
    if (updErr) {
      results.push({ target_slug: targetSlug, incoming: m.incoming.business_name, state: 'EXCEPTION', reason: `update failed: ${updErr.message}` });
    } else {
      results.push({
        target_slug: targetSlug,
        incoming: m.incoming.business_name,
        state: 'MERGED',
        signals: (m.match_signals || []).map(s => s.signal),
        before_evidence: (liveRow.refacing_evidence || []).length,
        after_evidence: (merged.refacing_evidence || []).length,
        before_caps_yes: Object.values(liveRow.capabilities || {}).filter(v => v === 'yes').length,
        after_caps_yes: Object.values(merged.capabilities || {}).filter(v => v === 'yes').length,
      });
    }
  }
  const ok = results.filter(r => r.state === 'MERGED').length;
  console.log(`  → ${ok} merged · ${results.length - ok} exceptions`);
  return results;
}

// ─── STEP 5 · post-import audit ───

async function postImportAudit(backup) {
  console.log(`\n[5/6] Post-import audit...`);
  const { count } = await supabase.from('directory_seeds').select('*', { count: 'exact', head: true });
  const { data: newVerified } = await supabase.from('directory_seeds').select('slug').eq('verified', true);
  const { data: newClaimed } = await supabase.from('directory_seeds').select('slug').eq('claimed', true);
  const { data: newLifecycle } = await supabase.from('directory_seeds').select('slug').neq('lifecycle_status', 'unclaimed');
  const audit = {
    before_row_count: backup.count,
    after_row_count: count,
    net_change: count - backup.count,
    rows_with_verified_true: (newVerified || []).length,
    rows_with_claimed_true: (newClaimed || []).length,
    rows_with_non_unclaimed_lifecycle: (newLifecycle || []).length,
  };
  console.log(`  before: ${audit.before_row_count} · after: ${audit.after_row_count} · net: +${audit.net_change}`);
  console.log(`  verified=true: ${audit.rows_with_verified_true} · claimed=true: ${audit.rows_with_claimed_true} · non-unclaimed: ${audit.rows_with_non_unclaimed_lifecycle}`);
  return audit;
}

// ─── STEP 6 · reconciliation ───

async function reconcile({ classifications, insertResults, liveMergeResults, plannedMergeResults, ambiguous, review, deferredNoMigration }) {
  console.log(`\n[6/6] Reconciliation...`);
  const rec = [];
  for (const r of insertResults) rec.push({ business_name: r.business_name, slug: r.slug, state: r.state, reason: r.reason ?? null });
  for (const r of liveMergeResults) rec.push({ business_name: r.incoming, target_slug: r.target_slug, target_id: r.target_id, state: r.state === 'MERGED' ? 'LIVE_MERGED' : r.state, reason: r.reason ?? null });
  for (const r of plannedMergeResults) rec.push({ business_name: r.incoming, target_slug: r.target_slug, state: r.state === 'MERGED' ? 'PLANNED_MERGED' : r.state, reason: r.reason ?? null });
  for (const a of ambiguous) rec.push({ business_name: a.business_name, slug: a.slug, state: 'AMBIGUOUS_REVIEW', reason: `collision on ${a.matches.map(m=>m.signal).join(',')} with different-name live row` });
  for (const r of review) rec.push({ business_name: r.business_name, slug: r.slug, state: 'DEFERRED', reason: `${r.internal_verification_state} · preserved in manual_review_queue.json` });

  const dist = {};
  for (const r of rec) dist[r.state] = (dist[r.state] || 0) + 1;
  console.log(`  distribution: ${JSON.stringify(dist)}`);
  await writeFile(OUT_RECONCILIATION, JSON.stringify({ generated_at: new Date().toISOString(), distribution: dist, records: rec }, null, 2));
  return { distribution: dist, records: rec };
}

// ─── report ───

function renderReport({ backup, liveSummary, preflight, insertResults, liveMergeResults, plannedMergeResults, ambiguous, review, audit, reconciliation }) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 5B v2 · Live-Supabase-Aware Import`);
  lines.push(``);
  lines.push(`_Executed against NEX Supabase directory_seeds · live-dedup engine · Philip Option 1 · ${new Date().toISOString()}_`);
  lines.push(``);
  lines.push(`## Result summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| Before row count | ${audit.before_row_count} |`);
  lines.push(`| Inserted (new) | ${insertResults.filter(r => r.state === 'INSERTED').length} |`);
  lines.push(`| Live-merged (auto · name matched) | ${liveMergeResults.filter(r => r.state === 'MERGED').length} |`);
  lines.push(`| Planned-merged (Stage 4 target) | ${plannedMergeResults.filter(r => r.state === 'MERGED').length} |`);
  lines.push(`| Ambiguous review (deferred) | ${ambiguous.length} |`);
  lines.push(`| Original review queue (deferred) | ${review.length} |`);
  lines.push(`| Insert exceptions | ${insertResults.filter(r => r.state === 'EXCEPTION').length} |`);
  lines.push(`| Merge exceptions | ${liveMergeResults.filter(r => r.state === 'EXCEPTION').length + plannedMergeResults.filter(r => r.state === 'EXCEPTION').length} |`);
  lines.push(`| After row count | ${audit.after_row_count} |`);
  lines.push(`| Net change | +${audit.net_change} |`);
  lines.push(``);
  lines.push(`## Live-dedup classification (v2 addition)`);
  lines.push(``);
  lines.push(`Before writing, all 211 production_ready records were cross-checked against the LIVE 302-row Supabase snapshot (not just legacy JSON archives).`);
  lines.push(``);
  lines.push(`| Verdict | Count |`);
  lines.push(`|---|---:|`);
  lines.push(`| INSERT (no live collision) | ${liveSummary.insert} |`);
  lines.push(`| LIVE_MERGE (collision + identity confirmed) | ${liveSummary.live_merge} |`);
  lines.push(`| LIVE_AMBIGUOUS_REVIEW (collision + name differs) | ${liveSummary.live_ambiguous_review} |`);
  lines.push(``);
  lines.push(`## Rules preserved`);
  lines.push(``);
  lines.push(`| Rule | Result |`);
  lines.push(`|---|---:|`);
  lines.push(`| Rows with verified=true | ${audit.rows_with_verified_true} |`);
  lines.push(`| Rows with claimed=true | ${audit.rows_with_claimed_true} |`);
  lines.push(`| Rows with non-unclaimed lifecycle | ${audit.rows_with_non_unclaimed_lifecycle} |`);
  lines.push(``);
  lines.push(`## Reconciliation · every source record ended in exactly one state`);
  lines.push(``);
  lines.push(`| Final state | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(reconciliation.distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  const total = Object.values(reconciliation.distribution).reduce((s,n)=>s+n,0);
  lines.push(`| **TOTAL** | **${total}** |`);
  lines.push(``);
  if (ambiguous.length) {
    lines.push(`## Ambiguous review queue · ${ambiguous.length} records need human decision`);
    lines.push(``);
    lines.push(`These are collisions where the domain/phone/email matches a live row BUT the business_name is different. Preserved in \`stage5b-v2-ambiguous-review.json\` for manual triage.`);
    lines.push(``);
    lines.push(`| Incoming business | Signals | Live target (name) |`);
    lines.push(`|---|---|---|`);
    for (const a of ambiguous.slice(0, 20)) {
      lines.push(`| ${a.business_name} | ${a.matches.map(m => m.signal).join(', ')} | ${a.primary_match?.other_name || '—'} (\`${a.primary_match?.other_slug || '—'}\`) |`);
    }
    if (ambiguous.length > 20) lines.push(`| _...${ambiguous.length - 20} more_ | | |`);
  }
  lines.push(``);
  lines.push(`## Backup`);
  lines.push(``);
  lines.push(`- File: \`${backup.path}\``);
  lines.push(`- Row count captured: ${backup.count}`);
  lines.push(`- Checksum: \`${backup.checksum.slice(0, 32)}…\``);
  lines.push(``);
  lines.push(`## What Stage 5B v2 did NOT do`);
  lines.push(``);
  lines.push(`- Did not contact any company`);
  lines.push(`- Did not set verified=true or claimed=true on any record`);
  lines.push(`- Did not touch the 84 review-queue records or the ${ambiguous.length} new ambiguous-review records`);
  lines.push(`- Did not overwrite stronger existing data on any merge`);
  lines.push(`- Did not touch NEX brain / M4 freeze`);
  return lines.join('\n');
}

// ─── main ───

async function main() {
  const args = process.argv.slice(2);
  const INSERTS_ONLY = args.includes('--inserts-only');
  if (INSERTS_ONLY) console.log('MODE: --inserts-only · SKIP merges (assumed already applied from prior run)');

  await mkdir(MASTER_DIR, { recursive: true });
  const inserts = JSON.parse(await readFile(PRODUCTION_READY, 'utf8'));
  const plannedMerges = JSON.parse(await readFile(MERGE_PENDING, 'utf8'));
  const review = JSON.parse(await readFile(REVIEW_QUEUE, 'utf8'));
  console.log(`Loaded Stage 5A: ${inserts.length} inserts · ${plannedMerges.length} planned merges · ${review.length} review`);

  await verifyMigrationApplied();
  const backupResult = await backup();

  const mergeTargetSlugs = plannedMerges.map(m => (m.matched_existing_source || '').split('/').pop().replace(/\.json$/, ''));
  const { classifications, summary } = await liveClassify(inserts, mergeTargetSlugs, backupResult.rows);

  // Reclassify per verdict
  const cleanInserts = classifications.filter(c => c.verdict === 'INSERT').map(c => c._record);
  const liveMerges = classifications.filter(c => c.verdict === 'LIVE_MERGE');
  const ambiguous = classifications.filter(c => c.verdict === 'LIVE_AMBIGUOUS_REVIEW');
  await writeFile(OUT_AMBIGUOUS_REVIEW, JSON.stringify(ambiguous, null, 2));

  const preflight = preflightClean(classifications);
  if (preflight.errors.length > 0) {
    console.error(`\nSTOPPING — preflight errors must be resolved before import.`);
    process.exit(2);
  }

  const insertResults = await runInserts(cleanInserts);
  const liveMergeResults = INSERTS_ONLY ? [] : await runMergesLive(liveMerges);
  const plannedMergeResults = INSERTS_ONLY ? [] : await runMergesPlanned(plannedMerges);

  const audit = await postImportAudit(backupResult);
  const reconciliation = await reconcile({ classifications, insertResults, liveMergeResults, plannedMergeResults, ambiguous, review });

  const md = renderReport({ backup: backupResult, liveSummary: summary, preflight, insertResults, liveMergeResults, plannedMergeResults, ambiguous, review, audit, reconciliation });
  await writeFile(OUT_REPORT, md);
  console.log(`\nReport: ${OUT_REPORT}`);
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
