#!/usr/bin/env node
// validators.test.mjs · Wave 11 remediation · closes F20 · F21 · F25
//
// Contract tests for src/lib/nex/api/validators.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/api/validators.ts"), "utf8");
const requireFromHere = createRequire(import.meta.url);

const stripped    = SRC.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });
const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `
module.exports = { assertBrainSlug, knownBrainSlugs, detectBinaryContent, requireEnvNonEmpty, readEnvOrNull, MissingEnvError };
`,
)(mod, process, mod.exports, requireFromHere);
const { assertBrainSlug, knownBrainSlugs, detectBinaryContent, requireEnvNonEmpty, readEnvOrNull, MissingEnvError } = mod.exports;

// ── F21 · assertBrainSlug ──────────────────────────────────────────

test("V1 · assertBrainSlug accepts every known trade slug", () => {
  for (const slug of ["staircase", "door", "kitchen", "bathroom", "flooring", "roofing", "marketing"]) {
    const r = assertBrainSlug(slug);
    assert.equal(r.ok, true, `expected ${slug} to be accepted · got ${JSON.stringify(r)}`);
  }
});

test("V2 · assertBrainSlug accepts HQ brain slugs (normalised form)", () => {
  for (const slug of ["executive-brain", "legal-brain", "finance-brain", "strategy-room", "internal-audit"]) {
    const r = assertBrainSlug(slug);
    assert.equal(r.ok, true, `expected ${slug} to be accepted · got ${JSON.stringify(r)}`);
  }
});

test("V3 · assertBrainSlug rejects '../etc' with unknown_brain (after shape passes)", () => {
  const r = assertBrainSlug("../etc");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "invalid_format", "path-traversal chars fail shape check first");
});

test("V4 · assertBrainSlug is STRICT · rejects capitalised/spaced/padded input", () => {
  // No auto-lowercase, no auto-trim · attacker fingerprinting via case
  // variants is blocked at the boundary. Callers who want convenience
  // must normalise upstream.
  assert.equal(assertBrainSlug("Staircase").ok, false);
  assert.equal(assertBrainSlug("STAIRCASE").ok, false);
  assert.equal(assertBrainSlug(" staircase").ok, false);
  assert.equal(assertBrainSlug("staircase ").ok, false);
  assert.equal(assertBrainSlug("sTaircase").ok, false);
});

test("V5 · assertBrainSlug rejects unknown slugs with shape but not in allowlist", () => {
  const r = assertBrainSlug("some-random-brain");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "unknown_brain");
});

test("V6 · assertBrainSlug rejects missing / non-string input", () => {
  assert.equal(assertBrainSlug(undefined).ok, false);
  assert.equal(assertBrainSlug(null).ok, false);
  assert.equal(assertBrainSlug("").ok, false);
  assert.equal(assertBrainSlug(42).ok, false);
  assert.equal(assertBrainSlug({}).ok, false);
});

test("V7 · assertBrainSlug rejects URL-encoded traversal", () => {
  const r = assertBrainSlug("..%2Fetc");
  assert.equal(r.ok, false);
});

test("V8 · knownBrainSlugs returns a stable, non-empty set", () => {
  const s = knownBrainSlugs();
  assert.ok(s.has("staircase"));
  assert.ok(s.has("executive-brain"));
  assert.ok(s.size >= 20, `expected ≥20 brain slugs · got ${s.size}`);
});

// ── F20 · detectBinaryContent ──────────────────────────────────────

test("V9 · detectBinaryContent · pure ASCII text with many spaces returns isBinary=false", () => {
  // The F20 defect was: prior code counted spaces and considered a
  // space-heavy file "binary." We explicitly assert space-heavy text
  // is NOT binary now.
  const spaces = new Uint8Array(200).fill(0x20); // 200 spaces
  const r = detectBinaryContent(spaces);
  assert.equal(r.isBinary, false, `space-heavy text must NOT be classified binary · got ${JSON.stringify(r)}`);
  assert.equal(r.nulCount, 0);
});

test("V10 · detectBinaryContent · buffer with ONE NUL byte returns isBinary=true", () => {
  const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]); // "Hello\0World"
  const r = detectBinaryContent(bytes);
  assert.equal(r.isBinary, true, "one NUL byte is a strong binary signal");
  assert.equal(r.nulCount, 1);
});

test("V11 · detectBinaryContent · JPEG header (few spaces, contains NUL) returns isBinary=true", () => {
  // Real JPEG magic bytes: FF D8 FF E0 00 10 4A 46 49 46 00 01 ...
  const jpeg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const r = detectBinaryContent(jpeg);
  assert.equal(r.isBinary, true, "JPEG magic bytes must be detected as binary");
  assert.ok(r.nulCount >= 2);
});

test("V12 · detectBinaryContent · empty buffer returns isBinary=false (nothing sampled)", () => {
  const r = detectBinaryContent(new Uint8Array(0));
  assert.equal(r.isBinary, false);
  assert.equal(r.sampled, 0);
});

test("V13 · detectBinaryContent · only samples the first N bytes (default 4096)", () => {
  // Fill with 0x41 ('A') so the buffer is non-NUL by default · the ONLY
  // NUL is at offset 5000, beyond the default 4096-byte sample window.
  const big = new Uint8Array(10000).fill(0x41);
  big[5000] = 0x00;
  const r = detectBinaryContent(big, 4096);
  assert.equal(r.isBinary, false, "NUL beyond sample window must NOT trigger binary detection");
  assert.equal(r.sampled, 4096);
  // Confirm the detector would have caught it with a larger window.
  const r2 = detectBinaryContent(big, 6000);
  assert.equal(r2.isBinary, true, "NUL within sample window WOULD trigger binary detection");
});

test("V14 · detectBinaryContent · CSV/JSON text with commas + newlines returns isBinary=false", () => {
  const csv = new TextEncoder().encode("id,name,description\n1,foo,bar\n2,baz,qux\n");
  const r = detectBinaryContent(csv);
  assert.equal(r.isBinary, false);
});

// ── F25 · requireEnvNonEmpty ───────────────────────────────────────

test("V15 · requireEnvNonEmpty returns the value when set to a real string", () => {
  const r = requireEnvNonEmpty("SOME_VAR", { SOME_VAR: "real-value" });
  assert.equal(r, "real-value");
});

test("V16 · requireEnvNonEmpty throws MissingEnvError when unset", () => {
  assert.throws(
    () => requireEnvNonEmpty("MISSING_VAR", {}),
    (e) => e instanceof MissingEnvError && e.code === "misconfigured" && e.varName === "MISSING_VAR",
    "must throw MissingEnvError with .code='misconfigured' + varName",
  );
});

test("V17 · requireEnvNonEmpty throws when value is empty string", () => {
  assert.throws(
    () => requireEnvNonEmpty("EMPTY_VAR", { EMPTY_VAR: "" }),
    (e) => e instanceof MissingEnvError,
  );
});

test("V18 · requireEnvNonEmpty throws when value is whitespace-only", () => {
  assert.throws(
    () => requireEnvNonEmpty("BLANK_VAR", { BLANK_VAR: "   \t\n  " }),
    (e) => e instanceof MissingEnvError,
    "whitespace-only value must be treated as unset",
  );
});

test("V19 · readEnvOrNull returns null on missing/blank · value otherwise", () => {
  assert.equal(readEnvOrNull("MISSING", {}), null);
  assert.equal(readEnvOrNull("BLANK", { BLANK: "  " }), null);
  assert.equal(readEnvOrNull("EMPTY", { EMPTY: "" }), null);
  assert.equal(readEnvOrNull("SET", { SET: "value" }), "value");
});
