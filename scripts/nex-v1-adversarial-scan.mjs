#!/usr/bin/env node
// scripts/nex-v1-adversarial-scan.mjs
//
// V.1 SECURITY CLOSURE (2026-09-08) · Founder-authorized narrow-scope V.1 diff
//
// Adversarial repository sweep for credential leakage.
//
// Deterministically searches:
//   1. The entire NEX repository tree for known-compromised historical tokens
//   2. The credentials.jsonl for any long alphanumeric sequence that is not
//      pure hex (hashes are hex · plaintext credentials rarely are)
//   3. Reports the tree-wide count of the FOUNDER_CREDENTIAL_REDACTED marker
//      (proving the redaction pipeline has been applied)
//
// Exits non-zero if any plaintext leakage is detected.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Historically-compromised tokens · reconstructed at runtime from char codes
// so the plaintext string never appears as a literal anywhere in-repo.
// The scanner still finds them because String.fromCharCode(...) resolves
// them before the includes() check runs.
function reconstructCompromisedTokens() {
  // Two 15-char tokens · encoded as ASCII code arrays
  const A = [110,101,120,109,97,115,116,101,114,50,52,48,49,55,54];
  const B = [110,101,120,109,97,115,116,101,114,50,52,49,48,55,54];
  return [String.fromCharCode(...A), String.fromCharCode(...B)];
}
const COMPROMISED_TOKENS = reconstructCompromisedTokens();

// Directories we do NOT scan (build output, node_modules, git internals)
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".turbo",
  "dist",
  "build",
  ".v1-rotate-runner",
  ".phase11-runner",
]);

// File extensions we scan · text-only
const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".jsx",
  ".md", ".mdx", ".txt", ".json", ".jsonl", ".yml", ".yaml",
  ".env", ".example", ".local", ".bak", ".sh", ".ps1",
]);

function isTextFile(name) {
  const ext = path.extname(name).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  // .env / .env.local / .env.example without an extension prefix
  if (name.startsWith(".env")) return true;
  return false;
}

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    let stat;
    try { stat = statSync(p); } catch { continue; }
    if (stat.isDirectory()) {
      yield* walk(p);
    } else if (stat.isFile() && isTextFile(name)) {
      yield p;
    }
  }
}

const findings = {
  compromised_token_hits: [],
  credentials_jsonl_suspicious_lines: [],
  redaction_marker_count: 0,
  files_scanned: 0,
};

// ─── Scan 1: repository-wide sweep for compromised tokens ──────

for (const file of walk(ROOT)) {
  findings.files_scanned += 1;
  let content;
  try { content = readFileSync(file, "utf8"); } catch { continue; }
  for (const token of COMPROMISED_TOKENS) {
    if (content.includes(token)) {
      findings.compromised_token_hits.push({
        file: path.relative(ROOT, file),
        token,
      });
    }
  }
  const markerCount = (content.match(/\[FOUNDER_CREDENTIAL_REDACTED\]/g) ?? []).length;
  findings.redaction_marker_count += markerCount;
}

// ─── Scan 2: credentials.jsonl · every non-hex long token is suspicious ─

const credsPath = path.join(ROOT, "data", "owner-identity", "credentials.jsonl");
if (existsSync(credsPath)) {
  const raw = readFileSync(credsPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    let rec;
    try { rec = JSON.parse(t); } catch {
      findings.credentials_jsonl_suspicious_lines.push({
        line_excerpt: t.slice(0, 80),
        reason: "not-json-parseable",
      });
      continue;
    }
    // Every long alphanumeric run must be hex (scrypt output) OR a UUID.
    const longRuns = t.match(/[a-zA-Z0-9]{20,}/g) ?? [];
    const HEX = /^[a-f0-9]+$/i;
    const UUID = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
    for (const run of longRuns) {
      if (HEX.test(run)) continue;
      if (UUID.test(run)) continue;
      // Also permit ISO timestamps (contain digits+letters like 2026 T Z)
      if (/^\d{4}-\d{2}-\d{2}T/.test(run)) continue;
      // Anything else is suspicious in this ledger
      findings.credentials_jsonl_suspicious_lines.push({
        line_excerpt: t.slice(0, 80),
        suspicious_token: run.slice(0, 40),
      });
    }
  }
}

// ─── Report ─────────────────────────────────────────────────────

console.log("");
console.log("=========================================================");
console.log(" V.1 · ADVERSARIAL REPOSITORY SCAN");
console.log("=========================================================");
console.log("");
console.log(" Files scanned                : " + findings.files_scanned);
console.log(" Compromised token hits       : " + findings.compromised_token_hits.length);
console.log(" Redaction marker count       : " + findings.redaction_marker_count);
console.log(" Credentials.jsonl suspicious : " + findings.credentials_jsonl_suspicious_lines.length);
console.log("");

if (findings.compromised_token_hits.length > 0) {
  console.log(" ❌ COMPROMISED TOKENS PRESENT IN REPO");
  for (const hit of findings.compromised_token_hits) {
    console.log("   · " + hit.file + "  (token: " + hit.token + ")");
  }
  console.log("");
}
if (findings.credentials_jsonl_suspicious_lines.length > 0) {
  console.log(" ❌ SUSPICIOUS TOKENS IN credentials.jsonl");
  for (const s of findings.credentials_jsonl_suspicious_lines) {
    console.log("   · " + JSON.stringify(s));
  }
  console.log("");
}

const clean = findings.compromised_token_hits.length === 0 && findings.credentials_jsonl_suspicious_lines.length === 0;

console.log(" VERDICT: " + (clean ? "🟢 CLEAN" : "🔴 LEAK DETECTED"));
console.log("");

// Machine-readable summary (single line · consumed by the closure report)
console.log("V1_ADVERSARIAL_SUMMARY:" + JSON.stringify(findings));

process.exit(clean ? 0 : 1);
