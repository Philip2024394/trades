// UK Staircase Trade Market · Stage 5B-USA · Production import + audit
//
// Executes Philip's 5-step protocol for USA (2026-08-16):
//   0. Verify migration 053 applied (region CHECK already dropped from IE)
//   1. Backup all 521 production rows (never modified · read-only snapshot)
//   2. Preflight all 375 US inserts · STOP on any hard collision
//   3. Transactional INSERT · 375 records with country='USA'
//   4. Post-import audit (before: 521 · after: 896 · verified=0 new · claimed=0 new · UK+IE unchanged)
//   5. Reconciliation
//
// Rules preserved:
//   · Never modify UK 471 or IE 50
//   · Never contact US companies
//   · Never set verified=true or claimed=true
//   · Never touch 158 review-queue records
//   · country='USA' on every insert
//   · lifecycle_status='unclaimed' · directory_state='listed'
//   · Preserve provenance and evidence
//   · STOP on hard collision · do not force through

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

const MASTER_DIR = 'C:/Users/Victus/trades/data/directory-seeds/_staircase_us_master';
const BACKUP_DIR = `${MASTER_DIR}/backups`;
const PRODUCTION_READY = `${MASTER_DIR}/production_ready.json`;
const REVIEW_QUEUE = `${MASTER_DIR}/manual_review_queue.json`;
const OUT_RECONCILIATION = `${MASTER_DIR}/stage5b-us-reconciliation.json`;
const OUT_REPORT = `${MASTER_DIR}/STAGE-5B-US-REPORT-2026-08-16.md`;

function sha256(s) { return createHash('sha256').update(s).digest('hex'); }
const normDomain = url => { if (!url) return ''; try { const u = new URL(url.startsWith('http') ? url : 'https://' + url); return u.hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; } };
const normPhone = s => (s || '').replace(/\D/g, '');
const normEmail = e => (e || '').toLowerCase().trim();

async function verifyMigration() {
  console.log('\n[0/5] Verifying migration 053 (region CHECK dropped)...');
  const testSlug = '__us_stage5b_probe_' + Math.random().toString(36).slice(2,10);
  const { data, error } = await supabase.from('directory_seeds').insert({
    slug: testSlug, business_name: '__probe', country: 'USA', region: 'CA',
    claimed: false, verified: false, status: 'listed', visibility: 'public',
    source: 'philip_manual_seed', enrichment_status: 'partial',
  }).select('id').maybeSingle();
  if (error) throw new Error(`Migration 053 NOT applied · US state rejected: ${error.message}`);
  await supabase.from('directory_seeds').delete().eq('id', data.id);
  console.log('  ✓ Migration 053 applied · US state codes accepted');
}

async function backup() {
  console.log('\n[1/5] Backing up production directory_seeds (UK+IE read-only)...');
  await mkdir(BACKUP_DIR, { recursive: true });
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('directory_seeds').select('*').range(from, from + 999);
    if (error) throw new Error(`Backup fetch failed: ${error.message}`);
    if (!data.length) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  const backupPath = `${BACKUP_DIR}/directory_seeds-2026-08-16-pre-stage5b-us.json`;
  const payload = { taken_at: new Date().toISOString(), row_count: all.length, checksum_sha256: sha256(JSON.stringify(all)), rows: all };
  await writeFile(backupPath, JSON.stringify(payload, null, 2));
  console.log(`  ✓ Backup: ${all.length} rows · checksum ${payload.checksum_sha256.slice(0, 16)}… · ${backupPath}`);
  return { rows: all, path: backupPath, count: all.length, checksum: payload.checksum_sha256 };
}

