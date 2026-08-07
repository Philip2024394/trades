#!/usr/bin/env node
// verify-comms-social-boundaries.mjs
//
// Enforces the Charter v0.2 import boundaries for the Comms Centre
// Social Engine. Exits 1 on any violation. Intended to run in CI + as
// a pre-commit hook.
//
// Rules enforced:
//   R1 · No file under src/lib/nex/comms-social/** may import ../social/ (Hammerex).
//   R2 · No file under src/lib/nex/comms-social/** may import @/lib/supabaseAdmin.
//   R3 · No file under src/lib/nex/comms-social/** may import @/lib/nex/predictive/**.
//   R4 · No file under src/lib/nex/comms-social/** may import @/lib/nex/delivery/**
//        (per invariant #15 spirit + charter S-XII isolation).
//   R5 · No file under src/lib/nex/comms-social/** may import @/lib/nex/compliance/**.
//   R6 · Only files under src/lib/nex/comms-social/adapters/*.ts may import
//        a social-provider SDK. Provider-SDK package list is curated below;
//        add packages as adapters land (this list is expected to grow).
//   R7 · No file may import from `src/lib/nex/comms-social` INTO the Hammerex
//        social module at src/lib/nex/social/** (prevents accidental
//        reverse-coupling).
//
// Any failure produces a numbered violation report and non-zero exit.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO = process.cwd();
const COMMS_SOCIAL_ROOT = join(REPO, "src", "lib", "nex", "comms-social");
const HAMMEREX_SOCIAL_ROOT = join(REPO, "src", "lib", "nex", "social");
const ADAPTERS_ROOT = join(COMMS_SOCIAL_ROOT, "adapters");

// Provider SDK package names. When real adapters land in Phase 5 they
// import from these packages · anywhere OUTSIDE ADAPTERS_ROOT is a
// violation.
const PROVIDER_SDK_PACKAGES = [
  "facebook-nodejs-business-sdk",
  "instagram-graph-api",
  "linkedin-api-client",
  "@linkedin/api-client",
  "tiktok-business-api-sdk",
  "@googlemaps/google-business-profile",
];

const FORBIDDEN_IN_COMMS_SOCIAL = [
  { rule: "R1", needle: /from\s+["'](?:\.\.\/)+social\//,        desc: "Hammerex ../social/ import forbidden" },
  { rule: "R2", needle: /from\s+["']@\/lib\/supabaseAdmin["']/,  desc: "Supabase admin client forbidden" },
  { rule: "R3", needle: /from\s+["']@\/lib\/nex\/predictive/,    desc: "Predictive Engine import forbidden (S-XII)" },
  { rule: "R4", needle: /from\s+["']@\/lib\/nex\/delivery/,      desc: "Delivery domain import forbidden (invariant #15 spirit)" },
  { rule: "R5", needle: /from\s+["']@\/lib\/nex\/compliance/,    desc: "Compliance domain import forbidden" },
];

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      // Skip tests/ folder — tests need to reference forbidden patterns
      // as literal strings to prove the verifier catches them.
      if (entry === "tests") continue;
      results.push(...walk(p));
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.mjs")) {
      results.push(p);
    }
  }
  return results;
}

function isUnder(root, path) {
  const r = relative(root, path);
  return !r.startsWith("..") && !r.startsWith(sep) && r !== "";
}

const violations = [];

// Comms-social files
if (safeExists(COMMS_SOCIAL_ROOT)) {
  const files = walk(COMMS_SOCIAL_ROOT);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const { rule, needle, desc } of FORBIDDEN_IN_COMMS_SOCIAL) {
      if (needle.test(src)) {
        violations.push({ rule, file: relative(REPO, file), desc });
      }
    }
    const insideAdapters = isUnder(ADAPTERS_ROOT, file);
    for (const pkg of PROVIDER_SDK_PACKAGES) {
      const p = escapeRegex(pkg);
      // Match both `from "pkg"` (or 'pkg' or "pkg/sub") AND bare `import "pkg"` / `require("pkg")`.
      const patterns = [
        new RegExp(`from\\s+["']${p}(?:["'/])`),
        new RegExp(`import\\s+["']${p}(?:["'/])`),
        new RegExp(`require\\(\\s*["']${p}(?:["'/])`),
      ];
      if (patterns.some((re) => re.test(src))) {
        if (!insideAdapters) {
          violations.push({
            rule: "R6",
            file: relative(REPO, file),
            desc: `Provider SDK "${pkg}" imported outside adapters/ folder`,
          });
        }
      }
    }
  }
}

// Reverse-coupling: Hammerex social must not import comms-social.
if (safeExists(HAMMEREX_SOCIAL_ROOT)) {
  const hxFiles = walk(HAMMEREX_SOCIAL_ROOT);
  for (const file of hxFiles) {
    const src = readFileSync(file, "utf8");
    if (/from\s+["']@\/lib\/nex\/comms-social/.test(src)
        || /from\s+["'](?:\.\.\/)+comms-social/.test(src)) {
      violations.push({
        rule: "R7",
        file: relative(REPO, file),
        desc: "Hammerex social must not import Comms Centre comms-social",
      });
    }
  }
}

if (violations.length === 0) {
  process.stdout.write("verify-comms-social-boundaries · OK · zero violations\n");
  process.exit(0);
}
process.stdout.write(`verify-comms-social-boundaries · FAIL · ${violations.length} violation(s)\n`);
for (const [i, v] of violations.entries()) {
  process.stdout.write(`  ${i + 1}. [${v.rule}] ${v.file} — ${v.desc}\n`);
}
process.exit(1);

// ── helpers ────────────────────────────────────────────────────
function safeExists(p) {
  try { statSync(p); return true; } catch { return false; }
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
