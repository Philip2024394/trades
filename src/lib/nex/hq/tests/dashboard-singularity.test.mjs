#!/usr/bin/env node
// dashboard-singularity.test.mjs · Task #78 Phase 2 · 2026-08-22
//
// Enforces the constitutional rule (Philip 2026-08-22 verbatim):
//   "NEX has one and only one operational/admin dashboard: Head Quarters."
//   "We should enforce this in the codebase, not rely on Claude remembering."
//
// This is a static architectural test. Runs against the codebase. No DB.
// Fails LOUDLY with the exact offending path when the rule is violated.
//
// Doctrine anchor: project_nex_dashboard_singularity_constitutional_rule_2026_08_22
// Allowlist:       ./dashboard-singularity-allowlist.mjs
//
// 5 assertions Philip greenlit (2026-08-22 · verbatim summary):
//   1. Zero executable dashboard survivors in /admin/nex/** and /nex-app/nex-brain/**
//   2. Every static HQ page must either appear in HQShell.SECTIONS or be
//      documented in the allowlist (no silent orphan growth)
//   3. No dashboard-style operational UI can appear outside HQ/authed/merchant zones
//      (architectural check · not filename-based · uses HQ_OPERATIONAL_MARKERS)
//   4. Component-name scan · no *Dashboard*/*ControlCentre*/etc. outside HQ tree
//      and known merchant namespaces (regression tripwire)
//   5. HQShell.SECTIONS is the single source of truth for HQ navigation

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, sep } from "node:path";
import {
  HQ_ORPHAN_ALLOWLIST,
  COMPONENT_NAMESPACE_ALLOWLIST,
  OPERATIONAL_API_FORBIDDEN,
  HQ_OPERATIONAL_MARKERS,
  OPERATIONAL_CONTENT_ZONES,
} from "./dashboard-singularity-allowlist.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO      = join(__dirname, "..", "..", "..", "..", "..");
const SRC_APP        = join(REPO, "src", "app");
const SRC_COMPONENTS = join(REPO, "src", "components");
const HQSHELL_PATH   = join(REPO, "src", "components", "nex-head-quarters", "HQShell.tsx");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

// ── Utilities ─────────────────────────────────────────────────────────

function walk(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const d = stack.pop();
    let entries;
    try { entries = readdirSync(d); } catch { continue; }
    for (const name of entries) {
      const full = join(d, name);
      let s;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        stack.push(full);
      } else out.push(full);
    }
  }
  return out;
}

function toRepoRel(p) { return relative(REPO, p).split(sep).join("/"); }

function routeFromPagePath(p) {
  // src/app/foo/bar/page.tsx → /foo/bar   (drops route-group parens (authed))
  const rel = toRepoRel(p);
  if (!rel.endsWith("/page.tsx")) return null;
  const inner = rel.slice("src/app".length, -"/page.tsx".length);
  const cleaned = inner
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/");
  return cleaned === "" ? "/" : cleaned;
}

// Collect once
const ALL_APP_FILES        = walk(SRC_APP);
const ALL_PAGE_FILES       = ALL_APP_FILES.filter((p) => p.endsWith(`${sep}page.tsx`));
const ALL_COMPONENT_FILES  = walk(SRC_COMPONENTS).filter((p) => p.endsWith(".tsx") || p.endsWith(".ts"));

// Extract HQShell SECTIONS href list once
let HQSHELL_HREFS = [];
try {
  const shellSrc = readFileSync(HQSHELL_PATH, "utf8");
  const hrefRe = /href:\s*["']([^"']+)["']/g;
  let m;
  while ((m = hrefRe.exec(shellSrc)) !== null) {
    if (m[1].startsWith("/nex-head-quarters")) HQSHELL_HREFS.push(m[1]);
  }
} catch (err) {
  record("SETUP", false, `could not read HQShell.tsx: ${err.message}`);
  process.exit(1);
}
const HQSHELL_HREF_SET = new Set(HQSHELL_HREFS);
const ALLOWLIST_ROUTE_SET = new Set(HQ_ORPHAN_ALLOWLIST.map((e) => e.route));

