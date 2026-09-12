#!/usr/bin/env node
// scripts/nex-english-brain-e1-language.mjs
//
// Founder BEGIN 2026-09-11 · Step 5 of ADR-0308 · E1 Language Researcher · Layer 1.
//
// Seeds high-value programming + core English concepts that both NEX Chat
// and NEX1 will need immediately. Every concept + sense passes through the
// Guardian (deterministic validator) before landing.
//
// Deterministic. Zero LLM. Zero third-party. Every insert is idempotent
// via ON CONFLICT so the script is safe to re-run.
//
// Layer 1 = Core Programming English (Founder BEGIN acceptance concepts).
// Later layers each get their own worker file · Layer 2 questions, Layer 3
// answer patterns, Layer 4 business/travel/food domains, Layer 5 wider
// programming (git, ci/cd, security).

import pg from "pg";
const { Client } = pg;

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const CAPTURED_BY = "e1_language_researcher_layer1_2026_09_11";
const SOURCE_REF = "e1_seed_layer1_founder_authorized_ADR_0308";

// ═══════════════════════════════════════════════════════════════════
// Layer 1 seed corpus · programming-first + core English glue
// Every entry passes Guardian rules: canonical_key lower_snake_case,
// sense_key stable canonical id, description ≥ 4 chars, evidence attached.
// ═══════════════════════════════════════════════════════════════════

