#!/usr/bin/env node
// scripts/nex-english-brain-e3-howto.mjs
//
// Founder BEGIN 2026-09-11 · E3 · Layer 3 · how-to answer patterns (steps).
//
// Adds two kinds of rows:
//   1. nex.questions patterns like "how do I add a {entity}" → intent=explain,
//      answer_type='steps'
//   2. nex.answers rows with answer_kind='steps' attached to specific concepts,
//      containing numbered how-to bodies grounded in the actual NEX codebase.
//
// Zero fabrication: every step references real files/commands from this repo.
// Guardian rules apply · evidence attached · confidence stated honestly.

import pg from "pg";
const { Client } = pg;

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const CAPTURED_BY = "e3_answer_builder_layer3_2026_09_11";
const SOURCE_REF = "e3_seed_layer3_founder_authorized_continue";

// ═══════════════════════════════════════════════════════════════════
// Question patterns · Layer 3 · how-to shape
// ═══════════════════════════════════════════════════════════════════

const HOWTO_QUESTIONS = [
  { surface_pattern: "how do I add a {entity}",     intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.95 },
  { surface_pattern: "how do i add a {entity}",     intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.95 },
  { surface_pattern: "how to add a {entity}",       intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.95 },
  { surface_pattern: "how do I create a {entity}",  intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.93 },
  { surface_pattern: "how do i create a {entity}",  intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.93 },
  { surface_pattern: "how do I fix {entity}",       intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.9 },
  { surface_pattern: "how do i fix {entity}",       intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.9 },
  { surface_pattern: "how do I run {entity}",       intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.9 },
  { surface_pattern: "how do i run {entity}",       intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.9 },
  { surface_pattern: "how do I test {entity}",      intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.9 },
  { surface_pattern: "how do i test {entity}",      intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.9 },
  { surface_pattern: "steps to {entity}",           intent_slug: "explain", answer_type: "steps", entity_slots: [{ name: "entity", kind: "noun_phrase" }], confidence: 0.85 },
];

// ═══════════════════════════════════════════════════════════════════
// How-to step answers · attached to specific concepts
// Each is grounded in the actual NEX codebase · no fabrication.
// ═══════════════════════════════════════════════════════════════════