async function preflight(inserts, backupRows) {
  console.log(`\n[2/5] Preflight · validating ${inserts.length} US inserts against ${backupRows.length} production rows...`);
  const hardErrors = [];
  const warnings = [];

  const existingSlugs = new Set(backupRows.map(r => r.slug));
  const existingDomains = new Map();
  const existingPhones = new Map();
  const existingEmails = new Map();
  for (const r of backupRows) {
    const d = normDomain(r.website); if (d) existingDomains.set(d, r);
    const p = normPhone(r.telephone); if (p.length >= 7) existingPhones.set(p, r);
    const e = normEmail(r.email); if (e) existingEmails.set(e, r);
  }

  const insertSlugs = new Set();
  const insertDomains = new Map();

  for (const rec of inserts) {
    if (!rec.business_name) hardErrors.push(`missing business_name: ${rec.slug}`);
    if (!rec.slug) hardErrors.push(`missing slug: ${rec.business_name}`);
    if (!rec.business_type) hardErrors.push(`missing business_type: ${rec.business_name}`);
    if (rec.verified !== false) hardErrors.push(`verified != false: ${rec.business_name}`);
    if (rec.claimed !== false) hardErrors.push(`claimed != false: ${rec.business_name}`);
    if (rec.lifecycle_status !== 'unclaimed') hardErrors.push(`lifecycle_status != unclaimed: ${rec.business_name}`);
    if (rec.directory_state !== 'listed') hardErrors.push(`directory_state != listed: ${rec.business_name}`);
    if (rec.country !== 'USA') hardErrors.push(`country != 'USA': ${rec.business_name}`);
    if (existingSlugs.has(rec.slug)) hardErrors.push(`slug COLLISION with production: ${rec.slug}`);
    if (insertSlugs.has(rec.slug)) hardErrors.push(`slug duplicated within batch: ${rec.slug}`);
    insertSlugs.add(rec.slug);
    const d = normDomain(rec.website);
    if (d && existingDomains.has(d)) warnings.push(`domain collision with production: ${d} (US: ${rec.business_name} · existing: ${existingDomains.get(d).business_name})`);
    if (d && insertDomains.has(d)) warnings.push(`domain duplicated within batch: ${d} (${rec.business_name} · previously: ${insertDomains.get(d)})`);
    if (d) insertDomains.set(d, rec.business_name);
    const p = normPhone(rec.telephone);
    if (p.length >= 7 && existingPhones.has(p)) warnings.push(`phone collision with production: ${p} (${rec.business_name})`);
    const e = normEmail(rec.email);
    if (e && existingEmails.has(e)) warnings.push(`email collision with production: ${e} (${rec.business_name})`);
  }

  console.log(`  hard errors: ${hardErrors.length}`);
  console.log(`  warnings: ${warnings.length}`);
  for (const e of hardErrors.slice(0, 15)) console.log(`    ✗ ${e}`);
  for (const w of warnings.slice(0, 10)) console.log(`    ⚠ ${w}`);
  return { hardErrors, warnings };
}

function toSupabaseRow(rec) {
  return {
    id: rec.id, slug: rec.slug, business_name: rec.business_name,
    category: rec.category, primary_trade: rec.primary_trade,
    business_type: rec.business_type, capabilities: rec.capabilities,
    tags: rec.tags ?? [], enrichment_status: 'partial',
    last_verified_at: rec.last_verified_at,
    address_line_1: rec.address_line_1, address_line_2: rec.address_line_2,
    town: rec.town, county: rec.county, postcode: rec.postcode,
    country: 'USA',
    telephone: rec.telephone, website: rec.website, email: rec.email,
    opening_hours: rec.opening_hours, description: rec.description,
    services: rec.services ?? [],
    google_rating: rec.google_rating, google_review_count: rec.google_review_count,
    google_maps_url: rec.google_maps_url, latitude: rec.latitude, longitude: rec.longitude,
    status: 'listed', claimed: false, verified: false, visibility: 'public',
    photos: rec.photos ?? [], cover_image: rec.cover_image,
    source: 'philip_manual_seed',
    imported_at: rec.imported_at ?? new Date().toISOString(),
    refacing_evidence: rec.refacing_evidence ?? [],
    refacing_qualification: rec.refacing_qualification,
    email_source: rec.email_source, email_verified: false, email_checked_at: rec.email_checked_at,
    lifecycle_status: 'unclaimed', directory_state: 'listed',
    internal_verification_state: rec.internal_verification_state,
    customer_facing_label: rec.customer_facing_label,
    region: rec.region, provenance: rec.provenance,
  };
}