const CORPUS = [
  // ── Programming Layer 5 concepts (nex1 needs these immediately) ──
  {
    canonical_key: "route", display_name: "Route", layer: 5,
    senses: [
      {
        sense_key: "http_url_path",
        description: "A URL path handled by a web application, mapping a request to a handler function.",
        domain_hint: ["programming", "http", "web", "nextjs"],
        confidence: 0.95,
        contexts: [
          { signal: "api", kind: "cooccur_token", weight: 0.85 },
          { signal: "endpoint", kind: "cooccur_token", weight: 0.85 },
          { signal: "url", kind: "cooccur_token", weight: 0.8 },
          { signal: "handler", kind: "cooccur_token", weight: 0.75 },
          { signal: "http", kind: "cooccur_token", weight: 0.9 },
          { signal: "nextjs", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
          { signal: "http", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "In this codebase a route is a file at `src/app/**/route.ts` (or a page under `src/app/**/page.tsx`) that Next.js maps a URL path to. GET/POST/PUT/DELETE handlers export their HTTP method. Routes never own long-term state.",
      },
      {
        sense_key: "path_between_points",
        description: "A path or set of directions from one location to another, for example a driving route or a hiking route.",
        domain_hint: ["travel", "geography"],
        confidence: 0.9,
        contexts: [
          { signal: "map", kind: "cooccur_token", weight: 0.8 },
          { signal: "driving", kind: "cooccur_token", weight: 0.9 },
          { signal: "hiking", kind: "cooccur_token", weight: 0.9 },
          { signal: "travel", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A route in the travel sense is a path or set of directions between two locations — a driving route, a hiking route, or a scheduled bus route.",
      },
    ],
  },
  {
    canonical_key: "endpoint", display_name: "Endpoint", layer: 5,
    senses: [
      {
        sense_key: "http_api_endpoint",
        description: "A URL that a client sends a request to. In this codebase, endpoints live at `src/app/api/**/route.ts`.",
        domain_hint: ["programming", "http", "api"],
        confidence: 0.97,
        contexts: [
          { signal: "api", kind: "cooccur_token", weight: 0.95 },
          { signal: "route", kind: "cooccur_token", weight: 0.85 },
          { signal: "url", kind: "cooccur_token", weight: 0.8 },
          { signal: "request", kind: "cooccur_token", weight: 0.75 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "An endpoint is a URL on the server that a client can call. In this codebase, endpoints live at `src/app/api/**/route.ts` and export GET/POST/PUT/DELETE handlers.",
      },
    ],
  },
  {
    canonical_key: "refactor", display_name: "Refactor", layer: 5,
    senses: [
      {
        sense_key: "code_restructure_no_behaviour_change",
        description: "Rewriting code without changing what it does · reducing complexity · renaming for clarity · extracting shared logic.",
        domain_hint: ["programming"],
        confidence: 0.97,
        contexts: [
          { signal: "code", kind: "cooccur_token", weight: 0.85 },
          { signal: "rewrite", kind: "cooccur_token", weight: 0.9 },
          { signal: "rename", kind: "cooccur_token", weight: 0.85 },
          { signal: "restructure", kind: "cooccur_token", weight: 0.9 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "A refactor is a code change that leaves behaviour identical while improving structure — smaller functions, clearer names, or shared helpers. Tests must still pass.",
      },
    ],
  },
  {
    canonical_key: "test", display_name: "Test", layer: 5,
    senses: [
      {
        sense_key: "automated_software_test",
        description: "A piece of code that runs another piece of code and asserts the result matches expectation. In this codebase, tests live next to source as `*.test.ts` and are run by Vitest.",
        domain_hint: ["programming", "vitest"],
        confidence: 0.97,
        contexts: [
          { signal: "vitest", kind: "cooccur_token", weight: 0.98 },
          { signal: "unit", kind: "cooccur_token", weight: 0.75 },
          { signal: "assertion", kind: "cooccur_token", weight: 0.85 },
          { signal: "spec", kind: "cooccur_token", weight: 0.8 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "A test is a file ending in `.test.ts` that Vitest runs. It calls production code and asserts behaviour with `expect(...)`. Tests must pass before nex1 auto-applies any change.",
      },
      {
        sense_key: "trial_or_evaluation",
        description: "A general trial or evaluation of something — for example testing whether a product works, or a taste test.",
        domain_hint: ["general"],
        confidence: 0.85,
        contexts: [
          { signal: "trial", kind: "cooccur_token", weight: 0.8 },
          { signal: "taste", kind: "cooccur_token", weight: 0.85 },
        ],
        answer: "A test in the general sense is a trial or evaluation of something — determining whether it works, meets a standard, or satisfies criteria.",
      },
    ],
  },
  {
    canonical_key: "bug", display_name: "Bug", layer: 5,
    senses: [
      {
        sense_key: "software_defect",
        description: "A software defect · code behaves differently from what was intended. Fixing a bug means restoring intended behaviour without regressions.",
        domain_hint: ["programming"],
        confidence: 0.98,
        contexts: [
          { signal: "fix", kind: "cooccur_token", weight: 0.9 },
          { signal: "broken", kind: "cooccur_token", weight: 0.9 },
          { signal: "error", kind: "cooccur_token", weight: 0.85 },
          { signal: "crash", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "A bug is a software defect · the code does something different from what was intended. Fixing a bug in NEX means restoring intended behaviour and proving it with tests before merge.",
      },
      {
        sense_key: "insect",
        description: "A small insect. Not a programming concept.",
        domain_hint: ["biology"],
        confidence: 0.9,
        contexts: [
          { signal: "insect", kind: "cooccur_token", weight: 0.95 },
        ],
        answer: "A bug in the biology sense is a small insect · unrelated to software.",
      },
    ],
  },
  {
    canonical_key: "postgres", display_name: "PostgreSQL", layer: 5,
    senses: [
      {
        sense_key: "database_engine",
        description: "PostgreSQL · an open-source relational database engine. In this codebase it's the authoritative store for nex.* and nex_agent.* schemas.",
        domain_hint: ["programming", "database"],
        confidence: 0.99,
        contexts: [
          { signal: "database", kind: "cooccur_token", weight: 0.9 },
          { signal: "sql", kind: "cooccur_token", weight: 0.9 },
          { signal: "schema", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "PostgreSQL (Postgres) is the open-source relational database engine NEX uses as its authoritative store. Tables live under schemas like `nex.*` (knowledge) and `nex_agent.*` (competency).",
      },
    ],
  },
  {
    canonical_key: "schema", display_name: "Schema", layer: 5,
    senses: [
      {
        sense_key: "database_schema_definition",
        description: "The shape of a database · tables, columns, constraints, indexes, relationships.",
        domain_hint: ["programming", "database"],
        confidence: 0.97,
        contexts: [
          { signal: "database", kind: "cooccur_token", weight: 0.95 },
          { signal: "postgres", kind: "cooccur_token", weight: 0.95 },
          { signal: "table", kind: "cooccur_token", weight: 0.85 },
          { signal: "column", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A schema is the shape of a database — the set of tables, columns, constraints, indexes, and relationships. In Postgres, a named schema (`nex.*`) groups related tables together.",
      },
    ],
  },
  {
    canonical_key: "typescript", display_name: "TypeScript", layer: 5,
    senses: [
      {
        sense_key: "typed_javascript_language",
        description: "TypeScript · a strongly-typed superset of JavaScript that compiles to JavaScript. The whole NEX codebase is written in TypeScript.",
        domain_hint: ["programming", "language"],
        confidence: 0.99,
        contexts: [
          { signal: "javascript", kind: "cooccur_token", weight: 0.85 },
          { signal: "types", kind: "cooccur_token", weight: 0.8 },
          { signal: "tsc", kind: "cooccur_token", weight: 0.95 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "TypeScript is a strongly-typed superset of JavaScript. Every source file in NEX is TypeScript (`.ts` / `.tsx`) and `tsc` runs before every auto-apply to catch type errors on the founder's changed files.",
      },
    ],
  },
  {
    canonical_key: "git", display_name: "Git", layer: 5,
    senses: [
      {
        sense_key: "version_control_system",
        description: "Git · a distributed version control system that tracks changes to files. NEX1 creates branches, commits, and hands them to the founder to merge.",
        domain_hint: ["programming", "tooling"],
        confidence: 0.99,
        contexts: [
          { signal: "branch", kind: "cooccur_token", weight: 0.9 },
          { signal: "commit", kind: "cooccur_token", weight: 0.95 },
          { signal: "merge", kind: "cooccur_token", weight: 0.9 },
          { signal: "worktree", kind: "cooccur_token", weight: 0.95 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "Git is the version control system NEX1 uses to isolate work. Every V1.5 auto-apply happens on its own worktree branch under `nex-agent/task-<id>` and the founder merges manually.",
      },
    ],
  },
  {
    canonical_key: "branch", display_name: "Branch", layer: 5,
    senses: [
      {
        sense_key: "git_branch_of_history",
        description: "A named pointer to a specific line of commit history in a Git repository. Branches let multiple parallel changes live without conflict.",
        domain_hint: ["programming", "git"],
        confidence: 0.97,
        contexts: [
          { signal: "git", kind: "cooccur_token", weight: 0.95 },
          { signal: "commit", kind: "cooccur_token", weight: 0.85 },
          { signal: "merge", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A Git branch is a named pointer to a specific line of commit history. NEX1's auto-apply lands work on branches under `nex-agent/task-<short-id>` so main stays clean until the founder merges.",
      },
    ],
  },
  {
    canonical_key: "commit", display_name: "Commit", layer: 5,
    senses: [
      {
        sense_key: "git_commit_snapshot",
        description: "A snapshot of changes recorded in Git history · every commit has a unique SHA and a message.",
        domain_hint: ["programming", "git"],
        confidence: 0.97,
        contexts: [
          { signal: "git", kind: "cooccur_token", weight: 0.95 },
          { signal: "branch", kind: "cooccur_token", weight: 0.9 },
          { signal: "sha", kind: "cooccur_token", weight: 0.9 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A Git commit is a snapshot of code changes with a unique SHA and a message. NEX1's auto-apply writes commits like `nex-agent auto-apply · task <id>` inside isolated worktrees.",
      },
    ],
  },
  {
    canonical_key: "worktree", display_name: "Git worktree", layer: 5,
    senses: [
      {
        sense_key: "git_worktree_isolated_checkout",
        description: "A second working directory tied to a Git repository, used to work on a different branch without switching the main checkout.",
        domain_hint: ["programming", "git"],
        confidence: 0.98,
        contexts: [
          { signal: "git", kind: "cooccur_token", weight: 0.95 },
          { signal: "branch", kind: "cooccur_token", weight: 0.85 },
          { signal: "checkout", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A Git worktree is a second working directory attached to a Git repository. NEX1 creates one per task at `data/nex-agent-workspaces/task-<id>` so auto-apply changes never touch the founder's main checkout.",
      },
    ],
  },
  {
    canonical_key: "index", display_name: "Index", layer: 5,
    senses: [
      {
        sense_key: "database_index",
        description: "A database index · a data structure that speeds up lookups on a column at the cost of write speed.",
        domain_hint: ["programming", "database", "postgres"],
        confidence: 0.95,
        contexts: [
          { signal: "database", kind: "cooccur_token", weight: 0.95 },
          { signal: "postgres", kind: "cooccur_token", weight: 0.95 },
          { signal: "gin", kind: "cooccur_token", weight: 0.9 },
          { signal: "btree", kind: "cooccur_token", weight: 0.9 },
          { signal: "database", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "A database index is a data structure Postgres uses to speed up column lookups. In NEX we add indexes explicitly in migration files. GIN indexes are for JSONB / arrays; B-tree is the default.",
      },
    ],
  },
  {
    canonical_key: "table", display_name: "Table", layer: 5,
    senses: [
      {
        sense_key: "database_table",
        description: "A named collection of rows in a database, each row obeying the same column schema.",
        domain_hint: ["programming", "database"],
        confidence: 0.98,
        contexts: [
          { signal: "database", kind: "cooccur_token", weight: 0.95 },
          { signal: "postgres", kind: "cooccur_token", weight: 0.95 },
          { signal: "column", kind: "cooccur_token", weight: 0.9 },
          { signal: "schema", kind: "cooccur_token", weight: 0.85 },
          { signal: "row", kind: "cooccur_token", weight: 0.8 },
          { signal: "database", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "A table is a named collection of rows in a Postgres database. Every row has the same columns. NEX tables live under named schemas like `nex.concepts` or `nex_agent.tasks`.",
      },
    ],
  },
  {
    canonical_key: "column", display_name: "Column", layer: 5,
    senses: [
      {
        sense_key: "database_column",
        description: "A named field in a database table · every row has a value for every column (possibly NULL).",
        domain_hint: ["programming", "database"],
        confidence: 0.98,
        contexts: [
          { signal: "table", kind: "cooccur_token", weight: 0.95 },
          { signal: "database", kind: "cooccur_token", weight: 0.9 },
          { signal: "field", kind: "cooccur_token", weight: 0.85 },
          { signal: "database", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "A column is a named field in a Postgres table. Each row has a value for each column (NULL is allowed unless the column is declared NOT NULL). New columns are added via a migration file.",
      },
    ],
  },
  {
    canonical_key: "api", display_name: "API", layer: 5,
    senses: [
      {
        sense_key: "application_programming_interface",
        description: "An Application Programming Interface · a set of endpoints or functions a program exposes to be called by other programs.",
        domain_hint: ["programming"],
        confidence: 0.99,
        contexts: [
          { signal: "endpoint", kind: "cooccur_token", weight: 0.95 },
          { signal: "route", kind: "cooccur_token", weight: 0.85 },
          { signal: "http", kind: "cooccur_token", weight: 0.9 },
          { signal: "rest", kind: "cooccur_token", weight: 0.9 },
          { signal: "programming", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "An API is the set of URLs or functions a program exposes so other programs can call it. NEX APIs live under `/api/*` with each URL implemented in `src/app/api/**/route.ts`.",
      },
    ],
  },
  {
    canonical_key: "nex", display_name: "NEX", layer: 4,
    senses: [
      {
        sense_key: "nex_platform",
        description: "The NEX platform · a UK trades marketplace with Indonesian expansion, built as a Next.js application on PostgreSQL. NEX Chat is the conversation role and NEX1 is the software-engineering role of the same NEX.",
        domain_hint: ["nex", "meta", "product"],
        confidence: 1.0,
        contexts: [
          { signal: "platform", kind: "cooccur_token", weight: 0.9 },
          { signal: "trades", kind: "cooccur_token", weight: 0.95 },
          { signal: "marketplace", kind: "cooccur_token", weight: 0.85 },
          { signal: "founder", kind: "cooccur_token", weight: 0.8 },
        ],
        answer: "NEX is the platform you are talking to. It is a UK trades marketplace with Indonesian expansion, built as a Next.js app on PostgreSQL. NEX Chat is the conversation role and NEX1 is the software-engineering role — one intelligence, two roles.",
      },
    ],
  },
  {
    canonical_key: "nex1", display_name: "NEX1", layer: 4,
    senses: [
      {
        sense_key: "nex_software_engineer_role",
        description: "The software-engineering role of NEX. Reads and plans code · debates plans with NEX2 and NEX3 · lands changes on isolated Git worktrees for the founder to merge.",
        domain_hint: ["nex", "programming", "meta"],
        confidence: 1.0,
        contexts: [
          { signal: "engineer", kind: "cooccur_token", weight: 0.85 },
          { signal: "programmer", kind: "cooccur_token", weight: 0.85 },
          { signal: "nex", kind: "cooccur_token", weight: 0.9 },
        ],
        answer: "NEX1 is NEX in software-engineering mode. It reads your prompt, debates a plan with NEX2 (architecture) and NEX3 (doctrine + security), and lands a change on an isolated Git branch that you merge manually.",
      },
    ],
  },
  {
    canonical_key: "founder", display_name: "Founder", layer: 4,
    senses: [
      {
        sense_key: "nex_founder_authority",
        description: "The person who owns and directs NEX. Every irreversible change (DB migration · main-branch merge · destructive delete) requires the founder's explicit approval.",
        domain_hint: ["nex", "governance", "meta"],
        confidence: 1.0,
        contexts: [
          { signal: "phil", kind: "cooccur_token", weight: 0.85 },
          { signal: "phillip", kind: "cooccur_token", weight: 0.9 },
          { signal: "owner", kind: "cooccur_token", weight: 0.75 },
          { signal: "approves", kind: "cooccur_token", weight: 0.8 },
        ],
        answer: "The founder is the person directing NEX. Every irreversible change — database migrations, merges to main, destructive deletes — requires explicit founder approval before it lands.",
      },
    ],
  },
  {
    canonical_key: "vitest", display_name: "Vitest", layer: 5,
    senses: [
      {
        sense_key: "vitest_test_runner",
        description: "Vitest · the test runner used throughout the NEX codebase for unit tests. Fast, ESM-first, TypeScript-friendly.",
        domain_hint: ["programming", "testing"],
        confidence: 0.98,
        contexts: [
          { signal: "test", kind: "cooccur_token", weight: 0.95 },
          { signal: "unit", kind: "cooccur_token", weight: 0.8 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "Vitest is the test runner NEX uses. Files ending in `.test.ts` are picked up automatically. NEX1 runs vitest before auto-applying any change with `npx --no-install vitest run <path>`.",
      },
    ],
  },
  {
    canonical_key: "nextjs", display_name: "Next.js", layer: 5,
    senses: [
      {
        sense_key: "nextjs_react_framework",
        description: "Next.js · a full-stack React framework. NEX runs on Next.js 16.x with Turbopack. Pages live at `src/app/**/page.tsx` and API routes at `src/app/api/**/route.ts`.",
        domain_hint: ["programming", "react", "web"],
        confidence: 0.98,
        contexts: [
          { signal: "react", kind: "cooccur_token", weight: 0.9 },
          { signal: "turbopack", kind: "cooccur_token", weight: 0.95 },
          { signal: "app", kind: "cooccur_token", weight: 0.65 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "Next.js is the full-stack React framework NEX runs on. Version 16.x with Turbopack. Pages are `src/app/**/page.tsx`, API routes are `src/app/api/**/route.ts`.",
      },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
// Guardian shim · deterministic checks per ADR-0308
// Mirrors src/lib/nex/language/guardian.ts rules; standalone here so
// the seeding script has zero dependency on the TS build.
// ═══════════════════════════════════════════════════════════════════

const CANONICAL_KEY_RE = /^[a-z][a-z0-9_]*$/;
const SENSE_KEY_RE = /^[a-z][a-z0-9_]*$/;

function guardianCheckConcept(c) {
  if (!CANONICAL_KEY_RE.test(c.canonical_key)) return { ok: false, reason: `canonical_key_format:${c.canonical_key}` };
  if (!c.display_name || c.display_name.length < 1 || c.display_name.length > 120) return { ok: false, reason: "display_name_bad" };
  if (c.layer < 1 || c.layer > 5) return { ok: false, reason: "layer_range" };
  return { ok: true };
}
function guardianCheckSense(s) {
  if (!SENSE_KEY_RE.test(s.sense_key)) return { ok: false, reason: `sense_key_format:${s.sense_key}` };
  if (!s.description || s.description.length < 4) return { ok: false, reason: "description_too_short" };
  if (s.confidence < 0 || s.confidence > 1) return { ok: false, reason: "confidence_range" };
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

async function main() {
  const c = new Client({ connectionString: PGURL });
  await c.connect();
  const stats = { concepts_seen: 0, concepts_inserted: 0, senses_inserted: 0, contexts_inserted: 0, answers_inserted: 0, evidence_inserted: 0, guardian_rejects: 0 };
  try {
    for (const conceptSpec of CORPUS) {
      stats.concepts_seen++;
      const g = guardianCheckConcept(conceptSpec);
      if (!g.ok) { console.log(`  ✗ guardian rejected concept ${conceptSpec.canonical_key}: ${g.reason}`); stats.guardian_rejects++; continue; }

      await c.query("BEGIN");
      try {
        const conceptRow = (await c.query(
          `INSERT INTO nex.concepts (canonical_key, display_name, layer, status)
           VALUES ($1, $2, $3, 'authoritative')
           ON CONFLICT (canonical_key) DO UPDATE
             SET display_name=EXCLUDED.display_name, layer=EXCLUDED.layer, status='authoritative'
           RETURNING concept_id, xmax`,
          [conceptSpec.canonical_key, conceptSpec.display_name, conceptSpec.layer]
        )).rows[0];
        const wasInsert = conceptRow.xmax === "0" || conceptRow.xmax === 0;
        if (wasInsert) stats.concepts_inserted++;

        for (const senseSpec of conceptSpec.senses) {
          const gs = guardianCheckSense(senseSpec);
          if (!gs.ok) { console.log(`  ✗ guardian rejected sense ${conceptSpec.canonical_key}.${senseSpec.sense_key}: ${gs.reason}`); stats.guardian_rejects++; continue; }
          const senseRow = (await c.query(
            `INSERT INTO nex.concept_senses (concept_id, sense_key, description, domain_hint, confidence, status)
             VALUES ($1, $2, $3, $4, $5, 'authoritative')
             ON CONFLICT (concept_id, sense_key) DO UPDATE
               SET description=EXCLUDED.description, domain_hint=EXCLUDED.domain_hint,
                   confidence=EXCLUDED.confidence, status='authoritative'
             RETURNING sense_id, xmax`,
            [conceptRow.concept_id, senseSpec.sense_key, senseSpec.description, senseSpec.domain_hint, senseSpec.confidence]
          )).rows[0];
          const senseInserted = senseRow.xmax === "0" || senseRow.xmax === 0;
          if (senseInserted) {
            stats.senses_inserted++;
            await c.query(
              `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
               VALUES ('sense', $1, $2, 'canonical_verified', $3, $4)`,
              [senseRow.sense_id, SOURCE_REF, senseSpec.confidence, CAPTURED_BY]
            );
            stats.evidence_inserted++;
          }

          // Contexts
          for (const ctx of senseSpec.contexts ?? []) {
            const r = await c.query(
              `INSERT INTO nex.contexts (sense_id, surface_signal, signal_kind, weight)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING
               RETURNING context_id`,
              [senseRow.sense_id, ctx.signal, ctx.kind, ctx.weight]
            );
            if (r.rows.length > 0) stats.contexts_inserted++;
          }

          // Canonical answer per sense (definition)
          if (senseSpec.answer) {
            const existing = await c.query(
              `SELECT answer_id FROM nex.answers WHERE sense_id=$1 AND answer_kind='definition' LIMIT 1`,
              [senseRow.sense_id]
            );
            if (existing.rows.length === 0) {
              const ans = (await c.query(
                `INSERT INTO nex.answers (sense_id, body, answer_kind, confidence, status)
                 VALUES ($1, $2, 'definition', $3, 'authoritative')
                 RETURNING answer_id`,
                [senseRow.sense_id, senseSpec.answer, senseSpec.confidence]
              )).rows[0];
              stats.answers_inserted++;
              await c.query(
                `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
                 VALUES ('answer', $1, $2, 'canonical_verified', $3, $4)`,
                [ans.answer_id, SOURCE_REF, senseSpec.confidence, CAPTURED_BY]
              );
              stats.evidence_inserted++;
            }
          }
        }
        await c.query("COMMIT");
        console.log(`  ✓ ${conceptSpec.canonical_key} · ${conceptSpec.senses.length} sense(s)`);
      } catch (e) {
        await c.query("ROLLBACK");
        console.log(`  ✗ concept ${conceptSpec.canonical_key} rollback: ${e.message}`);
      }
    }
    console.log("\n=== Layer 1 seed complete ===");
    console.log("stats:", JSON.stringify(stats));
  } finally { await c.end(); }
}

main().catch(e => { console.error(e); process.exit(1); });