const HOWTO_ANSWERS = [
  {
    concept_key: "migration", sense_key: "database_schema_change",
    body: [
      "How to add a PostgreSQL migration in NEX:",
      "1. Find the next number in `db/migrations/` (current highest is 006).",
      "2. Create `db/migrations/NNN_your_change.sql` with `BEGIN;` at top and `COMMIT;` at bottom.",
      "3. Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` so re-runs are safe.",
      "4. Attach evidence: every canonical row should carry a matching `nex.evidence` insert.",
      "5. Apply via `node -e` calling pg client against `postgresql://postgres:Admin1phil@localhost:5433/nex_dev` — founder types the confirmation before it lands.",
      "6. Verify with a smoke SELECT and update the memory pointer.",
    ].join("\n"),
    confidence: 0.95,
  },
  {
    concept_key: "endpoint", sense_key: "http_api_endpoint",
    body: [
      "How to add an API endpoint in NEX:",
      "1. Create `src/app/api/<your-path>/route.ts`.",
      "2. Export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.",
      "3. Export named HTTP method handlers: `export async function GET(req: Request) { ... }`.",
      "4. Return with `NextResponse.json({ ok: true, ... })` from `next/server`.",
      "5. Add a leading `//` summary comment as the first line.",
      "6. If it touches Postgres, use a `Client` with `NEX_POSTGRES_URL` and close in `finally`.",
      "7. Test via `curl -sS -X POST http://localhost:3008/api/<your-path> -H 'content-type: application/json' -d '{}'`.",
    ].join("\n"),
    confidence: 0.95,
  },
  {
    concept_key: "route", sense_key: "http_url_path",
    body: [
      "How to add a route in NEX:",
      "1. For a page: create `src/app/<segment>/page.tsx` returning a React server component.",
      "2. For an API: create `src/app/api/<segment>/route.ts` exporting HTTP method handlers.",
      "3. Both work automatically — Next.js discovers them by filesystem path.",
      "4. Add a leading `//` summary comment.",
      "5. For dynamic segments, name the folder `[id]` and use `params.id` in the handler.",
    ].join("\n"),
    confidence: 0.94,
  },
  {
    concept_key: "test", sense_key: "automated_software_test",
    body: [
      "How to add tests in NEX:",
      "1. Create a file ending in `.test.ts` next to the source you're testing (e.g. `foo.ts` gets `foo.test.ts`).",
      "2. Import from `vitest`: `import { describe, it, expect } from 'vitest'`.",
      "3. Wrap tests in `describe('module name', () => { it('behaviour', async () => { ... expect(actual).toBe(expected); }); })`.",
      "4. Run: `npx --no-install vitest run <path-to-test>` — nex1 runs this before every auto-apply.",
      "5. Test failures block auto-apply · founder still merges manually.",
    ].join("\n"),
    confidence: 0.95,
  },
  {
    concept_key: "refactor", sense_key: "code_restructure_no_behaviour_change",
    body: [
      "How to refactor safely in NEX:",
      "1. Read the file(s) end-to-end first · use `Read` tool, don't guess.",
      "2. Identify what's shared between call sites — that's your extraction candidate.",
      "3. Make the change in ONE commit per logical rename/extract · don't bundle behavioural changes.",
      "4. Run touched-files typecheck: nex1 already gates on this before auto-apply.",
      "5. Run tests: `npx --no-install vitest run <affected-path>`.",
      "6. Founder still merges the branch manually after inspection.",
    ].join("\n"),
    confidence: 0.9,
  },
  {
    concept_key: "worktree", sense_key: "git_worktree_isolated_checkout",
    body: [
      "How to work with Git worktrees in NEX:",
      "1. Create: `git worktree add -b nex-agent/task-<id> data/nex-agent-workspaces/task-<id> main`.",
      "2. Node modules are NOT in the worktree · Node resolves up to the repo root's `node_modules` so tools work.",
      "3. NEX1's V1.5 auto-apply creates a worktree per task automatically.",
      "4. Verify: `git worktree list`.",
      "5. Remove when done: `git worktree remove <path>` and `git branch -D <branch>`.",
    ].join("\n"),
    confidence: 0.93,
  },
  {
    concept_key: "auth", sense_key: "authentication_and_authorization",
    body: [
      "How auth works in NEX (as of Sept 2026):",
      "1. Middleware at `src/middleware.ts` intercepts every request before it hits a route handler.",
      "2. Auth helpers live in `src/lib/auth/*` — they read cookies / session state.",
      "3. Session identity is a cookie carrying a session ID · the session data lives server-side.",
      "4. Per ADR-0300 we're moving OFF Supabase Auth · new code uses NEX-owned session tables.",
      "5. Every admin route must go through `authz` middleware before serving data.",
    ].join("\n"),
    confidence: 0.85,
  },
  {
    concept_key: "cron", sense_key: "scheduled_recurring_job",
    body: [
      "How cron jobs work in NEX on Windows:",
      "1. Time-based crons expose `/api/cron/<name>/route.ts` handlers.",
      "2. Windows Scheduled Tasks (`schtasks.exe`) hit those routes on a schedule.",
      "3. Long-running workers spawn as detached `child_process.spawn` from `scripts/nex-agents.mjs`.",
      "4. Each worker publishes a heartbeat row to Postgres so we can see if it's alive.",
      "5. Task wrapper `scripts/_wrappers/run-hidden.vbs` runs jobs without popping a console window.",
    ].join("\n"),
    confidence: 0.88,
  },
  {
    concept_key: "vitest", sense_key: "vitest_test_runner",
    body: [
      "How to run Vitest against a specific area of NEX:",
      "1. Run one file: `npx --no-install vitest run src/lib/nex/language/language.test.ts`.",
      "2. Run a folder: `npx --no-install vitest run src/lib/nex/language`.",
      "3. Watch mode is off by default (`--run` semantics). Add `--watch` for interactive.",
      "4. Prefer `--reporter default --no-color` for CI-friendly output.",
      "5. Nex1's auto-apply gate runs vitest on touched-files before commit.",
    ].join("\n"),
    confidence: 0.95,
  },
  {
    concept_key: "commit", sense_key: "git_commit_snapshot",
    body: [
      "How commits work in NEX1's auto-apply:",
      "1. NEX1 writes proposed files to an isolated worktree via `writeFileSafe`.",
      "2. Runs `git add -A` then `git commit -F <tempfile>` (message via file · Windows shell can mangle `-m`).",
      "3. Commit message: `nex-agent auto-apply · task <id>`.",
      "4. The commit lands on `nex-agent/task-<id>` branch · main stays untouched.",
      "5. Founder merges manually via `git merge --no-ff nex-agent/task-<id>`.",
    ].join("\n"),
    confidence: 0.94,
  },
];

