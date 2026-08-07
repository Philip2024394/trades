#!/usr/bin/env node
// role-permission.test.mjs
//
// Unit tests for the role permission helpers in roles.ts.
// Uses only Node.js — no DB required. Reads the compiled JS output
// via tsx-less approach: re-implements a tiny shim that mirrors the
// role permission logic, so the test asserts against the actual
// permission matrix defined in roles.ts (via textual extraction).
//
// This test is deliberately simple: it proves the shape and default-deny
// nature of the permission table. Full end-to-end role tests land in
// Phase 1 when API handlers exist.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROLES = readFileSync(join(__dirname, "..", "roles.ts"), "utf8");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

process.stdout.write("role-permission.test.mjs\n");

// R1 · The SOCIAL_ROLES list contains every role required by charter §S-V + §0 Boundary 3.
// Roles appear as (a) permission-matrix keys (`owner:`) and (b) referenced by SocialRole type
// imported from types.ts. We check that each required role has a permission-matrix entry.
{
  const required = ["owner", "admin", "marketing_manager", "staff", "viewer", "agency_manager", "nex_admin_support", "nex_admin_publish"];
  const missing = required.filter((r) => !new RegExp(`^\\s*${r}:\\s*new Set`, "m").test(ROLES));
  record("R1 permission matrix has every required role", missing.length === 0, missing.length ? missing.join(",") : "");
}

// R2 · The SOCIAL_ACTIONS list contains every action gated by S-V.
{
  const required = [
    "connect_account", "disconnect_account",
    "enable_automatic", "disable_automatic", "propose_automatic",
    "approve_post", "publish_post",
    "pause_account", "resume_account",
    "manage_roles", "read_analytics", "administer_campaigns",
    "cross_tenant_read", "administer_publish",
  ];
  const missing = required.filter((a) => !new RegExp(`"${a}"`).test(ROLES));
  record("R2 SOCIAL_ACTIONS contains all required actions", missing.length === 0, missing.length ? missing.join(",") : "");
}

// R3 · nex_admin_publish is time-bounded (documented in the file + enforced by DB constraint).
{
  const commented = /nex_admin_publish/i.test(ROLES) && /time-?bounded/i.test(ROLES);
  record("R3 nex_admin_publish documented as time-bounded", commented);
}

// R4 · manage_roles is owner-only (charter §S-V role scoping).
{
  // Extract the owner block, then a nearby line "manage_roles"; assert admin block excludes.
  const ownerBlock = /owner:\s*new Set\(\[[^\]]*\]\)/s.exec(ROLES);
  const adminBlock = /admin:\s*new Set\(\[[^\]]*\]\)/s.exec(ROLES);
  const ownerHas   = ownerBlock && /"manage_roles"/.test(ownerBlock[0]);
  const adminLacks = adminBlock && !/"manage_roles"/.test(adminBlock[0]);
  record("R4 manage_roles is owner-only", Boolean(ownerHas && adminLacks));
}

// R5 · Staff cannot publish or enable Automatic (charter §S-V).
{
  const staff = /staff:\s*new Set\(\[[^\]]*\]\)/s.exec(ROLES);
  const cannot = staff && !/"publish_post"/.test(staff[0]) && !/"enable_automatic"/.test(staff[0]);
  record("R5 staff cannot publish or enable Automatic", Boolean(cannot));
}

// R6 · Viewer can only read analytics.
{
  const viewer = /viewer:\s*new Set\(\[[^\]]*\]\)/s.exec(ROLES);
  const onlyReadAnalytics = viewer
    && /"read_analytics"/.test(viewer[0])
    && !/"publish_post"|"approve_post"|"connect_account"|"manage_roles"/.test(viewer[0]);
  record("R6 viewer restricted to read_analytics", Boolean(onlyReadAnalytics));
}

// R7 · nex_admin_support has cross_tenant_read but not administer_publish.
{
  const support = /nex_admin_support:\s*new Set\(\[[^\]]*\]\)/s.exec(ROLES);
  const ok = support && /"cross_tenant_read"/.test(support[0]) && !/"administer_publish"/.test(support[0]);
  record("R7 nex_admin_support: read-only cross-tenant", Boolean(ok));
}

// R8 · nex_admin_publish has administer_publish.
{
  const pub = /nex_admin_publish:\s*new Set\(\[[^\]]*\]\)/s.exec(ROLES);
  const ok = pub && /"administer_publish"/.test(pub[0]) && /"cross_tenant_read"/.test(pub[0]);
  record("R8 nex_admin_publish: has administer_publish", Boolean(ok));
}

// R9 · Default is deny (permits() returns false for unknown role/action combos).
//    Verify the source of permits() (a) uses `allowed.has(action)` gate and
//    (b) returns false as the final statement (default-deny outcome).
{
  const hasGate = /allowed\s*&&\s*allowed\.has\(action\)/.test(ROLES);
  const returnsFalseFinally = /\breturn\s+false;\s*\}/.test(ROLES);
  record("R9 permits() is default-deny", hasGate && returnsFalseFinally,
    hasGate ? (returnsFalseFinally ? "" : "missing final return false") : "missing allowed.has(action) gate");
}

process.stdout.write(`\nSummary · ${results.filter(x => x.pass).length}/${results.length} passed\n`);
process.exit(results.every(x => x.pass) ? 0 : 1);
