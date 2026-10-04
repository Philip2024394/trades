// scripts/nex-phase3a-preview-boundary.mjs
//
// Phase 3A Adoption-Ready UX · critical boundary test for the new
// `?preview=public` query parameter on /u/{handle}.
//
// MUST NEVER happen:
//   An anonymous visitor appending ?preview=public to a non-
//   discoverable profile URL and getting the profile content.
//
// MUST happen:
//   The guard still fires (returns the Next.js notFound chrome) ·
//   RLS stays intact · no name leak.

import { chromium } from "playwright";

const BASE = "http://localhost:3008";
const LEGACY = [
  { handle: "nex-91280", name: "Priya Patel" },
  { handle: "nex-38754", name: "Kenji Tanaka" },
  { handle: "nex-15662", name: "Lucas Ferreira" },
  { handle: "nex-27418", name: "Maria Santos" },
  { handle: "nex-52091", name: "Aisha Rahman" },
];

function isNotFound(body) {
  if (body.includes("This page could not be found")) return true;
  const n = (body.match(/>404</g) || []).length + (body.match(/\b404\b/g) || []).length;
  return n >= 3;
}

const results = [];
function record(check, expected, actual, pass) {
  results.push({ check, expected, actual, pass });
  console.log(`  ${pass ? "✓" : "✗"} ${check}`);
  console.log(`      expected: ${expected}`);
  console.log(`      actual:   ${actual}`);
}

async function fetchBody(url) {
  const r = await fetch(url, { redirect: "manual" });
  return { status: r.status, body: await r.text() };
}

// 1 · critical · all 5 non-discoverable profiles still return 404 chrome
//     with ?preview=public, no name leak. Preview param MUST NOT widen
//     access.
for (const { handle, name } of LEGACY) {
  const { body } = await fetchBody(`${BASE}/nex-native/u/${handle}?preview=public`);
  const notFoundOk = isNotFound(body);
  const nameLeaked = body.includes(name);
  record(
    `${handle} ?preview=public does NOT bypass gate for anon`,
    "notFound chrome + no name leak",
    `notFound=${notFoundOk} nameLeak=${nameLeaked}`,
    notFoundOk && !nameLeaked,
  );
}

// 2 · additional · ?preview=anything-else is also harmless
for (const { handle, name } of LEGACY) {
  const { body } = await fetchBody(`${BASE}/nex-native/u/${handle}?preview=junk-value`);
  const notFoundOk = isNotFound(body);
  const nameLeaked = body.includes(name);
  record(
    `${handle} ?preview=junk-value still gated for anon`,
    "notFound chrome + no name leak",
    `notFound=${notFoundOk} nameLeak=${nameLeaked}`,
    notFoundOk && !nameLeaked,
  );
}

// 3 · additional · unparam'd URL unchanged
for (const { handle, name } of LEGACY) {
  const { body } = await fetchBody(`${BASE}/nex-native/u/${handle}`);
  const notFoundOk = isNotFound(body);
  const nameLeaked = body.includes(name);
  record(
    `${handle} no param · still gated for anon`,
    "notFound chrome + no name leak",
    `notFound=${notFoundOk} nameLeak=${nameLeaked}`,
    notFoundOk && !nameLeaked,
  );
}

const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass).length;
console.log(`\n  ${pass} passed · ${fail} failed · ${results.length} total`);
if (fail > 0) process.exit(1);
console.log("\n✓ Preview-boundary test complete · ?preview=public does NOT widen anon access.");
