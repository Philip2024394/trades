#!/usr/bin/env node
// adapter-isolation.test.mjs
//
// Proves that no file under src/lib/nex/comms-social/** outside of
// adapters/ imports a provider SDK. Runs the boundary verifier + injects
// a synthetic violation to prove detection actually catches it.
//
// Uses only fs + child_process — no TS runtime required.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, "..", "..", "..", "..", "..");
const SCRIPT = join(REPO, "scripts", "verify-comms-social-boundaries.mjs");
const COMMS_SOCIAL = join(REPO, "src", "lib", "nex", "comms-social");
const ADAPTERS = join(COMMS_SOCIAL, "adapters");

const results = [];
function record(id, pass, note = "") {
  results.push({ id, pass, note });
  process.stdout.write(`  ${pass ? "PASS" : "FAIL"} ${id}${note ? " · " + note : ""}\n`);
}

process.stdout.write("adapter-isolation.test.mjs\n");

// A1 · Verifier passes on clean tree.
{
  const r = spawnSync("node", [SCRIPT], { cwd: REPO, encoding: "utf8" });
  record("A1 boundary verifier passes on clean tree", r.status === 0, `exit=${r.status}`);
}

// A2 · SocialProvider interface exports the required members.
{
  const iface = readFileSync(join(ADAPTERS, "interface.ts"), "utf8");
  const need = [
    "SocialProvider",
    "AdapterCapabilities",
    "AdapterPublishRequest",
    "AdapterPublishResult",
    "AdapterVerifyRequest",
    "AdapterVerifyResult",
    "AdapterHealthResult",
    "capabilities",
    "publish",
    "verify",
    "health",
  ];
  const missing = need.filter((s) => !iface.includes(s));
  record("A2 SocialProvider interface complete", missing.length === 0, missing.length ? `missing: ${missing.join(",")}` : "");
}

// A3 · Simulator adapter declares itself for the interface.
{
  const sim = readFileSync(join(ADAPTERS, "simulator.ts"), "utf8");
  const ok = sim.includes("export function createSimulatorAdapter()")
          && sim.includes("SocialProvider")
          && sim.includes("capabilities()")
          && sim.includes("publish(req")
          && sim.includes("verify(req")
          && sim.includes("health()");
  record("A3 simulator exports SocialProvider factory", ok);
}

// A4 · Verifier detects a synthetic provider-SDK-outside-adapters violation.
{
  const path = join(COMMS_SOCIAL, "__adapter_test_violation__.ts");
  writeFileSync(path, `import "facebook-nodejs-business-sdk";\nexport const x = 1;\n`, "utf8");
  const r = spawnSync("node", [SCRIPT], { cwd: REPO, encoding: "utf8" });
  const detected = r.status === 1 && /R6/.test(r.stdout);
  try { unlinkSync(path); } catch { /* ignore */ }
  record("A4 verifier detects provider-SDK outside adapters/", detected, `exit=${r.status}`);
}

// A5 · Re-run verifier to confirm cleanup restored green.
{
  const r = spawnSync("node", [SCRIPT], { cwd: REPO, encoding: "utf8" });
  record("A5 verifier green after cleanup", r.status === 0, `exit=${r.status}`);
}

process.stdout.write(`\nSummary · ${results.filter(x => x.pass).length}/${results.length} passed\n`);
process.exit(results.every(x => x.pass) ? 0 : 1);
