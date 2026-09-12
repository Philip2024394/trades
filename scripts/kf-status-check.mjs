#!/usr/bin/env node
// scripts/kf-status-check.mjs · Founder status check for accommodation KF.
import pg from "pg";

const url = process.env.NEX_KF_POSTGRES_URL ?? process.env.NEX_TAXONOMY_POSTGRES_URL;
if (!url) { console.error("URL missing"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url });

const now = new Date();

try {
  console.log(`══ Accommodation Knowledge Factory · status at ${now.toISOString()}`);

  // 1. Question variants
  const qv = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE answer_status='candidate')::int AS candidate,
       COUNT(*) FILTER (WHERE answer_status='answered')::int AS answered,
       COUNT(*) FILTER (WHERE answer_status='partially_answered')::int AS partially_answered,
       COUNT(*) FILTER (WHERE answer_status='unknown')::int AS unknown,
       COUNT(*) FILTER (WHERE answer_status='conflicting')::int AS conflicting,
       COUNT(*) FILTER (WHERE answer_status='stale')::int AS stale,
       COUNT(DISTINCT entity_ref)::int AS unique_entities,
       COUNT(DISTINCT intent_slug)::int AS unique_intents,
       COUNT(*) FILTER (WHERE language='en')::int AS en,
       COUNT(*) FILTER (WHERE language='id')::int AS id,
       MIN(created_at)::text AS first_created,
       MAX(updated_at)::text AS most_recent_update
     FROM nex.question_variant WHERE domain='accommodation'`,
  );
  console.log(`\n── nex.question_variant (accommodation)`);
  console.log(`  total:             ${qv.rows[0].total.toLocaleString()}`);
  console.log(`  by answer_status:`);
  console.log(`    candidate:         ${qv.rows[0].candidate.toLocaleString()}`);
  console.log(`    answered:          ${qv.rows[0].answered.toLocaleString()}`);
  console.log(`    partially_answered:${qv.rows[0].partially_answered.toLocaleString()}`);
  console.log(`    unknown:           ${qv.rows[0].unknown.toLocaleString()}`);
  console.log(`    conflicting:       ${qv.rows[0].conflicting.toLocaleString()}`);
  console.log(`    stale:             ${qv.rows[0].stale.toLocaleString()}`);
  console.log(`  unique entities:   ${qv.rows[0].unique_entities.toLocaleString()}`);
  console.log(`  unique intents:    ${qv.rows[0].unique_intents.toLocaleString()}`);
  console.log(`  language en/id:    ${qv.rows[0].en.toLocaleString()} / ${qv.rows[0].id.toLocaleString()}`);
  console.log(`  first created:     ${qv.rows[0].first_created}`);
  console.log(`  most recent update:${qv.rows[0].most_recent_update}`);

  // 2. Knowledge gaps
  const g = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE resolved_at IS NULL)::int AS open,
       SUM(times_seen)::int AS total_demand
     FROM nex.knowledge_gap WHERE domain='accommodation'`,
  );
  console.log(`\n── nex.knowledge_gap (accommodation)`);
  console.log(`  total rows:  ${g.rows[0].total.toLocaleString()}`);
  console.log(`  open:        ${g.rows[0].open.toLocaleString()}`);
  console.log(`  sum(times_seen): ${g.rows[0].total_demand?.toLocaleString() ?? "0"}`);

  // 3. Worker heartbeats
  const w = await pool.query(
    `SELECT worker_id, domain, worker_kind, state, current_task,
            tasks_completed, tasks_failed, queue_depth,
            updated_at, last_success_at, last_failure_at,
            EXTRACT(EPOCH FROM (now() - updated_at))::int AS stale_seconds
       FROM nex.kf_worker_heartbeat
       WHERE domain='accommodation'
       ORDER BY updated_at DESC`,
  );
  console.log(`\n── nex.kf_worker_heartbeat (accommodation)`);
  console.log(`  workers registered: ${w.rowCount}`);
  if (w.rowCount === 0) {
    console.log(`  NONE. No accommodation KF worker has ever registered a heartbeat.`);
  } else {
    for (const row of w.rows) {
      const staleMinutes = Math.round(row.stale_seconds / 60);
      const supervisedState = row.stale_seconds > 90 ? "STALE" : row.state;
      console.log(`  · ${row.worker_id}`);
      console.log(`      kind=${row.worker_kind}  state=${row.state}  supervised=${supervisedState}`);
      console.log(`      heartbeat: ${row.updated_at.toISOString()} (${staleMinutes} min ago)`);
      console.log(`      current_task=${row.current_task ?? "-"}`);
      console.log(`      tasks_completed=${row.tasks_completed}  tasks_failed=${row.tasks_failed}  queue_depth=${row.queue_depth}`);
    }
  }

  // 4. Recent activity (last 24h)
  const recent = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS created_1h,
       COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS created_24h,
       COUNT(*) FILTER (WHERE last_verified_at > now() - interval '1 hour')::int AS verified_1h,
       COUNT(*) FILTER (WHERE last_verified_at > now() - interval '24 hours')::int AS verified_24h
     FROM nex.question_variant WHERE domain='accommodation'`,
  );
  console.log(`\n── recent activity`);
  console.log(`  new question_variants last 1h:  ${recent.rows[0].created_1h}`);
  console.log(`  new question_variants last 24h: ${recent.rows[0].created_24h}`);
  console.log(`  verified last 1h:                ${recent.rows[0].verified_1h}`);
  console.log(`  verified last 24h:               ${recent.rows[0].verified_24h}`);

  // 5. Master rulebook coverage target for accommodation
  const rb = await pool.query(
    `SELECT question_variant_target, updated_at FROM nex.master_rulebook WHERE domain='accommodation'`,
  );
  if (rb.rowCount > 0) {
    const target = rb.rows[0].question_variant_target;
    const total = qv.rows[0].total;
    const answered = qv.rows[0].answered;
    const partial = qv.rows[0].partially_answered;
    console.log(`\n── coverage vs rulebook target`);
    console.log(`  target:                     ${target.toLocaleString()}`);
    console.log(`  current variants:           ${total.toLocaleString()}`);
    console.log(`  coverage %:                 ${((total / target) * 100).toFixed(3)}%`);
    console.log(`  answered or partial %:      ${(((answered + partial) / Math.max(1, total)) * 100).toFixed(2)}%`);
    console.log(`  rulebook updated_at:        ${rb.rows[0].updated_at.toISOString()}`);
  }

  // 6. Ceremonial · what IS running right now?
  console.log(`\n══ HONEST SUPERVISOR VERDICT`);
  const active = w.rows.filter((r) => r.stale_seconds <= 90);
  if (active.length > 0) {
    console.log(`  ✓ ${active.length} accommodation KF worker(s) are ALIVE (heartbeat < 90s).`);
    for (const a of active) console.log(`      · ${a.worker_id} · current_task=${a.current_task}`);
  } else if (w.rowCount > 0) {
    console.log(`  ⚠ ${w.rowCount} worker(s) registered but ALL are STALE (heartbeat > 90s).`);
    console.log(`     Latest heartbeat is ${Math.round(w.rows[0].stale_seconds / 60)} minutes old.`);
    console.log(`     No question generation happening right now.`);
  } else {
    console.log(`  ⚠ NO accommodation KF worker is running.`);
    console.log(`     Data below is from prior runs (Phase 2 · this session may have paused generation).`);
  }
} catch (e) {
  console.error("status check failed:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
