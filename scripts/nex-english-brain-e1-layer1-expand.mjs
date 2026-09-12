#!/usr/bin/env node
// scripts/nex-english-brain-e1-layer1-expand.mjs
//
// Founder BEGIN 2026-09-11 · E1 · widen Layer 1 to include the concepts nex1
// sees daily beyond the initial 21. Same Guardian gate · same evidence
// discipline · idempotent ON CONFLICT DO UPDATE.

import pg from "pg";
const { Client } = pg;

const PGURL = process.env.NEX_LANGUAGE_POSTGRES_URL
  ?? process.env.NEX_TAXONOMY_POSTGRES_URL
  ?? process.env.NEX_POSTGRES_URL
  ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev";

const CAPTURED_BY = "e1_language_researcher_layer1_expand_2026_09_11";
const SOURCE_REF = "e1_seed_layer1_expand_founder_authorized_continue";

const CORPUS = [
  {
    canonical_key: "worker", display_name: "Worker", layer: 5,
    senses: [{
      sense_key: "background_worker_process",
      description: "A background process that does work outside a normal request/response cycle · in this codebase, workers live under `scripts/` or `src/lib/*/workers/` and are scheduled via cron or invoked manually.",
      domain_hint: ["programming", "backend"],
      confidence: 0.95,
      contexts: [
        { signal: "background", kind: "cooccur_token", weight: 0.9 },
        { signal: "cron", kind: "cooccur_token", weight: 0.85 },
        { signal: "scheduled", kind: "cooccur_token", weight: 0.85 },
        { signal: "batch", kind: "cooccur_token", weight: 0.7 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A worker is a background process that runs work outside the normal request cycle. In NEX, workers live in `scripts/` (one-shot) or `src/lib/*/workers/` (long-running), often scheduled by cron or by a heartbeat loop.",
    }],
  },
  {
    canonical_key: "cron", display_name: "Cron", layer: 5,
    senses: [{
      sense_key: "scheduled_recurring_job",
      description: "A scheduled recurring job · runs on a time-based schedule (every minute, hourly, daily). Windows uses Scheduled Tasks; Unix uses cron.",
      domain_hint: ["programming", "operations"],
      confidence: 0.97,
      contexts: [
        { signal: "schedule", kind: "cooccur_token", weight: 0.9 },
        { signal: "recurring", kind: "cooccur_token", weight: 0.85 },
        { signal: "worker", kind: "cooccur_token", weight: 0.8 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A cron job is a scheduled recurring job. In NEX we have both time-based crons (`/api/cron/*` routes hit by the OS scheduler) and heartbeat-driven long-running workers.",
    }],
  },
  {
    canonical_key: "log", display_name: "Log", layer: 5,
    senses: [{
      sense_key: "runtime_log_output",
      description: "A record of what a program did at runtime · timestamped text lines written to stdout, a file, or a structured store like Postgres.",
      domain_hint: ["programming", "observability"],
      confidence: 0.95,
      contexts: [
        { signal: "console", kind: "cooccur_token", weight: 0.9 },
        { signal: "stderr", kind: "cooccur_token", weight: 0.9 },
        { signal: "output", kind: "cooccur_token", weight: 0.7 },
        { signal: "trace", kind: "cooccur_token", weight: 0.8 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A log is a record of what a program did at runtime · timestamped lines going to stdout, a file, or a structured store. NEX writes structured logs to `nex.observability_*` tables as well.",
    }],
  },
  {
    canonical_key: "cache", display_name: "Cache", layer: 5,
    senses: [{
      sense_key: "fast_temporary_store",
      description: "A fast, temporary store that speeds up expensive operations by keeping recently-used results in memory. Never treated as truth · always disposable, always rebuildable from canonical.",
      domain_hint: ["programming", "performance"],
      confidence: 0.97,
      contexts: [
        { signal: "memory", kind: "cooccur_token", weight: 0.85 },
        { signal: "hot", kind: "cooccur_token", weight: 0.8 },
        { signal: "ttl", kind: "cooccur_token", weight: 0.9 },
        { signal: "invalidate", kind: "cooccur_token", weight: 0.9 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A cache is a fast, temporary store that speeds up expensive lookups. Founder doctrine: caches are disposable · Postgres is authoritative · every cache must be rebuildable from canonical data. NEX's concept-resolver hot tier is one example.",
    }],
  },
  {
    canonical_key: "session", display_name: "Session", layer: 5,
    senses: [{
      sense_key: "web_session_state",
      description: "The server-side state associated with a single user visiting the app · lasts across multiple requests until logout or timeout.",
      domain_hint: ["programming", "auth", "web"],
      confidence: 0.95,
      contexts: [
        { signal: "cookie", kind: "cooccur_token", weight: 0.9 },
        { signal: "login", kind: "cooccur_token", weight: 0.85 },
        { signal: "user", kind: "cooccur_token", weight: 0.7 },
        { signal: "auth", kind: "domain_hint", weight: 0.95 },
      ],
      answer: "A session is server-side state tied to one visiting user, persisted across their requests via a cookie until they log out or the session times out.",
    }],
  },
  {
    canonical_key: "cookie", display_name: "Cookie", layer: 5,
    senses: [{
      sense_key: "http_cookie",
      description: "A small piece of data the server sends to a browser, which the browser sends back on every subsequent request · used for session identity, preferences, and tracking.",
      domain_hint: ["programming", "http", "auth"],
      confidence: 0.96,
      contexts: [
        { signal: "session", kind: "cooccur_token", weight: 0.9 },
        { signal: "browser", kind: "cooccur_token", weight: 0.85 },
        { signal: "http", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "An HTTP cookie is a small piece of data the server sends to the browser · the browser sends it back on every subsequent request. Cookies typically carry session IDs, not the session data itself.",
    }],
  },
  {
    canonical_key: "auth", display_name: "Auth", layer: 5,
    senses: [{
      sense_key: "authentication_and_authorization",
      description: "The pair of concerns: authentication (proving who you are) + authorization (deciding what you're allowed to do). In NEX, auth lives at `src/lib/auth/*` and `middleware.ts`.",
      domain_hint: ["programming", "security"],
      confidence: 0.97,
      contexts: [
        { signal: "login", kind: "cooccur_token", weight: 0.9 },
        { signal: "session", kind: "cooccur_token", weight: 0.85 },
        { signal: "middleware", kind: "cooccur_token", weight: 0.8 },
        { signal: "authz", kind: "cooccur_token", weight: 0.95 },
        { signal: "authn", kind: "cooccur_token", weight: 0.95 },
        { signal: "security", kind: "domain_hint", weight: 0.95 },
      ],
      answer: "Auth is the pair of concerns: authentication (proving who you are) and authorization (deciding what you're allowed to do). In NEX, auth is enforced by middleware and helpers under `src/lib/auth/`.",
    }],
  },
  {
    canonical_key: "middleware", display_name: "Middleware", layer: 5,
    senses: [{
      sense_key: "request_pipeline_layer",
      description: "Code that runs before (or after) a route handler · used for auth checks, logging, redirects. In Next.js the file is `middleware.ts` at the app root.",
      domain_hint: ["programming", "nextjs"],
      confidence: 0.96,
      contexts: [
        { signal: "handler", kind: "cooccur_token", weight: 0.85 },
        { signal: "auth", kind: "cooccur_token", weight: 0.9 },
        { signal: "next", kind: "cooccur_token", weight: 0.7 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "Middleware is code that runs before or after a route handler. In Next.js, the file `middleware.ts` at the app root can inspect every request · redirect · attach headers · check auth · then continue to the route handler.",
    }],
  },
  {
    canonical_key: "config", display_name: "Config", layer: 5,
    senses: [{
      sense_key: "runtime_configuration",
      description: "Settings that change how a program behaves without changing its code · usually from environment variables, JSON files, or a database.",
      domain_hint: ["programming", "operations"],
      confidence: 0.95,
      contexts: [
        { signal: "environment", kind: "cooccur_token", weight: 0.9 },
        { signal: "env", kind: "cooccur_token", weight: 0.9 },
        { signal: "settings", kind: "cooccur_token", weight: 0.85 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "Config is runtime configuration · settings that change how NEX behaves without changing code. Sourced from environment variables (`.env` / `.env.local`), Postgres tables, or JSON files.",
    }],
  },
  {
    canonical_key: "environment", display_name: "Environment", layer: 5,
    senses: [{
      sense_key: "deployment_environment",
      description: "A named context where the code runs · dev (localhost), staging (pre-production), production (real users). Each has its own database, config, and secrets.",
      domain_hint: ["programming", "operations"],
      confidence: 0.95,
      contexts: [
        { signal: "dev", kind: "cooccur_token", weight: 0.9 },
        { signal: "staging", kind: "cooccur_token", weight: 0.95 },
        { signal: "production", kind: "cooccur_token", weight: 0.95 },
        { signal: "config", kind: "cooccur_token", weight: 0.7 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "An environment is a named context where the code runs — typically dev (localhost), staging, and production. Each has its own database, config, and secrets. NEX's dev environment runs on Postgres at localhost:5433/nex_dev.",
    }],
  },
  {
    canonical_key: "secret", display_name: "Secret", layer: 5,
    senses: [{
      sense_key: "sensitive_credential",
      description: "Sensitive data that must never be committed to Git · API keys, passwords, database URLs. Kept in `.env.local` or a secret store, never in source.",
      domain_hint: ["programming", "security"],
      confidence: 0.98,
      contexts: [
        { signal: "env", kind: "cooccur_token", weight: 0.9 },
        { signal: "api_key", kind: "cooccur_token", weight: 0.95 },
        { signal: "password", kind: "cooccur_token", weight: 0.95 },
        { signal: "credentials", kind: "cooccur_token", weight: 0.9 },
        { signal: "security", kind: "domain_hint", weight: 0.95 },
      ],
      answer: "A secret is any sensitive piece of data — API key, password, database URL — that must never be committed to Git. NEX secrets live in `.env.local` (git-ignored) and the security scanner rejects any commit containing recognisable secret patterns.",
    }],
  },
  {
    canonical_key: "package", display_name: "Package", layer: 5,
    senses: [{
      sense_key: "npm_package",
      description: "A published unit of JavaScript / TypeScript code · imported via `import 'x' from 'x-package'` after being installed with `npm install`.",
      domain_hint: ["programming", "tooling"],
      confidence: 0.96,
      contexts: [
        { signal: "npm", kind: "cooccur_token", weight: 0.95 },
        { signal: "dependency", kind: "cooccur_token", weight: 0.9 },
        { signal: "install", kind: "cooccur_token", weight: 0.85 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A package is a published unit of code · installed via `npm install <name>` and imported via `import from '<name>'`. NEX pins packages in `package.json` and `package-lock.json`.",
    }],
  },
  {
    canonical_key: "dependency", display_name: "Dependency", layer: 5,
    senses: [{
      sense_key: "external_package_the_code_depends_on",
      description: "An external package the code depends on to run · listed in `package.json`.",
      domain_hint: ["programming", "tooling"],
      confidence: 0.95,
      contexts: [
        { signal: "package", kind: "cooccur_token", weight: 0.9 },
        { signal: "npm", kind: "cooccur_token", weight: 0.9 },
        { signal: "install", kind: "cooccur_token", weight: 0.85 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A dependency is an external package the code depends on to run. In NEX, dependencies are declared in `package.json`. ADR rules block certain forbidden dependencies (e.g. `@supabase/*` per ADR-0300).",
    }],
  },
  {
    canonical_key: "pull_request", display_name: "Pull request", layer: 5,
    senses: [{
      sense_key: "github_pull_request",
      description: "A proposal to merge one branch into another · reviewed and discussed before merge. NEX1's auto-apply creates a branch you review manually before merging to main.",
      domain_hint: ["programming", "git", "github"],
      confidence: 0.97,
      contexts: [
        { signal: "pr", kind: "cooccur_token", weight: 0.95 },
        { signal: "merge", kind: "cooccur_token", weight: 0.85 },
        { signal: "review", kind: "cooccur_token", weight: 0.8 },
        { signal: "github", kind: "cooccur_token", weight: 0.9 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A pull request (PR) is a proposal to merge one Git branch into another, usually reviewed and discussed before merge. NEX1's auto-apply leaves you a branch to inspect and merge yourself · nothing lands on main without founder approval.",
    }],
  },
  {
    canonical_key: "model", display_name: "Model", layer: 5,
    senses: [
      {
        sense_key: "data_model",
        description: "A structured representation of an entity in code · often a TypeScript interface matching a database row shape.",
        domain_hint: ["programming", "database"],
        confidence: 0.9,
        contexts: [
          { signal: "database", kind: "cooccur_token", weight: 0.85 },
          { signal: "type", kind: "cooccur_token", weight: 0.8 },
          { signal: "schema", kind: "cooccur_token", weight: 0.85 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "In programming, a model is a structured representation of an entity · often a TypeScript interface matching a database row shape. In `src/lib/*` you'll find models expressed as `interface` or `type` declarations.",
      },
      {
        sense_key: "llm_model",
        description: "A specific trained large language model (LLM) · e.g. Qwen2.5:3B, Llama 3, Claude Opus. Different models have different capabilities and cost/latency profiles.",
        domain_hint: ["ai", "ml"],
        confidence: 0.9,
        contexts: [
          { signal: "llm", kind: "cooccur_token", weight: 0.98 },
          { signal: "ollama", kind: "cooccur_token", weight: 0.95 },
          { signal: "qwen", kind: "cooccur_token", weight: 0.95 },
          { signal: "claude", kind: "cooccur_token", weight: 0.95 },
          { signal: "ai", kind: "domain_hint", weight: 0.95 },
        ],
        answer: "An LLM model is a specific trained large language model · Qwen, Llama, Claude, etc. Different models have different capabilities and cost/latency profiles. NEX runs local Ollama models when `NEX_LOCAL_ONLY=1` is set.",
      },
    ],
  },
  {
    canonical_key: "state", display_name: "State", layer: 5,
    senses: [{
      sense_key: "app_state_data",
      description: "Data a program keeps in memory during a session · like a user's current selections in a UI, or the current focus of a conversation.",
      domain_hint: ["programming", "frontend", "react"],
      confidence: 0.95,
      contexts: [
        { signal: "react", kind: "cooccur_token", weight: 0.9 },
        { signal: "usestate", kind: "cooccur_token", weight: 0.95 },
        { signal: "store", kind: "cooccur_token", weight: 0.7 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "State is data a program keeps during a session · for example a React component's current input values via `useState`, or the current focus of a NEX conversation. State is transient unless explicitly persisted.",
    }],
  },
  {
    canonical_key: "hook", display_name: "Hook", layer: 5,
    senses: [
      {
        sense_key: "react_hook",
        description: "A React function starting with `use*` that lets a component tap into React features · state (`useState`), effects (`useEffect`), context (`useContext`).",
        domain_hint: ["programming", "react"],
        confidence: 0.96,
        contexts: [
          { signal: "react", kind: "cooccur_token", weight: 0.95 },
          { signal: "usestate", kind: "cooccur_token", weight: 0.95 },
          { signal: "useeffect", kind: "cooccur_token", weight: 0.95 },
          { signal: "component", kind: "cooccur_token", weight: 0.8 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A React hook is a function starting with `use*` that lets a component tap into React features · `useState` for state · `useEffect` for side-effects · `useContext` for prop-drilling escape. Hooks only work inside function components.",
      },
      {
        sense_key: "git_hook",
        description: "A script that Git runs at specific events · pre-commit, pre-push. NEX has a pre-commit hook that runs the security scanner + touched-files typecheck.",
        domain_hint: ["programming", "git"],
        confidence: 0.9,
        contexts: [
          { signal: "git", kind: "cooccur_token", weight: 0.95 },
          { signal: "pre-commit", kind: "cooccur_token", weight: 0.95 },
          { signal: "programming", kind: "domain_hint", weight: 0.9 },
        ],
        answer: "A Git hook is a script that Git runs at specific events · pre-commit, pre-push, post-merge. NEX has hooks that run the security scanner and touched-files typecheck before every commit lands.",
      },
    ],
  },
  {
    canonical_key: "component", display_name: "Component", layer: 5,
    senses: [{
      sense_key: "react_component",
      description: "A reusable UI block written as a TypeScript / TSX function · returns JSX and can accept props from its parent.",
      domain_hint: ["programming", "react", "frontend"],
      confidence: 0.97,
      contexts: [
        { signal: "react", kind: "cooccur_token", weight: 0.95 },
        { signal: "jsx", kind: "cooccur_token", weight: 0.9 },
        { signal: "tsx", kind: "cooccur_token", weight: 0.9 },
        { signal: "prop", kind: "cooccur_token", weight: 0.85 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A React component is a reusable UI block written as a TSX function that returns JSX. It accepts props from its parent and can hold internal state. NEX components live under `src/components/` and `src/app/**/*.tsx` for pages.",
    }],
  },
  {
    canonical_key: "prop", display_name: "Prop", layer: 5,
    senses: [{
      sense_key: "react_component_prop",
      description: "A value passed from a parent React component to a child · read-only inside the child. Analogous to function arguments.",
      domain_hint: ["programming", "react"],
      confidence: 0.95,
      contexts: [
        { signal: "component", kind: "cooccur_token", weight: 0.9 },
        { signal: "react", kind: "cooccur_token", weight: 0.9 },
        { signal: "programming", kind: "domain_hint", weight: 0.9 },
      ],
      answer: "A prop is a value passed from a parent React component to a child. Read-only inside the child · analogous to function arguments. Props are how components communicate down the tree.",
    }],
  },
  {
    canonical_key: "plan", display_name: "Plan", layer: 4,
    senses: [{
      sense_key: "nex_agent_plan",
      description: "A structured proposal from NEX1 · lists files to touch, steps, acceptance test, risks, and proposed file contents. Reviewed by NEX2 (architecture) and NEX3 (doctrine) before founder approval.",
      domain_hint: ["nex", "programming"],
      confidence: 1.0,
      contexts: [
        { signal: "nex1", kind: "cooccur_token", weight: 0.9 },
        { signal: "review", kind: "cooccur_token", weight: 0.75 },
        { signal: "proposal", kind: "cooccur_token", weight: 0.85 },
      ],
      answer: "A plan is NEX1's structured proposal for a change · files to touch, ordered steps, acceptance test, risks, and proposed file contents. NEX2 reviews architecture and NEX3 reviews doctrine before you approve.",
    }],
  },
  {
    canonical_key: "brief", display_name: "Engineering brief", layer: 4,
    senses: [{
      sense_key: "nex_agent_engineering_brief",
      description: "A ready-to-send markdown summary NEX1 produces when consensus is reached · includes intent, rounds of discussion, acceptance test, and the diff-ready plan.",
      domain_hint: ["nex", "programming"],
      confidence: 1.0,
      contexts: [
        { signal: "plan", kind: "cooccur_token", weight: 0.85 },
        { signal: "nex1", kind: "cooccur_token", weight: 0.9 },
      ],
      answer: "A brief is the ready-to-send markdown summary NEX1 produces when consensus is reached. It captures the intent, rounds of debate, acceptance test, and the diff-ready plan. You paste it into an execution session or approve directly.",
    }],
  },
  {
    canonical_key: "doctrine", display_name: "Doctrine", layer: 4,
    senses: [{
      sense_key: "nex_coding_doctrine",
      description: "The set of immutable rules NEX must obey · read from `rules/NEX-CODING-DOCTRINE.md`. NEX3 checks every plan against doctrine before founder approval.",
      domain_hint: ["nex", "governance"],
      confidence: 1.0,
      contexts: [
        { signal: "rules", kind: "cooccur_token", weight: 0.9 },
        { signal: "immutable", kind: "cooccur_token", weight: 0.85 },
        { signal: "nex3", kind: "cooccur_token", weight: 0.95 },
        { signal: "adr", kind: "cooccur_token", weight: 0.85 },
      ],
      answer: "Doctrine is the set of immutable rules NEX must obey · read from `rules/NEX-CODING-DOCTRINE.md` and enforced via NEX3's review. Doctrine additions are ADRs · founder-authorized only.",
    }],
  },
];

const CANONICAL_KEY_RE = /^[a-z][a-z0-9_]*$/;
const SENSE_KEY_RE = /^[a-z][a-z0-9_]*$/;
function guardConcept(c) {
  if (!CANONICAL_KEY_RE.test(c.canonical_key)) return { ok: false, reason: `bad_ck:${c.canonical_key}` };
  return { ok: true };
}
function guardSense(s) {
  if (!SENSE_KEY_RE.test(s.sense_key)) return { ok: false, reason: `bad_sk:${s.sense_key}` };
  if (!s.description || s.description.length < 4) return { ok: false, reason: "desc_short" };
  return { ok: true };
}

async function main() {
  const c = new Client({ connectionString: PGURL });
  await c.connect();
  const stats = { concepts_seen: 0, concepts_inserted: 0, senses_inserted: 0, contexts_inserted: 0, answers_inserted: 0, evidence_inserted: 0, guardian_rejects: 0 };
  try {
    for (const conceptSpec of CORPUS) {
      stats.concepts_seen++;
      const gc = guardConcept(conceptSpec);
      if (!gc.ok) { console.log(`  ✗ concept ${conceptSpec.canonical_key}: ${gc.reason}`); stats.guardian_rejects++; continue; }
      await c.query("BEGIN");
      try {
        const conceptRow = (await c.query(
          `INSERT INTO nex.concepts (canonical_key, display_name, layer, status)
           VALUES ($1, $2, $3, 'authoritative')
           ON CONFLICT (canonical_key) DO UPDATE SET display_name=EXCLUDED.display_name, status='authoritative'
           RETURNING concept_id, xmax`,
          [conceptSpec.canonical_key, conceptSpec.display_name, conceptSpec.layer]
        )).rows[0];
        const wasInsert = conceptRow.xmax === "0" || conceptRow.xmax === 0;
        if (wasInsert) stats.concepts_inserted++;
        for (const senseSpec of conceptSpec.senses) {
          const gs = guardSense(senseSpec);
          if (!gs.ok) { console.log(`  ✗ sense ${conceptSpec.canonical_key}.${senseSpec.sense_key}: ${gs.reason}`); stats.guardian_rejects++; continue; }
          const senseRow = (await c.query(
            `INSERT INTO nex.concept_senses (concept_id, sense_key, description, domain_hint, confidence, status)
             VALUES ($1, $2, $3, $4, $5, 'authoritative')
             ON CONFLICT (concept_id, sense_key) DO UPDATE
               SET description=EXCLUDED.description, domain_hint=EXCLUDED.domain_hint, confidence=EXCLUDED.confidence, status='authoritative'
             RETURNING sense_id, xmax`,
            [conceptRow.concept_id, senseSpec.sense_key, senseSpec.description, senseSpec.domain_hint, senseSpec.confidence]
          )).rows[0];
          const senseIns = senseRow.xmax === "0" || senseRow.xmax === 0;
          if (senseIns) {
            stats.senses_inserted++;
            await c.query(
              `INSERT INTO nex.evidence (subject_kind, subject_id, source_ref, trust_layer, confidence, captured_by)
               VALUES ('sense', $1, $2, 'canonical_verified', $3, $4)`,
              [senseRow.sense_id, SOURCE_REF, senseSpec.confidence, CAPTURED_BY]
            );
            stats.evidence_inserted++;
          }
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
        console.log(`  ✗ ${conceptSpec.canonical_key} rollback: ${e.message}`);
      }
    }
    console.log("\n=== Layer 1 expand complete ===");
    console.log("stats:", JSON.stringify(stats));
  } finally { await c.end(); }
}

main().catch(e => { console.error(e); process.exit(1); });
