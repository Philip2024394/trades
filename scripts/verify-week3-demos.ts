// Week 3 Demo Verification Script.
// Proves the Marketplace App integrates end-to-end with every
// Week 1–2 platform service.

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
  const { registerMarketplaceApp } = await import("@/apps/tradecenter/register");
  const { appRegistry } = await import("@/platform/registry");
  const { discoverAITools, findAITool } = await import("@/platform/aiTools/discovery");
  const { discoverFeatureFlags } = await import("@/platform/featureFlags/discovery");
  const { discoverCommands } = await import("@/platform/commands/discovery");
  const { discoverTelemetry } = await import("@/platform/telemetry/baseline");
  const { discoverCapabilities } = await import("@/platform/policy/engine");
  const { universalSearch, discoverSearchProviders } = await import(
    "@/platform/search/orchestrator"
  );
  const { discoverWidgetsForSlot } = await import("@/platform/widgets/discovery");
  const { discoverNotificationKinds } = await import(
    "@/platform/notifications/discovery"
  );
  const { PRODUCT_FIXTURES } = await import("@/apps/tradecenter/data/products");
  const { MERCHANT_FIXTURES, findMerchant } = await import(
    "@/apps/tradecenter/data/merchants"
  );

  registerMarketplaceApp();

  // ─── Demo 1 — Marketplace registered with every slice ─────
  await demo(1, "Marketplace opts into every Week 1-2 declaration slice", () => {
    const app = appRegistry.get("marketplace");
    assert(app, "marketplace App not registered");
    assert(app.platformCompat?.apiVersion === "1.0.0", "platformCompat missing");
    assert((app.aiTools?.length ?? 0) >= 4, "aiTools missing");
    assert((app.featureFlags?.length ?? 0) >= 4, "featureFlags missing");
    assert((app.telemetry?.length ?? 0) >= 4, "telemetry missing");
    assert((app.commands?.length ?? 0) >= 5, "commands missing");
    assert((app.declaredCapabilities?.length ?? 0) >= 5, "capabilities missing");
    assert((app.searchProviders?.length ?? 0) >= 3, "searchProviders missing");
    assert((app.widgets?.length ?? 0) >= 2, "widgets missing");
    assert((app.notificationKinds?.length ?? 0) >= 3, "notificationKinds missing");
  });

  // ─── Demo 2 — AI Dispatcher discovers Marketplace tools ───
  await demo(2, "AI Dispatcher discovers Marketplace tools", () => {
    assert(findAITool("marketplace.search_products"), "search_products tool missing");
    assert(findAITool("marketplace.compare_products"), "compare_products tool missing");
    assert(findAITool("marketplace.find_alternatives"), "find_alternatives tool missing");
    assert(findAITool("marketplace.get_product"), "get_product tool missing");
    const tools = discoverAITools().filter((t) => t.appSlug === "marketplace");
    assert(tools.length >= 4, "expected 4+ Marketplace AI tools discovered");
  });

  // ─── Demo 3 — Feature flags surface via platform runtime ──
  await demo(3, "Feature flags surface via platform runtime", () => {
    const flags = discoverFeatureFlags().filter((f) => f.appSlug === "marketplace");
    assert(flags.length >= 4, "expected 4+ Marketplace flags");
    assert(
      flags.find((f) => f.key === "marketplace.trade_pricing"),
      "trade_pricing flag missing"
    );
  });

  // ─── Demo 4 — Command Palette shows Marketplace commands ──
  await demo(4, "Command Palette shows Marketplace commands", () => {
    const cmds = discoverCommands().filter((c) => c.appSlug === "marketplace");
    assert(cmds.length >= 5, "expected 5+ Marketplace commands");
    assert(cmds.find((c) => c.id === "marketplace.search"), "search command missing");
    assert(cmds.find((c) => c.id === "marketplace.compare"), "compare command missing");
  });

  // ─── Demo 5 — Universal Search returns products ───────────
  await demo(5, "Universal Search returns products via orchestrator", async () => {
    const providers = discoverSearchProviders().filter((p) => p.appSlug === "marketplace");
    assert(providers.length >= 3, "expected 3+ Marketplace search providers");

    // Handlers registered by registerMarketplaceApp() — try a real query
    const res = await universalSearch("trowel");
    assert(res.totalResults >= 1, "expected trowel search hits");
    // Products, merchants, and categories should all be groupable
    const kinds = new Set(res.groups.map((g) => g.kind));
    assert(kinds.has("products"), "products group missing from search");
    const merchantSearch = await universalSearch("Manchester");
    assert(merchantSearch.totalResults >= 1, "expected merchant search hits");
    const merchantHit = merchantSearch.groups.find((g) => g.kind === "merchants");
    assert(merchantHit && merchantHit.results.length >= 1, "merchant group missing");
  });

  // ─── Demo 6 — Widget slot has Marketplace contribution ────
  await demo(6, "Home 'Today's Work' slot has Marketplace widget", () => {
    const homeToday = discoverWidgetsForSlot("home.today").filter(
      (w) => w.appSlug === "marketplace"
    );
    assert(homeToday.length >= 2, "expected 2+ Marketplace widgets on home.today");
    assert(
      homeToday.find((w) => w.id === "marketplace.back_in_stock"),
      "back_in_stock widget missing"
    );
    const rightPanel = discoverWidgetsForSlot("right-panel").filter(
      (w) => w.appSlug === "marketplace"
    );
    assert(rightPanel.length >= 1, "expected compare drawer on right-panel");
  });

  // ─── Demo 7 — Notification kinds registered ───────────────
  await demo(7, "Notification kinds registered", () => {
    const kinds = discoverNotificationKinds().filter((k) => k.appSlug === "marketplace");
    assert(kinds.length >= 3, "expected 3+ Marketplace notification kinds");
    assert(
      kinds.find((k) => k.kind === "marketplace.back_in_stock"),
      "back_in_stock notification missing"
    );
  });

  // ─── Demo 8 — Trust score data flows to Product Card ──────
  await demo(8, "Trust score data flows through fixture merchants", () => {
    for (const merchant of MERCHANT_FIXTURES) {
      assert(
        merchant.trust.score >= 0 && merchant.trust.score <= 100,
        `merchant ${merchant.slug} trust score out of range: ${merchant.trust.score}`
      );
      const layers = Object.values(merchant.trust.layers);
      const verifiedCount = layers.filter((l) => l !== null).length;
      assert(verifiedCount >= 4, `merchant ${merchant.slug} has < 4 verified layers`);
    }
    // Product cards need a merchant for every product
    for (const p of PRODUCT_FIXTURES) {
      assert(findMerchant(p.merchantSlug), `product ${p.id} has unknown merchant`);
    }
  });

  // ─── Demo 9 — Marketplace capabilities registered ────────
  await demo(9, "Marketplace capabilities registered in policy catalogue", () => {
    const caps = discoverCapabilities().filter((c) => c.appSlug === "marketplace");
    assert(caps.length >= 5, "expected 5+ Marketplace capabilities");
    const buy = caps.find((c) => c.key === "marketplace.buy");
    assert(buy, "marketplace.buy capability missing");
    assert(buy.defaultTiers.includes("free"), "buy should be available on free tier");
    const trade = caps.find((c) => c.key === "marketplace.view_trade_pricing");
    assert(trade, "view_trade_pricing capability missing");
    assert(!trade.defaultTiers.includes("free"), "trade pricing should be gated");
  });

  // ─── Demo 10 — Custom telemetry declarations ─────────────
  await demo(10, "Marketplace declares 4 custom telemetry metrics", () => {
    const tel = discoverTelemetry().filter((t) => t.appSlug === "marketplace");
    assert(tel.length >= 4, "expected 4+ Marketplace telemetry declarations");
    assert(tel.find((t) => t.metric === "marketplace.card.viewed"), "card.viewed missing");
    assert(tel.find((t) => t.metric === "marketplace.compare.opened"), "compare.opened missing");
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
