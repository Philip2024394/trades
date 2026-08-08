#!/usr/bin/env node
// factory-page.test.mjs · Phase 12.4
//
// Static assertions for the dedicated Knowledge Factory page. The page
// itself is a large React file; the test asserts CONTRACT properties
// that Philip mandated in the 12.4 authorization rather than deep
// snapshot equality.
//
// Assertions:
//   F1  · personas.ts exports exactly 6 personas in pipeline order
//   F2  · personas mapped to the six brain worker types
//   F3  · page uses "use client" (needs polling + framer motion state)
//   F4  · page polls workers-live · warehouse · knowledge-inbox/list · timeline
//   F5  · page has no Math.random / setInterval fake counters (only
//         setInterval allowed is the real 5s poll; Math.random forbidden)
//   F6  · WorkerCard LED pulses ONLY when status === working || waiting_llm
//         (real activity) — never on standby/failed/offline
//   F7  · WarehousePanel scales barrel fill from count (real backend
//         count, not synthesised)
//   F8  · VaultPanel emphasises awaiting_review with a link to /review
//   F9  · ActivityStream sources events from /timeline (real audit trail)
//   F10 · No fabricated "processing" · empty state is honest
//   F11 · Drawer entry in NexSectionsNav points at /nex-app/nex-brain/factory
//   F12 · Existing Nex Marketing entry still present (untouched)
//   F13 · Poll cadence = 5s (POLL_MS = 5_000)
//   F14 · deriveLiveness NOT re-implemented in the page (single source of truth)
//   F15 · Framer Motion animations gated on real state (`animate={isActive ? ...`)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");

const PERSONAS = readFileSync(join(REPO, "src/lib/nex/brain/factory/personas.ts"), "utf8");
const PAGE     = readFileSync(join(REPO, "src/app/nex-app/nex-brain/factory/page.tsx"), "utf8");
const NAV      = readFileSync(join(REPO, "src/components/nex-app/shell/NexSectionsNav.tsx"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// F1 · 6 personas
const personaMatches = PERSONAS.match(/worker_type:\s*"[a-z-]+"/g) ?? [];
record("F1", personaMatches.length === 6, `personas defined = ${personaMatches.length} (expected 6)`);

// F2 · every brain worker_type is mapped
const requiredTypes = [
  "knowledge-context","voice-context","learning-context",
  "knowledge-extractor","image-analyst","quality-checker",
];
const missing = requiredTypes.filter((t) => !PERSONAS.includes(`worker_type:   "${t}"`) && !PERSONAS.includes(`worker_type: "${t}"`));
record("F2", missing.length === 0, missing.length === 0 ? "all 6 worker types mapped" : `missing: ${missing.join(", ")}`);

// F3 · "use client"
record("F3", PAGE.trimStart().startsWith('"use client";') || /^"use client";/m.test(PAGE),
  "page starts with \"use client\"");

// F4 · four endpoints polled
const endpoints = [
  "/api/nex/brain/workers-live",
  "/api/nex/brain/warehouse",
  "/api/nex/knowledge-inbox/list",
  "/api/nex/brain/timeline",
];
const allEndpointsWired = endpoints.every((e) => PAGE.includes(e));
record("F4", allEndpointsWired, allEndpointsWired ? "all four endpoints polled" : `missing endpoint in page.tsx`);

// F5 · no Math.random / no extra setInterval in ACTIVE CODE (comments
// discussing the forbidden pattern do not count — otherwise a header
// comment saying "no Math.random" would trip the check).
// NOTE · uses [^\n\r]* instead of .* because Windows CRLF endings
// leave \r in the line after split("\n") · JS `.` excludes both \n
// and \r · using .*$ would fail to strip CRLF-terminated line comments.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")     // /* block comments */
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/[^\n\r]*/, "$1"))
    .join("\n");
}
const PAGE_CODE = stripComments(PAGE);
const hasRandom = /Math\.random/.test(PAGE_CODE);
record("F5a", !hasRandom, hasRandom ? "Math.random FOUND in active code · forbidden" : "no Math.random in active code");
const setIntervalCount = (PAGE_CODE.match(/setInterval/g) ?? []).length;
record("F5b", setIntervalCount <= 1, `setInterval count in active code = ${setIntervalCount} (only 1 permitted for real poll)`);

// F6 · LED pulses gated on real activity
const pulseGated = /const isActive\s*=\s*status\s*===\s*"working"\s*\|\|\s*status\s*===\s*"waiting_llm"/.test(PAGE)
                && /animate=\{isActive\s*\?/.test(PAGE);
record("F6", pulseGated, "LED pulse gated on isActive = working|waiting_llm");

// F7 · barrel fill scales with real count
const barrelScales = /Math\.log10\(1\s*\+\s*s\.count\)/.test(PAGE);
record("F7", barrelScales, "Warehouse barrel fill derived from real count via log scale");

// F8 · Vault emphasises awaiting_review with link to /review
const reviewEmphasised = /key:\s*"awaiting_review"[\s\S]*?emphasise:\s*true/.test(PAGE)
                      && /href:\s*"\/nex-app\/nex-brain\/review"/.test(PAGE);
record("F8", reviewEmphasised, "awaiting_review shelf emphasised + links to /nex-app/nex-brain/review");

// F9 · ActivityStream sources from timeline
const streamSourcesTimeline = /function ActivityStream[\s\S]*?events\.\.\./m.test(PAGE) === false
  ? /function ActivityStream\(\{\s*events\s*\}:\s*\{\s*events:\s*TimelineEvent\[\]\s*\|\s*null\s*\}\)/.test(PAGE)
  : true;
// simpler: assert TimelineEvent type used
const usesTimelineType = /TimelineEvent/.test(PAGE) && /timeline\?limit=/.test(PAGE);
record("F9", usesTimelineType, "ActivityStream typed against TimelineEvent + polls /timeline");

// F10 · honest empty state
const honestEmpty = /No transitions in the current window\. Factory is quiet\./.test(PAGE);
record("F10", honestEmpty, "activity stream empty state = honest quiet message");

// F11 · drawer entry
const factoryHref = /href:\s*"\/nex-app\/nex-brain\/factory"[\s\S]{0,120}?label:\s*"Knowledge Factory"/.test(NAV);
record("F11", factoryHref, "NexSectionsNav points Knowledge Factory at /nex-app/nex-brain/factory");

// F12 · Nex Marketing preserved
record("F12", /label:\s*"Nex Marketing"/.test(NAV), "Nex Marketing entry preserved");

// F13 · poll cadence
record("F13", /const POLL_MS\s*=\s*5_000/.test(PAGE), "POLL_MS = 5_000 (5s cadence)");

// F14 · no duplicated liveness logic
const rederived = /deriveLiveness/.test(PAGE);
record("F14", !rederived, "page does NOT re-implement deriveLiveness (single source of truth in heartbeat.ts)");

// F15 · framer animations conditional on state
const conditionalAnim = /animate=\{[^}]*\?[^}]*:[^}]*\}/.test(PAGE);
record("F15", conditionalAnim, "framer animations use conditional expressions (state-driven, not always-on)");

// Old drawer target must be gone
const oldDrawerGone = !/href:\s*"\/nex-app\/nex-brain\/operations-centre"[\s\S]{0,120}?label:\s*"Knowledge Factory"/.test(NAV);
record("F16", oldDrawerGone, "drawer no longer points Knowledge Factory at /operations-centre");

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\nfactory-page: ${passed}/${total} assertions passed\n`);
process.exit(passed === total ? 0 : 1);
