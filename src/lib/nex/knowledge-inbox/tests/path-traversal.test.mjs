#!/usr/bin/env node
// path-traversal.test.mjs · Wave 11 remediation · closes F16
//
// F16 was: readItemContent in src/lib/nex/knowledge-inbox/storage.ts
// joined item.contentPath with ROOT via path.join and read the result
// with fs.readFile. No confinement check. A corrupted index.json (or
// any code path that could influence item.contentPath) could name a
// path like "../../../etc/passwd" and the reader would happily return
// its contents.
//
// The fix: assertPathConfined(base, relative) is now called before
// fs.readFile. It throws a distinctive `path-escape` error when the
// resolved path escapes the base directory. Throwing (not returning
// null) is deliberate — callers must see the escape so the API layer
// can 500 + audit rather than silently returning "no content."
//
// Assertions:
//   PT1  · assertPathConfined exported
//   PT2  · confined path (e.g. "content/foo.txt") resolves cleanly
//   PT3  · nested confined path (e.g. "content/nested/foo.txt") resolves cleanly
//   PT4  · "../../../etc/passwd" throws path-escape
//   PT5  · absolute path outside base throws path-escape
//   PT6  · "..\\..\\Windows\\System32" throws path-escape (Windows-style)
//   PT7  · sneaky "content/../../secret" (escapes despite prefix) throws path-escape
//   PT8  · empty relative is treated as base itself (allowed)
//   PT9  · readItemContent throws path-escape (does NOT return null) on escape
//   PT10 · readItemContent returns null on ENOENT for a CONFINED path (existing behavior preserved)
//   PT11 · readItemContent returns null when neither contentPath nor url is set

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC       = readFileSync(join(REPO, "src/lib/nex/knowledge-inbox/storage.ts"), "utf8");
const requireFromHere = createRequire(import.meta.url);

// Isolated temp base so we exercise the guard against a real filesystem.
const TMP_ROOT = join(tmpdir(), `nex-path-traversal-${Date.now()}-${process.pid}`);
mkdirSync(TMP_ROOT, { recursive: true });
mkdirSync(join(TMP_ROOT, "content"), { recursive: true });
writeFileSync(join(TMP_ROOT, "content", "sample.txt"), "hello-inbox");

// Rewrite ROOT so the transpiled module reads from our temp dir.
const rewritten = SRC.replace(
  /const ROOT = path\.join\(process\.cwd\(\), "data", "knowledge-inbox"\);/,
  `const ROOT = ${JSON.stringify(TMP_ROOT)};`,
);
const stripped = rewritten.replace(/^export\s+/gm, "");
const transformed = await esbuild.transform(stripped, { loader: "ts", format: "cjs", target: "node20" });

// Stub every non-node dependency so the module loads standalone.
const stubs = {
  "./types":                { EMPTY_STATS: { completedToday: 0, completedTodayDate: "", imagesAnalysed: 0, voiceNotesTranscribed: 0, lastProcessedAt: null } },
  "@/lib/nex/brain/storage": { brainStore: () => ({}) },
  "@/lib/nex/storage/object-registry": { getObjectStorage: () => ({ put: async () => ({}), get: async () => null, head: async () => null }) },
  "@/lib/nex/storage/object-types":    { BUCKETS: { uploads: "uploads" } },
  "./pg-shadow": {
    shadowDeleteInboxItem:    async () => {},
    shadowUpdateInboxStatuses: async () => {},
    shadowUpsertInboxItem:    async () => {},
    shadowUpsertInboxStats:   async () => {},
  },
  "./pg-reads": {
    isPostgresReadEnabled:  () => false,
    readIndexFromPostgres:  async () => null,
    readStatsFromPostgres:  async () => null,
  },
};
const shimRequire = (id) => (id in stubs ? stubs[id] : requireFromHere(id));

const mod = { exports: {} };
new Function("module", "process", "exports", "require",
  transformed.code + `
module.exports = { assertPathConfined, readItemContent };
`,
)(mod, process, mod.exports, shimRequire);
const { assertPathConfined, readItemContent } = mod.exports;

// ── STATIC EXPORT ──────────────────────────────────────────────────

test("PT1 · assertPathConfined is exported", () => {
  assert.equal(typeof assertPathConfined, "function");
});

// ── PURE-FUNCTION ASSERTIONS ON THE GUARD ─────────────────────────

test("PT2 · confined relative path (content/foo.txt) resolves cleanly", () => {
  const out = assertPathConfined(TMP_ROOT, "content/foo.txt");
  assert.ok(out.startsWith(TMP_ROOT), `resolved ${out} must start with base ${TMP_ROOT}`);
});

test("PT3 · nested confined path resolves cleanly", () => {
  const out = assertPathConfined(TMP_ROOT, "content/nested/sub/foo.txt");
  assert.ok(out.startsWith(TMP_ROOT));
});

test("PT4 · ../../../etc/passwd throws path-escape", () => {
  assert.throws(
    () => assertPathConfined(TMP_ROOT, "../../../etc/passwd"),
    (err) => err.code === "path-escape",
    "must throw with err.code === 'path-escape'",
  );
});

test("PT5 · absolute path outside base throws path-escape", () => {
  const outsideAbs = process.platform === "win32" ? "C:\\Windows\\System32\\drivers\\etc\\hosts" : "/etc/hosts";
  assert.throws(
    () => assertPathConfined(TMP_ROOT, outsideAbs),
    (err) => err.code === "path-escape",
  );
});

test("PT6 · Windows-style backslash traversal throws path-escape", () => {
  assert.throws(
    () => assertPathConfined(TMP_ROOT, "..\\..\\Windows\\System32"),
    (err) => err.code === "path-escape",
  );
});

test("PT7 · sneaky escape via prefix (content/../../secret) throws path-escape", () => {
  assert.throws(
    () => assertPathConfined(TMP_ROOT, "content/../../secret"),
    (err) => err.code === "path-escape",
    "path.resolve normalises · escape must still be detected",
  );
});

test("PT8 · empty relative is treated as the base itself (allowed)", () => {
  const out = assertPathConfined(TMP_ROOT, "");
  // resolved === base is allowed (rare · exact match)
  assert.ok(out === TMP_ROOT || out.startsWith(TMP_ROOT));
});

// ── readItemContent BEHAVIORAL ASSERTIONS ─────────────────────────

test("PT9 · readItemContent THROWS path-escape (does NOT return null) on escape", async () => {
  await assert.rejects(
    () => readItemContent({ contentPath: "../../../etc/passwd" }),
    (err) => err.code === "path-escape",
    "path-escape must propagate to caller · NOT be masked as null",
  );
});

test("PT10 · readItemContent returns null on ENOENT for a CONFINED path (existing behavior preserved)", async () => {
  const out = await readItemContent({ contentPath: "content/does-not-exist.txt" });
  assert.equal(out, null, "confined path that doesn't exist returns null · not a throw");
});

test("PT11 · readItemContent returns null when neither contentPath nor url is set", async () => {
  const out = await readItemContent({});
  assert.equal(out, null);
});

test("PT12 · readItemContent returns content for a CONFINED existing path (happy path)", async () => {
  const out = await readItemContent({ contentPath: "content/sample.txt" });
  assert.equal(out, "hello-inbox");
});

// ── cleanup ─────────────────────────────────────────────────────────

test("PT13 · cleanup temp fixtures", () => {
  try { rmSync(TMP_ROOT, { recursive: true, force: true }); } catch {}
});
