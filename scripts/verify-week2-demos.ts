// Week 2 Demo Verification Script (TypeScript).
//
// Run:  npx tsx scripts/verify-week2-demos.ts
//
// Proves the 6 Week-2 deliverables:
//   1. Workspace state persists + mutations emit events
//   2. Policy engine: can() + role composition
//   3. Universal Search orchestrator: fan-out + grouping + ranking
//   4. Widget slot discovery per App
//   5. Notifications registry + delivery inbox
//   6. Mode selector: classify + promote + downgrade

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
  const { appRegistry } = await import("@/platform/registry");
  const {
    readWorkspaceState,
    pinItem,
    unpinItem,
    recordVisit,
    setCurrentApp,
    setRightPanel,
    setMode,
    setTheme,
    resetWorkspaceStateForTests
  } = await import("@/platform/sdk/workspaceState");
  const {
    registerRole,
    grantRole,
    can,
    assertCan,
    discoverCapabilities,
    capabilitiesForRole,
    resetPolicyEngineForTests
  } = await import("@/platform/policy/engine");
  const {
    discoverSearchProviders,
    registerProviderHandler,
    universalSearch,
    resetSearchOrchestratorForTests
  } = await import("@/platform/search/orchestrator");
  const {
    discoverWidgetsForSlot,
    discoverWidgets
  } = await import("@/platform/widgets/discovery");
  const {
    discoverNotificationKinds,
    deliver,
    unreadCountForUser,
    markRead,
    listForUser,
    resetNotificationsForTests
  } = await import("@/platform/notifications/discovery");
  const { classify, promoteToWorkspaceMode, downgradeIfInactive } = await import(
    "@/platform/shell/modeSelector"
  );
  const { setSink } = await import("@/platform/telemetry/baseline");

  // Register a rich fixture App that opts into every Week 2 declaration.
  const fixtureApp = {
    manifestVersion: 1 as const,
    slug: "week2-fixture",
    name: "Week 2 Fixture",
    tagline: "Exercises every Week 2 manifest slice",
    description: "Fixture App used by Week 2 verification.",
    icon: "TestTube",
    category: "operations" as const,
    version: "1.0.0",
    publisher: { name: "Trade Center Platform Team", verified: true },
    compatibility: { industries: ["*"], pages: ["*"], createsPages: [] },
    requirements: {
      plan: "free" as const,
      dependencies: [],
      conflicts: [],
      capabilities: [],
      permissions: []
    },
    studio: { sections: [] },
    appStore: { screenshots: [], benefits: [], priceLabel: "Free" },

    // ─── Week 2 slices ────────────────────────────────────────
    declaredCapabilities: [
      {
        key: "week2-fixture.approve_refund",
        description: "Approve a refund",
        scope: "user" as const,
        defaultTiers: ["paid" as const]
      },
      {
        key: "week2-fixture.moderate",
        description: "Moderate listings",
        scope: "user" as const,
        defaultTiers: ["merchant-pro" as const]
      }
    ],
    searchProviders: [
      {
        id: "week2-fixture.products",
        kind: "products" as const,
        label: "Products",
        weight: 1.0,
        handler: "./search/products"
      }
    ],
    widgets: [
      {
        id: "week2-fixture.stock",
        slot: "home.today" as const,
        label: "Back-in-stock items",
        order: 5,
        handler: "./widgets/stock"
      }
    ],
    notificationKinds: [
      {
        kind: "week2-fixture.stock_alert",
        category: "inventory",
        description: "Stock alert fired",
        defaultChannels: ["in-app" as const, "email" as const]
      }
    ]
  };

  appRegistry.register(fixtureApp);

  // ─── Demo 1 — Workspace state ─────────────────────────────
  await demo(1, "Workspace state persists + mutations emit events", () => {
    resetWorkspaceStateForTests();
    const events: Array<{ metric: string; labels: Record<string, string> }> = [];
    setSink((e) => events.push({ metric: e.metric, labels: e.labels }));

    // Initial state
    let s = readWorkspaceState();
    assert(s.pinned.length === 0, "should start with no pins");
    assert(s.mode === "simple", "should start in simple mode");

    // Pin
    pinItem({ kind: "app", slug: "orders", pinnedAt: Date.now() });
    s = readWorkspaceState();
    assert(s.pinned.length === 1, "pin not recorded");
    // Every mutation emits — check the event fired
    assert(
      events.some((e) => e.labels.kind === "shell.item_pinned"),
      "pin event not emitted"
    );

    // Dedup
    pinItem({ kind: "app", slug: "orders", pinnedAt: Date.now() });
    s = readWorkspaceState();
    assert(s.pinned.length === 1, "duplicate pin should not stack");

    // Unpin
    unpinItem({ kind: "app", slug: "orders" });
    s = readWorkspaceState();
    assert(s.pinned.length === 0, "unpin failed");

    // Recent
    recordVisit("app", "marketplace");
    recordVisit("app", "orders");
    recordVisit("app", "marketplace"); // bumps to most-recent
    s = readWorkspaceState();
    assert(s.recent.length === 2, "recent should dedup");
    assert(s.recent[0].target === "marketplace", "most recent first");

    // Current App + right panel + theme
    setCurrentApp("orders");
    setRightPanel({ kind: "ai" });
    setTheme("trade-center");
    s = readWorkspaceState();
    assert(s.currentAppSlug === "orders", "current app not set");
    assert(s.rightPanel.kind === "ai", "right panel not set");
    assert(s.theme === "trade-center", "theme not set");
  });

  // ─── Demo 2 — Policy engine ───────────────────────────────
  await demo(2, "Policy engine: can() + role composition", () => {
    resetPolicyEngineForTests();

    // Discover — fixture App minted 2 capabilities
    const caps = discoverCapabilities();
    assert(caps.length >= 2, "capabilities not discovered from manifest");

    // Compose roles
    registerRole({
      key: "support-agent",
      displayName: "Support Agent",
      capabilities: ["week2-fixture.approve_refund"]
    });
    registerRole({
      key: "senior-support",
      displayName: "Senior Support",
      extends: ["support-agent"],
      capabilities: ["week2-fixture.moderate"]
    });
    const senior = capabilitiesForRole("senior-support");
    assert(senior.has("week2-fixture.approve_refund"), "extends not resolved");
    assert(senior.has("week2-fixture.moderate"), "direct capability missing");

    // Grant and check
    grantRole({
      userSlug: "alice",
      roleKey: "support-agent",
      grantedBy: "admin"
    });
    assert(can({ userSlug: "alice" }, "week2-fixture.approve_refund"), "alice denied");
    assert(!can({ userSlug: "alice" }, "week2-fixture.moderate"), "alice over-granted");
    assert(!can({ userSlug: "bob" }, "week2-fixture.approve_refund"), "bob over-granted");

    // Extends test via role escalation
    grantRole({
      userSlug: "alice",
      roleKey: "senior-support",
      grantedBy: "admin"
    });
    assert(can({ userSlug: "alice" }, "week2-fixture.moderate"), "extends failed at runtime");

    // Throwing variant
    let threw = false;
    try {
      assertCan({ userSlug: "bob" }, "week2-fixture.moderate");
    } catch {
      threw = true;
    }
    assert(threw, "assertCan should throw for denied user");
  });

  // ─── Demo 3 — Universal Search orchestrator ───────────────
  await demo(3, "Universal Search fans out + groups + ranks", async () => {
    resetSearchOrchestratorForTests();

    // Discovery
    const providers = discoverSearchProviders();
    assert(providers.length >= 1, "no search providers discovered");

    // Register a handler for the fixture provider
    registerProviderHandler("week2-fixture.products", async (q) => [
      {
        id: `p1:${q}`,
        kind: "products",
        title: `Widget matching "${q}"`,
        score: 0.9,
        appSlug: "week2-fixture"
      },
      {
        id: `p2:${q}`,
        kind: "products",
        title: `Second match`,
        score: 0.5,
        appSlug: "week2-fixture"
      }
    ]);

    const res = await universalSearch("trowel");
    assert(res.totalResults === 2, `expected 2 results, got ${res.totalResults}`);
    assert(res.groups.length === 1, "single group expected");
    assert(res.groups[0].kind === "products", "wrong group kind");
    assert(res.groups[0].results[0].score >= res.groups[0].results[1].score, "not sorted by score");

    // Short queries return empty
    const empty = await universalSearch("t");
    assert(empty.totalResults === 0, "short query should not fan out");

    // Timing captured
    assert(res.timings.providerTimings.length >= 1, "provider timings missing");
  });

  // ─── Demo 4 — Widget slot discovery ───────────────────────
  await demo(4, "Widget slot discovery per App", () => {
    const homeToday = discoverWidgetsForSlot("home.today");
    assert(homeToday.length >= 1, "no home.today widgets discovered");
    const w = homeToday.find((w) => w.id === "week2-fixture.stock");
    assert(w, "fixture widget not discovered");
    assert(w.appSlug === "week2-fixture", "widget appSlug missing");

    const rightPanel = discoverWidgetsForSlot("right-panel");
    assert(rightPanel.length === 0, "right-panel should be empty for fixture");

    const all = discoverWidgets();
    assert(all.length >= 1, "no widgets discovered at all");
  });

  // ─── Demo 5 — Notifications ───────────────────────────────
  await demo(5, "Notifications registry + delivery inbox", () => {
    resetNotificationsForTests();

    const kinds = discoverNotificationKinds();
    assert(kinds.length >= 1, "no notification kinds discovered");
    const k = kinds.find((k) => k.kind === "week2-fixture.stock_alert");
    assert(k, "fixture notification kind not discovered");
    assert(k.defaultChannels.includes("in-app"), "default channels missing");

    // Deliver a valid notification
    const n = deliver({
      kind: "week2-fixture.stock_alert",
      userSlug: "alice",
      title: "Trowel back in stock",
      body: "5 units available."
    });
    assert(n.id !== "rejected", "valid delivery was rejected");
    assert(unreadCountForUser("alice") === 1, "unread count wrong");

    // Undeclared kind rejected
    const rejected = deliver({
      kind: "nonexistent.kind",
      userSlug: "alice",
      title: "Should not deliver"
    });
    assert(rejected.id === "rejected", "undeclared kind should be rejected");
    assert(unreadCountForUser("alice") === 1, "rejected delivery should not count");

    // Mark read
    markRead(n.id);
    assert(unreadCountForUser("alice") === 0, "mark-read failed");

    // List
    const list = listForUser("alice");
    assert(list.length === 1, "list should contain the marked-read notification");
    assert(list[0].readAt !== undefined, "readAt should be stamped");
  });

  // ─── Demo 6 — Mode selector ───────────────────────────────
  await demo(6, "Mode selector: classify + promote + downgrade", () => {
    resetWorkspaceStateForTests();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Anonymous / never acted → simple
    assert(classify({ lastWorkspaceActionMs: null, now }) === "simple", "null → simple");
    // Recent action → workspace
    assert(classify({ lastWorkspaceActionMs: now - 5 * day, now }) === "workspace", "recent → workspace");
    // 40 days ago → simple
    assert(classify({ lastWorkspaceActionMs: now - 40 * day, now }) === "simple", "old → simple");

    // Promote is idempotent
    promoteToWorkspaceMode();
    assert(readWorkspaceState().mode === "workspace", "promote failed");
    promoteToWorkspaceMode();
    assert(readWorkspaceState().mode === "workspace", "promote should idempotent");

    // Silent downgrade after inactivity
    setMode("workspace");
    const downgraded = downgradeIfInactive({ lastWorkspaceActionMs: now - 40 * day, now });
    assert(downgraded === true, "downgrade should have fired");
    assert(readWorkspaceState().mode === "simple", "state not downgraded");

    // No downgrade for active users
    setMode("workspace");
    const notDown = downgradeIfInactive({ lastWorkspaceActionMs: now - 5 * day, now });
    assert(notDown === false, "should not downgrade active user");
    assert(readWorkspaceState().mode === "workspace", "active user unchanged");
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