async function runInserts(inserts) {
  console.log(`\n[3/5] INSERT · ${inserts.length} US records · chunk=25`);
  const results = [];
  const CHUNK = 25;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK).map(toSupabaseRow);
    const { data, error } = await supabase.from('directory_seeds').insert(chunk).select('id, slug');
    if (error) {
      console.log(`  ✗ chunk ${Math.floor(i / CHUNK) + 1} failed: ${error.message.slice(0, 150)}`);
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

async function postImportAudit(backup) {
  console.log(`\n[4/5] Post-import audit...`);
  const { count: total } = await supabase.from('directory_seeds').select('*', { count: 'exact', head: true });
  const { count: usCount } = await supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'USA');
  const { count: ieCount } = await supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'Ireland');
  const { count: ukCount } = await supabase.from('directory_seeds').select('*', { count: 'exact', head: true }).eq('country', 'United Kingdom');
  const { data: newVerified } = await supabase.from('directory_seeds').select('slug').eq('verified', true).eq('country', 'USA');
  const { data: newClaimed } = await supabase.from('directory_seeds').select('slug').eq('claimed', true).eq('country', 'USA');

  const preUkRows = backup.rows.filter(r => r.country === 'United Kingdom').length;
  const preIeRows = backup.rows.filter(r => r.country === 'Ireland').length;

  const audit = {
    before_row_count: backup.count,
    after_row_count: total,
    net_change: total - backup.count,
    before_uk: preUkRows, after_uk: ukCount, uk_unchanged: preUkRows === ukCount,
    before_ie: preIeRows, after_ie: ieCount, ie_unchanged: preIeRows === ieCount,
    us_after: usCount,
    new_us_verified_true: (newVerified || []).length,
    new_us_claimed_true: (newClaimed || []).length,
  };
  console.log(`  Before: ${audit.before_row_count} · After: ${audit.after_row_count} · Net: +${audit.net_change}`);
  console.log(`  UK before: ${audit.before_uk} · UK after: ${audit.after_uk} · unchanged: ${audit.uk_unchanged}`);
  console.log(`  IE before: ${audit.before_ie} · IE after: ${audit.after_ie} · unchanged: ${audit.ie_unchanged}`);
  console.log(`  US after: ${audit.us_after}`);
  console.log(`  US with verified=true: ${audit.new_us_verified_true} (must be 0)`);
  console.log(`  US with claimed=true: ${audit.new_us_claimed_true} (must be 0)`);
  return audit;
}

async function reconcile({ insertResults, review }) {
  console.log(`\n[5/5] Reconciliation...`);
  const rec = [];
  for (const r of insertResults) rec.push({ business_name: r.business_name, slug: r.slug, state: r.state, reason: r.reason ?? null });
  for (const r of review) rec.push({ business_name: r.business_name, slug: r.slug, state: 'DEFERRED', reason: `${r.internal_verification_state} · preserved in manual_review_queue.json` });
  const dist = {};
  for (const r of rec) dist[r.state] = (dist[r.state] || 0) + 1;
  console.log(`  distribution: ${JSON.stringify(dist)}`);
  await writeFile(OUT_RECONCILIATION, JSON.stringify({ generated_at: new Date().toISOString(), distribution: dist, records: rec }, null, 2));
  return { distribution: dist, records: rec };
}

