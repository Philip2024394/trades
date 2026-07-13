#!/usr/bin/env node
// Week 1 Demo Verification Script — proves the 8 demonstrations
// Philip approved for Week 1 exit.
//
// Run:  node scripts/verify-week1-demos.mjs
//
// Uses tsx to import TypeScript sources directly. No build step
// required — this is a validation harness, not a shipped artifact.

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Colour helpers ─────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const PASS = `${GREEN}✓${RESET}`;
const FAIL = `${RED}✗${RESET}`;

let passed = 0;
let failed = 0;
const failures = [];

function demo(n, name, fn) {
  process.stdout.write(`Demo ${n} — ${name} ... `);
  try {
    fn();
    process.stdout.write(`${PASS}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`${FAIL}\n`);
    process.stdout.write(`   ${DIM}${err.message}${RESET}\n`);
    failed++;
    failures.push({ n, name, message: err.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ─── Load platform code via tsx ──────────────────────────────────
// We import TypeScript directly through tsx's programmatic API so we
// can run this as a plain node script.

async function main() {
  const { register } = await import("tsx/esm/api");
  const unregister = register();

  const paths = {
    manifestTypes: join(ROOT, "src/platform/manifest/types.ts"),
    registry: join(ROOT, "src/platform/registry.ts"),
    aiDiscovery: join(ROOT, "src/platform/aiTools/discovery.ts"),
    dispatcher: join(ROOT, "src/platform/aiTools/dispatcher.ts"),
    flagDiscovery: join(ROOT, "src/platform/featureFlags/discovery.ts"),
    cmdDiscovery: join(ROOT, "src/platform/commands/discovery.ts"),
    telemetryBaseline: join(ROOT, "src/platform/telemetry/baseline.ts"),
    helloWorld: join(ROOT, "src/platform/demo/helloWorldApp.ts")
  };

  for (const [name, p] of Object.entries(paths)) {
    assert(existsSync(p), `${name} missing at ${p}`);
  }

  // Emulate @/ path alias by importing via absolute file paths + a
  // small resolver hack. Simpler: use dynamic imports with the file
  // URL directly.
  const toUrl = (p) => "file:///" + p.replace(/\\/g, "/");

  const registryMod = await import(toUrl(paths.registry));
  const { appRegistry } = registryMod;

  const helloMod = await import(toUrl(paths.helloWorld));
  const { helloWorldAppManifest } = helloMod;

  const aiDiscoveryMod = await import(toUrl(paths.aiDiscovery));
  const { discoverAITools, findAITool } = aiDiscoveryMod;

  const dispatcherMod = await import(toUrl(paths.dispatcher));
  const { catalogueAITools } = dispatcherMod;

  const flagDiscoveryMod = await import(toUrl(paths.flagDiscovery));
  const { discoverFeatureFlags, isEnabledByDefault } = flagDiscoveryMod;

  const cmdDiscoveryMod = await import(toUrl(paths.cmdDiscovery));
  const { discoverCommands, discoverCommandsGrouped, findCommand } =
    cmdDiscoveryMod;

  const telemetryMod = await import(toUrl(paths.telemetryBaseline));
  const { BASELINE_METRICS, emitBaseline, emitTelemetry, discoverTelemetry, setSink } =
    telemetryMod;

  // Register the demo App up front — every demo depends on it being
  // in the registry.
  appRegistry.register(helloWorldAppManifest);

  // ─── Demo 1 — App can declare AI tools ────────────────────────
  demo(1, "App can declare AI tools", () => {
    const app = appRegistry.get("hello-world");
    assert(app, "hello-world App not registered");
    assert(app.aiTools?.length === 1, "expected 1 aiTool declared");
    assert(app.aiTools[0].name === "hello-world.echo", "tool name mismatch");
  });

  // ─── Demo 2 — AI platform discovers tools automatically ───────
  demo(2, "AI platform discovers tools automatically", () => {
    const catalogue = catalogueAITools();
    assert(catalogue.totalTools >= 1, "no tools discovered");
    const found = findAITool("hello-world.echo");
    assert(found, "hello-world.echo not discoverable");
    assert(
      found.appSlug === "hello-world",
      "discovered tool missing app tag"
    );
    // Zero shell code references hello-world — discovery is pure
    // projection over appRegistry.
  });

  // ─── Demo 3 — App can declare feature flags ───────────────────
  demo(3, "App can declare feature flags", () => {
    const app = appRegistry.get("hello-world");
    assert(app.featureFlags?.length === 1, "expected 1 flag declared");
    assert(app.featureFlags[0].key === "hello-world.enabled", "flag key mismatch");
  });

  // ─── Demo 4 — Shell recognises those flags ────────────────────
  demo(4, "Shell recognises those flags", () => {
    const flags = discoverFeatureFlags();
    assert(flags.length >= 1, "no flags discovered");
    const found = flags.find((f) => f.key === "hello-world.enabled");
    assert(found, "hello-world.enabled not discoverable by shell");
    assert(isEnabledByDefault("hello-world.enabled") === true, "default flag value wrong");
    assert(
      isEnabledByDefault("hello-world.nonexistent") === undefined,
      "unknown flag should return undefined"
    );
  });

  // ─── Demo 5 — App exposes telemetry without manual wiring ─────
  demo(5, "App exposes telemetry without manual wiring", () => {
    const emitted = [];
    setSink((event) => emitted.push(event));

    // Baseline emission (runtime-produced)
    emitBaseline("plugin.request.count", 1, { app: "hello-world", route: "/echo" });
    assert(emitted.length === 1, "baseline emission dropped");
    assert(emitted[0].metric === "plugin.request.count", "wrong metric emitted");

    // Custom emission (App-declared)
    emitTelemetry("hello-world", "hello-world.echo.count", 1, { outcome: "ok" });
    assert(emitted.length === 2, "custom emission dropped");
    assert(emitted[1].metric === "hello-world.echo.count", "custom metric wrong");
    assert(emitted[1].labels.app === "hello-world", "app label auto-attached");
    assert(emitted[1].labels.outcome === "ok", "declared label preserved");

    // Invalid emissions rejected
    emitTelemetry("hello-world", "hello-world.echo.count", 1, { unknown: "x" });
    assert(emitted.length === 2, "undeclared label should have been rejected");
    emitTelemetry("hello-world", "hello-world.undeclared", 1);
    assert(emitted.length === 2, "undeclared metric should have been rejected");

    // 12 baseline metrics catalogued
    assert(BASELINE_METRICS.length === 12, "12 baseline metrics expected");

    // Discovery of custom metrics works
    const declared = discoverTelemetry();
    assert(declared.length >= 1, "custom telemetry not discoverable");
  });

  // ─── Demo 6 — Command Palette discovers App commands dynamically ─
  demo(6, "Command Palette discovers commands dynamically", () => {
    const commands = discoverCommands();
    assert(commands.length >= 1, "no commands discovered");
    const found = findCommand("hello-world.say-hi");
    assert(found, "hello-world.say-hi not discoverable");
    assert(found.appSlug === "hello-world", "command app tag missing");
    assert(found.shortcut === "g h", "shortcut lost in discovery");

    const grouped = discoverCommandsGrouped();
    assert(grouped.actions.length >= 1, "actions group empty");
  });

  // ─── Demo 7 — Trade Center brand pack applies without App changes ─
  // Verified separately (see verify-week1-brand-pack.mjs) — the brand
  // pack ships in a follow-up file so it can be exercised without
  // touching this discovery-focused script.
  demo(7, "Trade Center brand pack applies (checked separately)", () => {
    const brandPack = join(ROOT, "src/platform/design/tokens/tradeCenterBrand.ts");
    assert(existsSync(brandPack), "trade center brand pack file missing");
    const source = readFileSync(brandPack, "utf-8");
    assert(
      source.includes("BRAND_YELLOW") && source.includes("#FFB300"),
      "brand pack does not declare BRAND_YELLOW #FFB300"
    );
    assert(
      source.includes("applyBrandPack"),
      "brand pack does not expose applyBrandPack()"
    );
  });

  // ─── Demo 8 — Existing Apps continue to function unchanged ────
  demo(8, "Existing Apps continue to function unchanged", () => {
    // Manifest validator MUST not require any of the new fields.
    // A minimal manifest that omits every ADR-033+ slice should
    // register cleanly.
    const minimalApp = {
      manifestVersion: 1,
      slug: "legacy-shape",
      name: "Legacy",
      tagline: "Pre-ADR-033 manifest",
      description: "An App from before the extensions landed.",
      icon: "Package",
      category: "operations",
      version: "0.1.0",
      publisher: { name: "Legacy Team", verified: false },
      compatibility: { industries: ["*"], pages: ["*"], createsPages: [] },
      requirements: {
        plan: "free",
        dependencies: [],
        conflicts: [],
        capabilities: [],
        permissions: []
      },
      studio: { sections: [] },
      appStore: { screenshots: [], benefits: [], priceLabel: "Free" }
    };
    appRegistry.register(minimalApp);
    const found = appRegistry.get("legacy-shape");
    assert(found, "legacy-shape App failed to register");
    assert(!found.aiTools, "legacy manifest should have no aiTools");
    assert(!found.featureFlags, "legacy manifest should have no flags");
    assert(!found.telemetry, "legacy manifest should have no telemetry");
    assert(!found.commands, "legacy manifest should have no commands");
    assert(!found.platformCompat, "legacy manifest should have no platformCompat");
  });

  unregister();

  process.stdout.write("\n");
  process.stdout.write(`${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.stdout.write("\nFailures:\n");
    for (const f of failures) {
      process.stdout.write(`  Demo ${f.n} — ${f.name}\n    ${f.message}\n`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`\n${RED}Verification harness crashed:${RESET}\n${err.stack}\n`);
  process.exit(2);
});
