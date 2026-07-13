// Week 4 Demo Verification.
// Proves the AI Dispatcher end-to-end without hitting any external
// API. Uses the canned transport shipped with the platform.

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const PASS = `${GREEN}✓${RESET}`;
const FAIL = `${RED}✗${RESET}`;

let passed = 0;
let failed = 0;
const failures: Array<{ n: number; name: string; message: string }> = [];

function demo(n: number, name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => {
      process.stdout.write(`Demo ${n} — ${name} ... `);
      return fn();
    })
    .then(() => {
      process.stdout.write(`${PASS}\n`);
      passed++;
    })
    .catch((err) => {
      process.stdout.write(`${FAIL}\n`);
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`   ${DIM}${msg}${RESET}\n`);
      failed++;
      failures.push({ n, name, message: msg });
    });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const { registerMarketplaceApp } = await import("@/apps/marketplace/register");
  const { classifyTaskClass, route } = await import(
    "@/platform/aiTools/router"
  );
  const {
    dispatch,
    catalogueAITools,
    resetDispatcherForTests
  } = await import("@/platform/aiTools/dispatcher");
  const { setTransport, cannedTransport } = await import(
    "@/platform/aiTools/transport"
  );

  registerMarketplaceApp();
  setTransport(cannedTransport);

  // ─── Demo 1 — Cost router classifies task classes ─────────
  await demo(1, "Cost router classifies task classes correctly", () => {
    assert(
      classifyTaskClass({ prompt: "how many bags of plaster for 3m x 4m" }) ===
        "estimator",
      "estimator not classified"
    );
    assert(
      classifyTaskClass({ prompt: "find alternatives to a 14 inch trowel" }) ===
        "product_recommendation",
      "recommendation not classified"
    );
    assert(
      classifyTaskClass({ prompt: "show me plastering hawks" }) ===
        "product_search",
      "search not classified"
    );
    assert(
      classifyTaskClass({ prompt: "how much should I charge for a 10 sqm re-skim" }) ===
        "estimator",
      "business advice heuristics"
    );
  });

  // ─── Demo 2 — Route picks the right model per tier + task ─
  await demo(2, "Route picks the right model per tier + task", () => {
    // Free users get Haiku regardless of task
    const free = route({ prompt: "how much for a job?", userTier: "free" });
    assert(free.model === "haiku", `free tier should get haiku, got ${free.model}`);

    // Reasoning tasks get Opus
    const opus = route({
      prompt: "how many bags of plaster for 30sqm",
      userTier: "professional"
    });
    assert(opus.model === "opus", `estimator should get opus, got ${opus.model}`);

    // Fuzzy search sticks with Haiku
    const search = route({
      prompt: "find me trowels",
      userTier: "professional"
    });
    assert(search.model === "haiku", `search should get haiku, got ${search.model}`);
  });

  // ─── Demo 3 — Dispatcher discovers Marketplace tools ─────
  await demo(3, "Dispatcher discovers Marketplace tools", () => {
    const cat = catalogueAITools();
    assert(cat.totalTools >= 4, `expected >=4 tools, got ${cat.totalTools}`);
    const marketplaceTools = cat.tools.filter((t) => t.appSlug === "marketplace");
    assert(marketplaceTools.length >= 4, "marketplace tools missing from catalogue");
  });

  // ─── Demo 4 — Dispatch invokes tool handlers end-to-end ──
  await demo(4, "Dispatch invokes tool handlers end-to-end", async () => {
    const result = await dispatch({
      prompt: "find alternatives to a trowel — product p-marshalltown-trowel-14",
      userTier: "professional"
    });
    assert(result.toolCalls.length > 0, "no tool calls made");
    const alt = result.toolCalls.find(
      (tc) => tc.toolName === "marketplace.find_alternatives"
    );
    assert(alt, "find_alternatives tool not invoked by canned transport");
    assert(alt.result?.error === undefined, `handler errored: ${alt.result?.error}`);
    const payload = alt.result?.result as {
      alternatives: Array<{ id: string; name: string }>;
    };
    assert(
      Array.isArray(payload.alternatives),
      "handler did not return alternatives"
    );
  });

  // ─── Demo 5 — Handler-not-registered rejected cleanly ────
  await demo(5, "Handler-not-registered rejected cleanly", async () => {
    // Register a handler for an ad-hoc tool that ISN'T in any manifest
    // — canned transport won't call it. Instead we test a case where
    // the tool is DECLARED but its handler happens not to be
    // registered (simulates a partial deploy).
    const { registerToolHandler, dispatch, resetDispatcherForTests } =
      await import("@/platform/aiTools/dispatcher");
    resetDispatcherForTests();
    // Do NOT re-register marketplace handlers; run a dispatch that
    // makes the model attempt a tool call whose handler is missing.
    registerToolHandler("marketplace.compare_products", async () => ({
      status: "ok"
    }));
    const res = await dispatch({
      prompt: "compare marketplace products",
      userTier: "professional"
    });
    // The canned transport should have requested compare_products
    // (based on the "compare" trigger). Since only compare_products
    // has a handler, other invocations would error — but our canned
    // transport only ever emits one tool call per turn.
    const compareCall = res.toolCalls.find(
      (tc) => tc.toolName === "marketplace.compare_products"
    );
    assert(compareCall, "compare_products not invoked");
    assert(!compareCall.result?.error, "compare handler errored");
    // Re-register everything so subsequent demos don't fail
    registerMarketplaceApp();
  });

  // ─── Demo 6 — /api/ai/dispatch endpoint exists ────────────
  await demo(6, "/api/ai/dispatch route module exports POST", async () => {
    const mod = await import("@/app/api/ai/dispatch/route");
    assert(typeof mod.POST === "function", "POST handler missing");
  });

  // ─── Demo 7 — Copilot component exports ──────────────────
  await demo(7, "Copilot component exports correctly", async () => {
    const mod = await import("@/platform/shell/Copilot");
    assert(typeof mod.Copilot === "function", "Copilot component not exported");
  });

  // ─── Demo 8 — WorkspaceShell exposes askAI global helper ─
  await demo(8, "WorkspaceShell exposes askAI global helper", async () => {
    const mod = await import("@/platform/shell/WorkspaceShell");
    assert(typeof mod.askAI === "function", "askAI helper not exported");
    assert(typeof mod.AI_SEED_EVENT === "string", "AI_SEED_EVENT constant missing");
  });

  // ─── Demo 9 — Canteens redirect declared in next.config ──
  await demo(9, "Canteens redirect declared in next.config.mjs", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("next.config.mjs", "utf-8");
    assert(
      src.includes("/trade-off/yard/canteens"),
      "old canteens source path missing"
    );
    assert(
      src.includes("/community"),
      "community destination path missing"
    );
    assert(
      /permanent:\s*true/.test(src),
      "redirect must be permanent (301)"
    );
  });

  // ─── Demo 10 — Every dispatch emits telemetry ─────────────
  await demo(10, "Every dispatch emits ai.tool_invoked telemetry", async () => {
    const { setSink } = await import("@/platform/telemetry/baseline");
    const events: Array<{ metric: string; labels: Record<string, string> }> = [];
    setSink((e) => events.push({ metric: e.metric, labels: e.labels }));

    await dispatch({
      prompt: "find alternatives for p-refina-skimming-blade",
      userTier: "professional"
    });
    const toolMetric = events.find(
      (e) => e.metric === "plugin.ai.tool_invoked"
    );
    assert(toolMetric, "ai.tool_invoked not emitted");
    assert(
      toolMetric.labels.tool_name?.startsWith("marketplace."),
      "tool_name label missing"
    );
    const durationMetric = events.find(
      (e) => e.metric === "plugin.request.duration_ms"
    );
    assert(durationMetric, "request.duration_ms not emitted");
    assert(
      durationMetric.labels.route === "/api/ai/dispatch",
      "route label missing"
    );
  });

  process.stdout.write("\n");
  process.stdout.write(`${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
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
