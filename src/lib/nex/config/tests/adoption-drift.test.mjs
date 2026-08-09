#!/usr/bin/env node
// adoption-drift.test.mjs · Wave 11 · Step 11 · Group F drift-catcher
//
// Enforces the architectural invariants that F28 (NEX_POSTGRES_URL
// centralization) and F31 (env-var documentation completeness) put in
// place. Any future PR that violates these will fail CI.
//
//   CFGA1 · getPostgresUrl / getPostgresUrlOrNull / hasPostgresUrl are
//           defined in exactly ONE file (src/lib/nex/config/pg.ts).
//   CFGA2 · Every HQ file that reads NEX_POSTGRES_URL directly is on
//           the CFGA2_KNOWN_EXCEPTIONS allowlist. The list may NOT
//           GROW without explicit authorization.
//   CFGA3 · getFeatureGates is defined in exactly ONE file
//           (src/lib/nex/config/gates.ts).
//   CFGA4 · /api/nex/storage/gates route exists and imports
//           getFeatureGates from the canonical module.
//   CFGA5 · Every gate env var in GATE_ENV_NAMES appears in
//           .env.example (F31 doc-completeness).
//
// Non-HQ callsites (src/lib/nex/{contacts,campaigns,composer,imports,
// segments,ai}/**) are OUT OF WAVE 11 SCOPE and NOT enforced here.
// They will be migrated when the Trade Centre audit runs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const BRAIN     = join(REPO, "src/lib/nex/brain");
const STORAGE   = join(REPO, "src/lib/nex/storage");
const DB_TS     = join(REPO, "src/lib/nex/db.ts");

// ── helpers ──────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "tests" || entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walk(p));
    } else if (entry.endsWith(".ts") || entry.endsWith(".mjs")) {
      out.push(p);
    }
  }
  return out;
}

function read(p) { return readFileSync(p, "utf8"); }
function rel(p)  { return relative(REPO, p).replace(/\\/g, "/"); }

// HQ surface for CFGA2. Wave 11 audit § F28 scoped this to Headquarters.
// Non-HQ callsites (contacts/campaigns/composer/imports/segments/ai) are
// intentionally OUT of scope · migrating them belongs to the Trade Centre
// audit lifecycle, not Wave 11.
const HQ_ROOTS = [
  join(REPO, "src/lib/nex/brain"),
  join(REPO, "src/lib/nex/storage"),
  join(REPO, "src/lib/nex/knowledge-inbox"),
  join(REPO, "src/lib/nex/jobs"),
  join(REPO, "src/lib/nex/observability"),
  join(REPO, "src/lib/nex/config"),
  join(REPO, "src/lib/nex/api"),
  join(REPO, "src/lib/nex/db"),
];

function collectHqFiles() {
  const files = [];
  for (const root of HQ_ROOTS) files.push(...walk(root));
  if (existsSync(DB_TS)) files.push(DB_TS);
  return files;
}

// F28 known-exception list · files where a direct process.env.NEX_POSTGRES_URL
// read is INTENTIONALLY retained after Step 11 migration. Growth of this
// list requires explicit product authorization AND an updated audit doc.
const CFGA2_KNOWN_EXCEPTIONS = new Set([
  // src/lib/nex/config/pg.ts is the canonical reader · MUST be here.
  "src/lib/nex/config/pg.ts",
  // src/lib/nex/config/gates.ts reads gate env vars only for reporting ·
  // and delegates URL validity to pg.ts via hasPostgresUrl(). No direct
  // NEX_POSTGRES_URL read here after F28 · listed so a future edit
  // that adds one gets caught rather than silently accepted.
]);

// ── CFGA1 · canonical pg helpers defined exactly once ────────────────

test("CFGA1 · getPostgresUrl + getPostgresUrlOrNull + hasPostgresUrl defined exactly once (config/pg.ts)", () => {
  const helpers = ["getPostgresUrl", "getPostgresUrlOrNull", "hasPostgresUrl"];
  const files = collectHqFiles();

  for (const helper of helpers) {
    const re = new RegExp(`^\\s*(?:export\\s+)?function\\s+${helper}\\s*\\(`, "m");
    const hits = [];
    for (const f of files) {
      if (re.test(read(f))) hits.push(rel(f));
    }
    assert.equal(hits.length, 1,
      `${helper} must be defined exactly once · found ${hits.length}: ${hits.join(", ")}`);
    assert.equal(hits[0], "src/lib/nex/config/pg.ts",
      `${helper} must live in src/lib/nex/config/pg.ts · found in ${hits[0]}`);
  }
});

