// Week 1 Demo Verification Script (TypeScript).
//
// Run:  npx tsx scripts/verify-week1-demos.ts
//
// Proves the 8 demonstrations Philip approved for Week 1 exit.

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Path resolution helpers ────────────────────────────────────
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ─── tsx path alias resolution ──────────────────────────────────
// Our source files import from "@/platform/*"; tsx handles path
// alias resolution via the project's tsconfig.

// Colours
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const PASS = `${GREEN}✓${RESET}`;
const FAIL = `${RED}✗${RESET}`;

let passed = 0;
let failed = 0;
const failures: Array<{ n: number; name: string; message: string }> = [];

function demo(n: number, name: string, fn: () => void): void {
  process.stdout.write(`Demo ${n} — ${name} ... `);
  try {
    fn();
    process.stdout.write(`${PASS}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`${FAIL}\n`);
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`   ${DIM}${msg}${RESET}\n`);
    failed++;
    failures.push({ n, name, message: msg });
  }
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  // Dynamic imports so any missing file fails a specific demo not
  // the entire harness at import time.
  const { appRegistry } = await import("@/platform/registry");
  const { helloWorldAppManifest } = await import(
    "@/platform/demo/helloWorldApp"
  );
  const { discoverAITools, findAITool } = await import(
    "@/platform/aiTools/discovery"
  );
  const { catalogueAITools } = await import("@/platform/aiTools/dispatcher");
  const { discoverFeatureFlags, isEnabledByDefault } = await import(
    "@/platform/featureFlags/discovery"
  );
  const {
    discoverCommands,
    discoverCommandsGrouped,
    findCommand
  } = await import("@/platform/commands/discovery");
  const {
    BASELINE_METRICS,
    emitBaseline,
    emitTelemetry,
    discoverTelemetry,
    setSink
  } = await import("@/platform/telemetry/baseline");

  // Register the demo App
  appRegistry.register(helloWorldAppManifest);

  // ─── Demo 1 — App can declare AI tools ────────────────────────
  demo(1, "App can declare AI tools", () => {
    const app = appRegistry.get("hello-world");
    assert(app, "hello-world App not registered");
    assert(app.aiTools?.length === 1, "expected 1 aiTool declared");
    assert(
      app.aiTools[0].name === "hello-world.echo",
      "tool name mismatch"
    );
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
  });

  // ─── Demo 3 — App can declare feature flags ───────────────────
  demo(3, "App can declare feature flags", () => {
    const app = appRegistry.get("hello-world");
    assert(app?.featureFlags?.length === 1, "expected 1 flag declared");
    assert(
      app.featureFlags[0].key === "hello-world.enabled",
      "flag key mismatch"
    );
  });

  // ─── Demo 4 — Shell recognises those flags ────────────────────
  demo(4, "Shell recognises those flags", () => {
    const flags = discoverFeatureFlags();
    assert(flags.length >= 1, "no flags discovered");
    const found = flags.find((f) => f.key === "hello-world.enabled");
    assert(found, "hello-world.enabled not discoverable by shell");
    assert(
      isEnabledByDefault("hello-world.enabled") === true,
      "default flag value wrong"
    );
    assert(
      isEnabledByDefault("hello-world.nonexistent") === undefined,
      "unknown flag should return undefined"
    );
  });

  // ─── Demo 5 — App exposes telemetry without manual wiring ─────
  demo(5, "App exposes telemetry without manual wiring", () => {
    const emitted: Array<{
      metric: string;
      value: number;
      labels: Record<string, string>;
      emittedAt: number;
    }> = [];
    setSink((event) => emitted.push(event));

    // Baseline emission (runtime-produced)
    emitBaseline("plugin.request.count", 1, {
      app: "hello-world",
      route: "/echo"
    });
    assert(emitted.length === 1, "baseline emission dropped");
    assert(
      emitted[0].metric === "plugin.request.count",
      "wrong metric emitted"
    );

    // Custom emission (App-declared)
    emitTelemetry("hello-world", "hello-world.echo.count", 1, {
      outcome: "ok"
    });
    assert(emitted.length === 2, "custom emission dropped");
    assert(
      emitted[1].metric === "hello-world.echo.count",
      "custom metric wrong"
    );
    assert(
      emitted[1].labels.app === "hello-world",
      "app label auto-attached"
    );
    assert(
      emitted[1].labels.outcome === "ok",
      "declared label preserved"
    );

    // Invalid emissions rejected
    emitTelemetry("hello-world", "hello-world.echo.count", 1, {
      unknown: "x"
    });
    assert(
      emitted.length === 2,
      "undeclared label should have been rejected"
    );
    emitTelemetry("hello-world", "hello-world.undeclared", 1);
    assert(
      emitted.length === 2,
      "undeclared metric should have been rejected"
    );

    assert(BASELINE_METRICS.length === 12, "12 baseline metrics expected");

    const declared = discoverTelemetry();
    assert(declared.length >= 1, "custom telemetry not discoverable");
  });

  // ─── Demo 6 — Command Palette discovers commands dynamically ──
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

  // ─── Demo 7 — Trade Center brand pack ─────────────────────────
  demo(7, "Trade Center brand pack applies without App changes", () => {
    const brandPackPath = join(
      ROOT,
      "src/platform/design/tokens/tradeCenterBrand.ts"
    );
    assert(existsSync(brandPackPath), "brand pack file missing");
    const source = readFileSync(brandPackPath, "utf-8");
    assert(
      source.includes("BRAND_YELLOW") && source.includes("#FFB300"),
      "brand pack does not declare BRAND_YELLOW #FFB300"
    );
    assert(
      source.includes("applyBrandPack"),
      "brand pack does not expose applyBrandPack()"
    );
    assert(
      source.includes("BRAND_OFFWHITE") && source.includes("#FBF6EC"),
      "brand pack does not include off-white platform surface"
    );
    assert(
      source.includes("color.action.primary") && source.includes("#166534"),
      "brand pack does not declare dark green CTA"
    );
  });

  // ─── Demo 8 — Existing Apps continue to function unchanged ────
  demo(8, "Existing Apps continue to function unchanged", () => {
    const minimalApp = {
      manifestVersion: 1 as const,
      slug: "legacy-shape",
      name: "Legacy",
      tagline: "Pre-ADR-033 manifest",
      description: "An App from before the extensions landed.",
      icon: "Package",
      category: "operations" as const,
      version: "0.1.0",
      publisher: { name: "Legacy Team", verified: false },
      compatibility: {
        industries: ["*"],
        pages: ["*"],
        createsPages: []
      },
      requirements: {
        plan: "free" as const,
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
    assert(
      !found.platformCompat,
      "legacy manifest should have no platformCompat"
    );
  });

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
  process.stderr.write(
    `\n${RED}Verification harness crashed:${RESET}\n${err.stack ?? err.message}\n`
  );
  process.exit(2);
});
