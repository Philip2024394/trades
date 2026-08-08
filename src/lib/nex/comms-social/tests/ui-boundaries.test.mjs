#!/usr/bin/env node
// ui-boundaries.test.mjs · Phase 6
//
// Adversarial UI-layer boundary tests. The merchant-facing UI must
// never import adapters, provider SDKs, Supabase admin, Predictive,
// or the Hammerex social module. It must go through the existing
// /api/nex/comms-social/* API surface only.
//
//   UB1 · SocialCentrePanel.tsx does NOT import an adapter or SDK
//   UB2 · SocialCentrePanel.tsx does NOT import @/lib/nex/predictive
//   UB3 · SocialCentrePanel.tsx does NOT import @/lib/supabaseAdmin
//   UB4 · SocialCentrePanel.tsx does NOT import the Hammerex social module
//   UB5 · SocialCentrePanel.tsx does NOT import @/lib/nex/delivery or compliance
//   UB6 · page.tsx route is server-rendered · imports only the panel component
//   UB7 · Panel humanizes rejection codes (no raw code exposed to merchant text)
//   UB8 · Panel warns when acting_role would be denied enable_automatic
//         (verified by presence of the alert() call on 403)
//   UB9 · Panel calls ONLY endpoints under /api/nex/comms-social/*
//   UB10 · Every mutation includes tenant_id in the body

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");
const PANEL = join(REPO, "src", "components", "nex-app", "nex-brain", "SocialCentrePanel.tsx");
const PAGE  = join(REPO, "src", "app", "nex-app", "nex-brain", "comms-social", "page.tsx");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

const panel = readFileSync(PANEL, "utf8");
const page  = readFileSync(PAGE, "utf8");

process.stdout.write("ui-boundaries.test.mjs\n");

// UB1 · no adapter imports
{
  const badPatterns = [
    /from\s+["'][^"']*comms-social\/adapters\//,
    /from\s+["']facebook-nodejs-business-sdk["']/,
    /from\s+["']instagram-graph-api["']/,
    /from\s+["']linkedin-api-client["']/,
    /from\s+["']tiktok-business-api-sdk["']/,
    /from\s+["']@googlemaps\/google-business-profile["']/,
  ];
  const hit = badPatterns.some((re) => re.test(panel));
  record("UB1 no adapter or provider-SDK imports in Panel", !hit);
}
// UB2 · no Predictive
record("UB2 no @/lib/nex/predictive import in Panel", !/@\/lib\/nex\/predictive/.test(panel));
// UB3 · no supabaseAdmin
record("UB3 no @/lib/supabaseAdmin import in Panel", !/@\/lib\/supabaseAdmin/.test(panel));
// UB4 · no Hammerex social
record("UB4 no Hammerex ../social/ import in Panel", !/from\s+["'][.\/]*lib\/nex\/social\//.test(panel));
// UB5 · no delivery / compliance
record("UB5 no @/lib/nex/delivery or /compliance import in Panel",
  !/@\/lib\/nex\/(delivery|compliance)/.test(panel));

// UB6 · page.tsx imports the panel and nothing else from src/lib/*
{
  const imports = page.match(/from\s+["'][^"']+["']/g) ?? [];
  const suspicious = imports.filter((s) =>
    /@\/lib\/nex\/(predictive|delivery|compliance|social\/(?!.*adapters).*(?!components))/.test(s));
  record("UB6 page.tsx has no forbidden imports", suspicious.length === 0, suspicious.join(","));
}

// UB7 · rejection codes are humanized (mapping table present)
{
  const has = /humanizeReason/.test(panel)
           && /hard_blocked_claim/.test(panel)
           && /rights_source_missing/.test(panel);
  record("UB7 Panel humanizes rejection codes", has);
}

// UB8 · 403 alert present (permission-denied UX)
record("UB8 Panel alerts merchant on 403 (role-denied enable_automatic)",
  /r\.status === 403/.test(panel) && /alert\(/.test(panel));

// UB9 · every fetch() call targets /api/nex/comms-social/*
{
  const fetches = [...panel.matchAll(/fetch\(\s*[`'"]([^`'"$]+)/g)].map((m) => m[1]);
  const nonSocial = fetches.filter((u) => !u.startsWith("/api/nex/comms-social/"));
  record("UB9 all fetch() calls go through /api/nex/comms-social/",
    nonSocial.length === 0, nonSocial.slice(0, 3).join(","));
}

// UB10 · every mutation-shaped fetch includes tenant_id in the body OR path
{
  // Approximate: for POST bodies containing JSON.stringify, look at each block
  // and verify tenant_id is referenced. This catches accidental omissions.
  const posts = [...panel.matchAll(/method:\s*["']POST["'][\s\S]*?body:\s*JSON\.stringify\(\{([^}]+)\}/g)]
    .map((m) => m[1]);
  const missing = posts.filter((body) => !/tenant_id/.test(body));
  // Legitimately-global POSTs · exclude:
  //   * /controls (global_pause kill-switch)
  //   * /worker/tick (worker_id, cross-tenant by design)
  const truly = missing.filter((b) => !/global_pause/.test(b) && !/worker_id/.test(b));
  record("UB10 tenant_id present in every non-global POST body",
    truly.length === 0, `posts=${posts.length} truly_missing=${truly.length}`);
}

// UB11 · "use client" directive present (Panel is a client component)
//   Regex allows leading comment block before the directive.
record("UB11 Panel is a client component", /["']use client["'];/.test(panel));

// UB12 · S-V role scoping surfaced in UI (Categories tab explicitly gates)
record("UB12 Panel exposes acting-role selector for Categories",
  /Acting as role/.test(panel) && /actor_role/.test(panel));

// UB13 · S-VIII rejection reasons displayed prominently in draft card
record("UB13 Panel displays rejection reasons on draft card",
  /Why this can't publish yet/.test(panel) && /rejection_reasons/.test(panel));

process.stdout.write(`\nSummary · ${results.filter(r => r.pass).length}/${results.length} passed\n`);
process.exit(results.every(r => r.pass) ? 0 : 1);