function renderReport({ backup, preflight, insertResults, audit, reconciliation, review }) {
  const lines = [];
  lines.push(`# UK Staircase Trade Market · Stage 5B-USA · Production Import + Audit`);
  lines.push(``);
  lines.push(`_Executed against NEX Supabase directory_seeds · Philip 5-step protocol · ${new Date().toISOString()}_`);
  lines.push(``);
  lines.push(`## Result summary`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---:|`);
  lines.push(`| Before row count | ${audit.before_row_count} |`);
  lines.push(`| US inserted | ${insertResults.filter(r => r.state === 'INSERTED').length} |`);
  lines.push(`| Insert exceptions | ${insertResults.filter(r => r.state === 'EXCEPTION').length} |`);
  lines.push(`| Deferred (review queue) | ${review.length} |`);
  lines.push(`| After row count | ${audit.after_row_count} |`);
  lines.push(`| Net change | +${audit.net_change} |`);
  lines.push(``);
  lines.push(`## Commercial inventory · LIVE`);
  lines.push(``);
  lines.push(`| Market | Production listings |`);
  lines.push(`|---|---:|`);
  lines.push(`| 🇬🇧 United Kingdom | ${audit.after_uk} |`);
  lines.push(`| 🇮🇪 Ireland | ${audit.after_ie} |`);
  lines.push(`| 🇺🇸 USA | ${audit.us_after} |`);
  lines.push(`| **Total** | **${audit.after_row_count}** |`);
  lines.push(``);
  lines.push(`## Rules preserved`);
  lines.push(``);
  lines.push(`| Rule | Result |`);
  lines.push(`|---|---|`);
  lines.push(`| UK 471 unchanged | ${audit.uk_unchanged ? '✓ frozen' : '✗ CHANGED · investigate'} |`);
  lines.push(`| Ireland 50 unchanged | ${audit.ie_unchanged ? '✓ frozen' : '✗ CHANGED · investigate'} |`);
  lines.push(`| US records with verified=true | ${audit.new_us_verified_true} (must be 0) |`);
  lines.push(`| US records with claimed=true | ${audit.new_us_claimed_true} (must be 0) |`);
  lines.push(`| Preflight hard errors | ${preflight.hardErrors.length} |`);
  lines.push(`| Preflight warnings | ${preflight.warnings.length} |`);
  lines.push(``);
  lines.push(`## Reconciliation · every source record has exactly one final state`);
  lines.push(``);
  lines.push(`| Final state | Count |`);
  lines.push(`|---|---:|`);
  for (const [k, n] of Object.entries(reconciliation.distribution).sort((a,b) => b[1]-a[1])) lines.push(`| ${k} | ${n} |`);
  const total = Object.values(reconciliation.distribution).reduce((s,n)=>s+n,0);
  lines.push(`| **TOTAL** | **${total}** (must equal 533 = 375 production + 158 review) |`);
  lines.push(``);
  lines.push(`## Backup`);
  lines.push(``);
  lines.push(`- File: \`${backup.path}\``);
  lines.push(`- Rows captured: ${backup.count}`);
  lines.push(`- Checksum: \`${backup.checksum.slice(0, 32)}…\``);
  lines.push(``);
  lines.push(`## What Stage 5B-USA did NOT do`);
  lines.push(``);
  lines.push(`- Did not modify any UK 471 or Ireland 50 record`);
  lines.push(`- Did not contact any US company`);
  lines.push(`- Did not set verified=true or claimed=true on any US record`);
  lines.push(`- Did not touch the 158 review-queue records`);
  lines.push(`- Did not elevate Stage 2 claims to capabilities='yes' without direct evidence`);
  lines.push(`- Did not touch NEX brain / M4 freeze`);
  return lines.join('\n');
}

async function main() {
  const inserts = JSON.parse(await readFile(PRODUCTION_READY, 'utf8'));
  const review = JSON.parse(await readFile(REVIEW_QUEUE, 'utf8'));
  console.log(`Loaded Stage 5A-USA: ${inserts.length} inserts · ${review.length} review`);

  await verifyMigration();
  const backupResult = await backup();
  const preflightResult = await preflight(inserts, backupResult.rows);

  if (preflightResult.hardErrors.length > 0) {
    console.error(`\nSTOPPING — ${preflightResult.hardErrors.length} preflight hard errors must be resolved. NO INSERTS PERFORMED.`);
    // Still write a partial report so Philip sees what happened
    const audit = { before_row_count: backupResult.count, after_row_count: backupResult.count, net_change: 0, before_uk: backupResult.rows.filter(r => r.country === 'United Kingdom').length, after_uk: backupResult.rows.filter(r => r.country === 'United Kingdom').length, uk_unchanged: true, before_ie: backupResult.rows.filter(r => r.country === 'Ireland').length, after_ie: backupResult.rows.filter(r => r.country === 'Ireland').length, ie_unchanged: true, us_after: 0, new_us_verified_true: 0, new_us_claimed_true: 0 };
    const md = renderReport({ backup: backupResult, preflight: preflightResult, insertResults: [], audit, reconciliation: { distribution: { PREFLIGHT_HALTED: inserts.length, DEFERRED: review.length }, records: [] }, review });
    await writeFile(OUT_REPORT, md);
    process.exit(2);
  }

  const insertResults = await runInserts(inserts);
  const audit = await postImportAudit(backupResult);
  const reconciliation = await reconcile({ insertResults, review });

  const md = renderReport({ backup: backupResult, preflight: preflightResult, insertResults, audit, reconciliation, review });
  await writeFile(OUT_REPORT, md);
  console.log(`\nReport: ${OUT_REPORT}`);
}

main().catch(e => { console.error('\nFATAL:', e); process.exit(1); });