// ── CFGA2 · HQ files reading NEX_POSTGRES_URL are on the allowlist ──

test("CFGA2 · HQ files that read process.env.NEX_POSTGRES_URL directly are on CFGA2_KNOWN_EXCEPTIONS · list cannot grow silently", () => {
  const files = collectHqFiles();
  const violations = [];
  for (const f of files) {
    const src  = read(f);
    const path = rel(f);
    // We only care about DIRECT reads (`process.env.NEX_POSTGRES_URL`).
    // Comments and JSDoc references that mention the variable name are
    // filtered out by requiring the `process.env.` prefix.
    if (/process\.env\.NEX_POSTGRES_URL\b/.test(src)) {
      violations.push(path);
    }
  }

  // Every violation must be on the allowlist. New file appearing → fail.
  const unauthorized = violations.filter(p => !CFGA2_KNOWN_EXCEPTIONS.has(p));
  assert.equal(unauthorized.length, 0,
    `HQ file reads NEX_POSTGRES_URL outside src/lib/nex/config/pg.ts · either migrate to getPostgresUrl / getPostgresUrlOrNull / hasPostgresUrl, OR add to CFGA2_KNOWN_EXCEPTIONS with justification: ${unauthorized.join(", ")}`);

  // Listed allowlist entries must still be real · dead exceptions rot.
  for (const path of CFGA2_KNOWN_EXCEPTIONS) {
    const stillReads = violations.includes(path);
    assert.ok(stillReads,
      `CFGA2 allowlist entry ${path} no longer reads NEX_POSTGRES_URL · remove it from CFGA2_KNOWN_EXCEPTIONS`);
  }
});

// ── CFGA3 · gates helper defined exactly once ────────────────────────

test("CFGA3 · getFeatureGates defined exactly once (config/gates.ts)", () => {
  const files = collectHqFiles();
  const re = /^\s*(?:export\s+)?function\s+getFeatureGates\s*\(/m;
  const hits = [];
  for (const f of files) {
    if (re.test(read(f))) hits.push(rel(f));
  }
  assert.equal(hits.length, 1,
    `getFeatureGates must be defined exactly once · found ${hits.length}: ${hits.join(", ")}`);
  assert.equal(hits[0], "src/lib/nex/config/gates.ts");
});

// ── CFGA4 · /api/nex/storage/gates route wired correctly ─────────────

test("CFGA4 · /api/nex/storage/gates GET route exists and imports getFeatureGates from the canonical module", () => {
  const routePath = join(REPO, "src/app/api/nex/storage/gates/route.ts");
  assert.ok(existsSync(routePath),
    `F29 route src/app/api/nex/storage/gates/route.ts must exist`);
  const src = read(routePath);
  assert.match(src, /export\s+async\s+function\s+GET\s*\(/,
    "route must export an async GET handler");
  assert.match(src, /from\s+["']@\/lib\/nex\/config\/gates["']/,
    "route MUST import from the canonical config/gates module · not re-implement the gate schema");
  assert.match(src, /getFeatureGates\s*\(/,
    "route must call getFeatureGates()");
});

// ── CFGA5 · every gate env var documented in .env.example ────────────

test("CFGA5 · every gate env var in GATE_ENV_NAMES appears in .env.example (F31 doc-completeness)", () => {
  const envExamplePath = join(REPO, ".env.example");
  assert.ok(existsSync(envExamplePath), ".env.example must exist (F30 baseline)");
  const envExample = read(envExamplePath);

  // Read GATE_ENV_NAMES from gates.ts by parsing (avoids a runtime import
  // that would require the whole module graph). Reject if the list can't
  // be extracted — the test relies on it as the source of truth.
  const gatesSrc = read(join(REPO, "src/lib/nex/config/gates.ts"));
  const listMatch = gatesSrc.match(/GATE_ENV_NAMES\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(listMatch, "GATE_ENV_NAMES must be a literal array in gates.ts · required by CFGA5");

  const names = [...listMatch[1].matchAll(/"([A-Z0-9_]+)"/g)].map(m => m[1]);
  assert.ok(names.length >= 6, `expected ≥6 gate names · got ${names.length}`);

  const missing = names.filter(n => !new RegExp(`^${n}=`, "m").test(envExample));
  assert.equal(missing.length, 0,
    `gate env vars missing from .env.example · every gate must be documented (even if unset): ${missing.join(", ")}`);
});