// ═════════════════════════════════════════════════════════════════════
// ASSERTION 1 · Zero survivors from deleted namespaces
// ═════════════════════════════════════════════════════════════════════

const FORBIDDEN_PAGE_PREFIXES = [
  "src/app/admin/nex/",
  "src/app/nex-app/nex-brain/",
];

const survivors = ALL_PAGE_FILES
  .map(toRepoRel)
  .filter((p) => FORBIDDEN_PAGE_PREFIXES.some((prefix) => p.startsWith(prefix)));

if (survivors.length === 0) {
  record("DS1_no_deleted_namespace_survivors", true,
    "zero page.tsx under /admin/nex/** or /nex-app/nex-brain/**");
} else {
  record("DS1_no_deleted_namespace_survivors", false,
    `${survivors.length} SURVIVOR(S): ${survivors.join(" · ")}`);
}

// Also check API forbidden paths
const apiSurvivors = ALL_APP_FILES
  .map(toRepoRel)
  .filter((p) => p.endsWith("/route.ts") && OPERATIONAL_API_FORBIDDEN.some((prefix) => p.startsWith(prefix)));

if (apiSurvivors.length === 0) {
  record("DS1b_no_forbidden_api_survivors", true,
    "zero route.ts under forbidden API prefixes");
} else {
  record("DS1b_no_forbidden_api_survivors", false,
    `${apiSurvivors.length} FORBIDDEN API ROUTE(S): ${apiSurvivors.join(" · ")}`);
}

// ═════════════════════════════════════════════════════════════════════
// ASSERTION 2 · Every static HQ page in sidebar OR allowlist
// ═════════════════════════════════════════════════════════════════════

// Static HQ pages = /nex-head-quarters/*/page.tsx (not dynamic routes)
// Dynamic segments like [id] show up · we normalise to the route
const hqPageRoutes = ALL_PAGE_FILES
  .map(routeFromPagePath)
  .filter((r) => r && r.startsWith("/nex-head-quarters"));

const orphansNotAllowed = [];
for (const route of hqPageRoutes) {
  if (route === "/nex-head-quarters") continue; // root · Reception · always in sidebar
  if (HQSHELL_HREF_SET.has(route)) continue;
  if (ALLOWLIST_ROUTE_SET.has(route)) continue;
  orphansNotAllowed.push(route);
}

if (orphansNotAllowed.length === 0) {
  record("DS2_every_hq_page_navigated_or_allowlisted", true,
    `${hqPageRoutes.length} HQ page(s) · ${HQSHELL_HREF_SET.size} in sidebar · ${ALLOWLIST_ROUTE_SET.size} allowlisted · 0 silent orphans`);
} else {
  record("DS2_every_hq_page_navigated_or_allowlisted", false,
    `${orphansNotAllowed.length} SILENT ORPHAN(S): ${orphansNotAllowed.join(" · ")} — add to HQShell.SECTIONS or dashboard-singularity-allowlist.mjs`);
}

// ═════════════════════════════════════════════════════════════════════
// ASSERTION 3 · No dashboard-style operational content outside allowed zones
// ═════════════════════════════════════════════════════════════════════
//
// Architectural check · not filename-based. If a page outside HQ/authed/
// merchant zones imports or renders operational markers (worker_heartbeat
// data, six-criteria evaluator, Reality Strip, etc.), that's a competing
// dashboard building itself.

const pagesOutsideAllowedZones = ALL_PAGE_FILES.filter((p) => {
  const rel = toRepoRel(p);
  return !OPERATIONAL_CONTENT_ZONES.some((zone) => rel.startsWith(zone));
});

const architecturalViolations = [];
for (const p of pagesOutsideAllowedZones) {
  const src = readFileSync(p, "utf8");
  for (const marker of HQ_OPERATIONAL_MARKERS) {
    if (src.includes(marker)) {
      architecturalViolations.push(`${toRepoRel(p)} contains '${marker}'`);
      break; // one report per file
    }
  }
}