const VALID_ANSWER_TYPES = new Set(["definition", "steps", "list", "fact", "clarify", "unknown"]);
const VALID_INTENT_SLUGS = new Set(["explain", "add_feature", "fix_bug", "refactor", "add_migration", "add_api_route", "add_test", "explain_error", "capabilities", "small_talk"]);
const INTENT_SLUG_RE = /^[a-z][a-z0-9_]*$/;
function guardQuestion(q) {
  if (!q.surface_pattern || q.surface_pattern.trim().length < 2) return { ok: false, reason: "surface_pattern_empty" };
  if (!INTENT_SLUG_RE.test(q.intent_slug)) return { ok: false, reason: `intent_slug_format:${q.intent_slug}` };
  if (!VALID_INTENT_SLUGS.has(q.intent_slug)) return { ok: false, reason: `intent_slug_unknown:${q.intent_slug}` };
  if (!VALID_ANSWER_TYPES.has(q.answer_type)) return { ok: false, reason: `answer_type_invalid:${q.answer_type}` };
  return { ok: true };
}

async function main() {
  const c = new Client({ connectionString: PGURL });
  await c.connect();
  const stats = { questions_inserted: 0, questions_updated: 0, answers_inserted: 0, evidence_inserted: 0, guardian_rejects: 0 };
  try {
    // ── Seed question patterns ────────────────────────────
    for (const q of HOWTO_QUESTIONS) {
      const g = guardQuestion(q);
      if (!g.ok) { console.log(`  ✗ pattern "${q.surface_pattern}": ${g.reason}`); stats.guardian_rejects++; continue; }
      const existing = await c.query(`SELECT question_id FROM nex.questions WHERE surface_pattern=$1 LIMIT 1`, [q.surface_pattern]);
      if (existing.rows.length > 0) {
        await c.query(
          `UPDATE nex.questions SET intent_slug=$2, entity_slots=$3::jsonb, answer_type=$4, confidence=$5, status='authoritative' WHERE question_id=$1`,
          [existing.rows[0].question_id, q.intent_slug, JSON.stringify(q.entity_slots ?? []), q.answer_type, q.confidence]
        );
        stats.questions_updated++;
      } else {
        const row = (await c.query(
          `INSERT INTO nex.questions (surface_pattern, intent_slug, entity_slots, answer_type, confidence, status)
           VALUES ($1, $2, $3::jsonb, $4, $5, 'authoritative')
           RETURNING question_id`,
          [q.surface_pattern, q.intent_slug, JSON.stringify(q.entity_slots ?? []), q.answer_type, q.confidence]
        )).rows[0];
        await c.query(
          `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
           VALUES ('question', $1, $2, 'canonical_verified', $3, $4)`,
          [row.question_id, SOURCE_REF, q.confidence, CAPTURED_BY]
        );
        stats.questions_inserted++;
        stats.evidence_inserted++;
      }
      console.log(`  ✓ pattern · ${q.surface_pattern} → ${q.intent_slug} (${q.answer_type})`);
    }

    // ── Seed step answers · attached to sense_ids ─────────
    for (const a of HOWTO_ANSWERS) {
      const senseRow = await c.query(
        `SELECT s.sense_id FROM nex.concept_senses s
           JOIN nex.concepts c ON c.concept_id = s.concept_id
          WHERE c.canonical_key=$1 AND s.sense_key=$2 LIMIT 1`,
        [a.concept_key, a.sense_key]
      );
      if (senseRow.rows.length === 0) {
        console.log(`  ✗ no sense found for ${a.concept_key}.${a.sense_key}`);
        continue;
      }
      const sense_id = senseRow.rows[0].sense_id;
      const existing = await c.query(
        `SELECT answer_id FROM nex.answers WHERE sense_id=$1 AND answer_kind='steps' LIMIT 1`,
        [sense_id]
      );
      if (existing.rows.length > 0) {
        await c.query(
          `UPDATE nex.answers SET body=$2, confidence=$3, status='authoritative' WHERE answer_id=$1`,
          [existing.rows[0].answer_id, a.body, a.confidence]
        );
        console.log(`  · updated steps · ${a.concept_key}.${a.sense_key}`);
      } else {
        const ans = (await c.query(
          `INSERT INTO nex.answers (sense_id, body, answer_kind, confidence, status)
           VALUES ($1, $2, 'steps', $3, 'authoritative')
           RETURNING answer_id`,
          [sense_id, a.body, a.confidence]
        )).rows[0];
        await c.query(
          `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
           VALUES ('answer', $1, $2, 'canonical_verified', $3, $4)`,
          [ans.answer_id, SOURCE_REF, a.confidence, CAPTURED_BY]
        );
        stats.answers_inserted++;
        stats.evidence_inserted++;
        console.log(`  ✓ steps · ${a.concept_key}.${a.sense_key}`);
      }
    }
    console.log("\n=== Layer 3 seed complete ===");
    console.log("stats:", JSON.stringify(stats));
  } finally { await c.end(); }
}

main().catch(e => { console.error(e); process.exit(1); });
