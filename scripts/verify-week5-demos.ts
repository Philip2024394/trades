// Week 5 Demo Verification.
// Proves widget handler runtime + Orders as Plugin #2 + Home
// renders discovered widgets from every App.

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
  const { registerOrdersApp } = await import("@/apps/orders/register");
  const { appRegistry } = await import("@/platform/registry");
  const { discoverAITools, findAITool } = await import("@/platform/aiTools/discovery");
  const { discoverCommands } = await import("@/platform/commands/discovery");
  const { universalSearch, discoverSearchProviders } = await import(
    "@/platform/search/orchestrator"
  );
  const {
    discoverWidgetsForSlot,
    countWidgetsBySlot
  } = await import("@/platform/widgets/discovery");
  const {
    renderWidgetPayload,
    resolveWidgetHandler
  } = await import("@/platform/widgets/runtime");
  const { discoverNotificationKinds } = await import(
    "@/platform/notifications/discovery"
  );
  const { discoverCapabilities } = await import("@/platform/policy/engine");
  const { dispatch } = await import("@/platform/aiTools/dispatcher");
  const { setTransport, cannedTransport } = await import(
    "@/platform/aiTools/transport"
  );

  registerMarketplaceApp();
  registerOrdersApp();
  setTransport(cannedTransport);

  await demo(1, "Orders App registered with every Week 1-2 slice", () => {
    const app = appRegistry.get("orders");
    assert(app, "orders App not registered");
    assert(app.aiTools?.length === 3, "expected 3 aiTools");
    assert(app.featureFlags?.length === 2, "expected 2 featureFlags");
    assert(app.telemetry?.length === 3, "expected 3 telemetry");
    assert(app.commands?.length === 3, "expected 3 commands");
    assert(app.declaredCapabilities?.length === 3, "expected 3 capabilities");
    assert(app.searchProviders?.length === 1, "expected 1 searchProvider");
    assert(app.widgets?.length === 2, "expected 2 widgets");
    assert(app.notificationKinds?.length === 4, "expected 4 notification kinds");
    assert(app.requirements.dependencies.includes("marketplace"), "should depend on marketplace");
  });

  await demo(2, "Widget discovery covers Marketplace AND Orders", () => {
    const homeToday = discoverWidgetsForSlot("home.today");
    const mkt = homeToday.filter((w) => w.appSlug === "marketplace");
    const ord = homeToday.filter((w) => w.appSlug === "orders");
    assert(mkt.length >= 2, "marketplace widgets missing");
    assert(ord.length >= 2, "orders widgets missing");
  });

  await demo(3, "Widget handlers register + invoke end-to-end", async () => {
    assert(resolveWidgetHandler("marketplace.back_in_stock"), "marketplace handler missing");
    const mkt = await renderWidgetPayload("marketplace.back_in_stock");
    assert(mkt.rows && mkt.rows.length > 0, "marketplace payload empty");
    assert(resolveWidgetHandler("orders.arriving_today"), "orders handler missing");
    const ord = await renderWidgetPayload("orders.arriving_today");
    assert(
      (ord.rows && ord.rows.length > 0) || ord.emptyLabel,
      "orders payload malformed"
    );
  });

  await demo(4, "Unregistered widget returns safe empty state", async () => {
    const payload = await renderWidgetPayload("nonexistent.widget");
    assert(payload.emptyLabel, "unregistered widget should have empty label");
    assert(!payload.rows && !payload.chips, "unregistered widget should not have content");
  });

  await demo(5, "Orders AI tools discovered + dispatchable", async () => {
    assert(findAITool("orders.track_order"), "track_order missing");
    assert(findAITool("orders.cancel_order"), "cancel_order missing");
    assert(findAITool("orders.list_recent"), "list_recent missing");
    const tools = discoverAITools();
    // Marketplace(4) + Orders(3) = 7 registered by this harness.
    assert(tools.length >= 7, `expected 7+ total tools, got ${tools.length}`);
    const result = await dispatch({
      prompt: "track order ord_20260710_001",
      userTier: "professional"
    });
    const call = result.toolCalls.find((tc) => tc.toolName === "orders.track_order");
    assert(call, "track_order not invoked");
    assert(!call.result?.error, `track_order errored: ${call.result?.error}`);
  });

  await demo(6, "Palette shows commands from Marketplace AND Orders", () => {
    const cmds = discoverCommands();
    assert(cmds.filter((c) => c.appSlug === "marketplace").length >= 5, "marketplace cmds missing");
    assert(cmds.filter((c) => c.appSlug === "orders").length >= 3, "orders cmds missing");
  });

  await demo(7, "Universal Search returns Orders alongside products", async () => {
    const providers = discoverSearchProviders();
    assert(providers.filter((p) => p.appSlug === "orders").length >= 1, "orders provider missing");
    const res = await universalSearch("trowel");
    const contentGroup = res.groups.find((g) => g.kind === "content");
    assert(contentGroup, "content group missing");
    assert(
      contentGroup!.results.some((r) => r.appSlug === "orders"),
      "orders result missing"
    );
  });

  await demo(8, "countWidgetsBySlot sums across every App", () => {
    const counts = countWidgetsBySlot();
    assert(counts["home.today"] >= 4, `expected >=4 home.today, got ${counts["home.today"]}`);
    assert(counts["right-panel"] >= 1, "right-panel widgets missing");
  });

  await demo(9, "Orders capabilities registered in policy catalogue", () => {
    const caps = discoverCapabilities();
    const orderCaps = caps.filter((c) => c.appSlug === "orders");
    assert(orderCaps.length >= 3, "orders capabilities missing");
    assert(orderCaps.find((c) => c.key === "orders.approve_refund"), "approve_refund missing");
  });

  await demo(10, "Orders notification kinds discovered", () => {
    const kinds = discoverNotificationKinds();
    const orderKinds = kinds.filter((k) => k.appSlug === "orders");
    assert(orderKinds.length === 4, "expected 4 orders notification kinds");
    assert(orderKinds.find((k) => k.kind === "orders.dispatched"), "dispatched missing");
    assert(
      orderKinds.find((k) => k.kind === "orders.delayed" && k.severity === "warning"),
      "delayed with warning severity missing"
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