if (architecturalViolations.length === 0) {
  record("DS3_no_operational_content_outside_hq", true,
    `checked ${pagesOutsideAllowedZones.length} page(s) outside HQ zones · zero operational markers`);
} else {
  record("DS3_no_operational_content_outside_hq", false,
    `${architecturalViolations.length} VIOLATION(S): ${architecturalViolations.join(" · ")} — move to /nex-head-quarters/*`);
}

// ═════════════════════════════════════════════════════════════════════
// ASSERTION 4 · Component-name scan · dashboard patterns outside allowed
// ═════════════════════════════════════════════════════════════════════

const DASHBOARD_NAME_PATTERN = /(Dashboard|ControlCentre|ControlCenter|OperationsPanel|AdminPanel|WorkerPanel)/;
const componentViolations = [];
for (const p of ALL_COMPONENT_FILES) {
  const rel = toRepoRel(p);
  const filename = rel.split("/").pop() ?? "";
  if (!DASHBOARD_NAME_PATTERN.test(filename)) continue;
  // Check if in an allowed namespace
  const allowed = COMPONENT_NAMESPACE_ALLOWLIST.some((prefix) => rel.startsWith(prefix));
  if (!allowed) componentViolations.push(rel);
}

if (componentViolations.length === 0) {
  record("DS4_no_dashboard_components_outside_allowed_namespaces", true,
    `component-name scan clean · ${COMPONENT_NAMESPACE_ALLOWLIST.length} allowed namespaces`);
} else {
  record("DS4_no_dashboard_components_outside_allowed_namespaces", false,
    `${componentViolations.length} COMPONENT VIOLATION(S): ${componentViolations.join(" · ")} — move under an allowed namespace or into /components/nex-head-quarters/`);
}

// ═════════════════════════════════════════════════════════════════════
// ASSERTION 5 · HQShell.SECTIONS is the single source of truth for HQ nav
// ═════════════════════════════════════════════════════════════════════
//
// Any other file that exports an HQ-nav-shaped array (hrefs starting with
// /nex-head-quarters/) is a competing navigation source. HQShell is
// canonical · all others must reference it, not redefine it.

const competingNavs = [];
for (const p of ALL_COMPONENT_FILES) {
  if (p === HQSHELL_PATH) continue; // skip the canonical
  const src = readFileSync(p, "utf8");
  // Look for arrays of {href:"/nex-head-quarters/...", ...} - competing nav definitions
  const hqHrefMatches = src.match(/href:\s*["']\/nex-head-quarters\/[^"']+["']/g) ?? [];
  if (hqHrefMatches.length >= 3) {
    // 3+ HQ hrefs in the same file suggests a nav definition · below threshold = incidental
    competingNavs.push(`${toRepoRel(p)} (${hqHrefMatches.length} HQ hrefs)`);
  }
}

if (competingNavs.length === 0) {
  record("DS5_hqshell_single_source_of_nav", true,
    "no other component defines an HQ nav array · HQShell.SECTIONS is canonical");
} else {
  record("DS5_hqshell_single_source_of_nav", false,
    `${competingNavs.length} COMPETING NAV(S): ${competingNavs.join(" · ")} — remove or refactor to import from HQShell.SECTIONS`);
}

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════

const passed = results.filter((r) => r.pass).length;
const total  = results.length;
process.stdout.write(`\ndashboard-singularity: ${passed}/${total} assertions passed\n`);
if (passed < total) {
  process.stdout.write(`\n⛔ ARCHITECTURAL RULE VIOLATED · NEX HAS ONE AND ONLY ONE OPERATIONAL DASHBOARD: HEAD QUARTERS\n`);
  process.stdout.write(`   Doctrine: project_nex_dashboard_singularity_constitutional_rule_2026_08_22\n`);
}
process.exit(passed === total ? 0 : 1);
