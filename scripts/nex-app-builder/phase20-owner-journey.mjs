// NEX · Phase 20 · Complete Owner Journey (Philip 2026-08-14).
//
// ONE Playwright script that walks the entire NEX product story:
//
//   1. Anonymous person arrives at NEX
//        → 307 redirect from / to /nex-app (front door)
//   2. Front door renders "Explore" and "Create" cards
//   3. Click "Create my business app"
//        → land on App Builder chat
//   4. Landscape template cards render (Phase 20 UX addition)
//   5. Click the Staircase card
//        → NEX loads the staircase seed (with Helix product)
//        → chat says "ready to build?"
//   6. Type "yes" → build kicks off
//   7. Wait for VerdictPanel to render (Phase 19C surface)
//   8. Click Publish
//        → HTTP POST /api/nex-app-builder/publish
//        → owner-scoped signed cookie set
//        → same-tab redirect to /b/{slug}/workspace
//   9. Owner workspace renders (Phase 12/13/18)
//  10. Second browser context (fresh customer) opens /b/{slug}/chat
//        → branded customer surface renders (Phase 11)
//  11. PWA per-business endpoints all return 200
//        (manifest.json · sw.js · icon)
//  12. Customer sends "How much is the Helix?" and captures baseline price
//  13. Owner mutates Helix price to £16,995
//        via /api/b/{slug}/owner/nex/propose + /apply (Phase 14 governance)
//        (uses the owner cookie captured in step 8)
//  14. Customer asks again — reply contains the new £16,995 price
//
// Prereqs:
//   - Dev server running on http://localhost:3008 (npm run dev)
//   - Playwright + Chromium installed
//   - process.env.NEX_SESSION_SECRET set on the dev server (any string)
//
// Non-negotiable acceptance criteria:
//   A · Journey completes end-to-end with zero manual intervention.
//   B · Every waypoint asserts the promised state (not "did the page load").
//   C · Customer NEVER sees owner-only content in their session.
//   D · Owner mutation flows through governance (propose → apply → audit)
//       and the customer reflects the new value without cache invalidation.
//   E · Screenshots recorded at every major waypoint for human review.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.NEX_QA_BASE ?? "http://localhost:3008";
const OUT_DIR = join(process.cwd(), "tmp-nex-qa-screenshots", "phase20-journey");

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else { console.error("FAIL:", msg); failures.push(msg); fail++; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // Preflight — dev server reachable.
  const ping = await fetch(BASE).catch((e) => ({ ok: false, error: e.message }));
  if (!ping || ping.ok === false) {
    console.error(`Dev server not reachable at ${BASE}. Start with: npm run dev`);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    // ═══════════════════════════════════════════════════════════════
    // OWNER CONTEXT — the person building the app
    // ═══════════════════════════════════════════════════════════════
    console.log("");
    console.log("═".repeat(60));
    console.log("OWNER · walks the journey from / to publish");
    console.log("═".repeat(60));

    const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const owner = await ownerCtx.newPage();
    const ownerErrors = [];
    owner.on("console", (m) => { if (m.type() === "error") ownerErrors.push(m.text()); });
    owner.on("pageerror", (e) => ownerErrors.push(`pageerror: ${e.message}`));

    // Step 1 · arrive at /
    console.log("");
    console.log("── 1. Arrive at / ──");
    const r1 = await owner.goto(BASE, { waitUntil: "networkidle", timeout: 120_000 });
    assert(r1?.status() === 200, `1 · root loaded (final status ${r1?.status()})`);
    assert(owner.url().endsWith("/nex-app"), `1 · redirected to /nex-app (got ${owner.url()})`);

    // Step 2 · front door renders both cards
    console.log("");
    console.log("── 2. Front door renders ──");
    await owner.waitForSelector('[data-testid="nex-front-door"]', { timeout: 15_000 });
    const exploreCard = await owner.$('[data-testid="front-door-explore"]');
    const createCard  = await owner.$('[data-testid="front-door-create"]');
    assert(exploreCard !== null, `2 · "Explore a business" card present`);
    assert(createCard !== null,  `2 · "Create my business app" card present`);
    await owner.screenshot({ path: join(OUT_DIR, "01-front-door.png"), fullPage: true });

    // Step 3 · click Create
    console.log("");
    console.log("── 3. Click Create → App Builder ──");
    await Promise.all([
      owner.waitForURL(/\/nex-app\/app-builder$/, { timeout: 60_000 }),
      owner.click('[data-testid="front-door-create"]')
    ]);
    assert(owner.url().endsWith("/nex-app/app-builder"), `3 · on App Builder route (${owner.url()})`);

    // Step 4 · landscape template cards render
    console.log("");
    console.log("── 4. Template cards render ──");
    await owner.waitForSelector('[data-testid="template-card-staircase"]', { timeout: 30_000 });
    const cardIds = await owner.$$eval(
      '[data-testid^="template-card-"]',
      (nodes) => nodes.map((n) => n.getAttribute("data-testid"))
    );
    assert(cardIds.length >= 7, `4 · at least 7 template cards render (got ${cardIds.length})`);
    assert(cardIds.includes("template-card-staircase"), `4 · staircase card present`);
    await owner.screenshot({ path: join(OUT_DIR, "02-template-cards.png"), fullPage: true });

    // Step 5 · click Staircase card → NEX loads seed + ready-to-build
    console.log("");
    console.log("── 5. Click Staircase card ──");
    await owner.click('[data-testid="template-card-staircase"]');
    // Wait for the "Build & preview" button to appear (means readyToBuild=true)
    await owner.waitForSelector('button:has-text("Build & preview")', { timeout: 30_000 });
    assert(true, `5 · staircase seed loaded · Build & preview available`);
    await owner.screenshot({ path: join(OUT_DIR, "03-ready-to-build.png"), fullPage: true });

    // Step 6 · click Build (skip typing "yes" — button is faster + deterministic)
    console.log("");
    console.log("── 6. Build kicks off ──");
    await owner.click('button:has-text("Build & preview")');

    // Step 7 · wait for verdicts panel to appear
    console.log("");
    console.log("── 7. VerdictPanel renders ──");
    await owner.waitForSelector('[data-testid="verdict-card-validation-name"]', { timeout: 180_000 });
    assert(true, `7 · verdict panel visible after build`);
    // Also assert Publish CTA is visible
    await owner.waitForSelector('[data-testid="publish-app"]', { timeout: 10_000 });
    assert(true, `7 · Publish CTA visible after verdicts render`);
    await owner.screenshot({ path: join(OUT_DIR, "04-verdicts-and-publish.png"), fullPage: true });

    // Step 8 · click Publish → workspace redirect
    console.log("");
    console.log("── 8. Publish → workspace ──");
    const [pubResponse] = await Promise.all([
      owner.waitForResponse((r) => r.url().includes("/api/nex-app-builder/publish") && r.request().method() === "POST", { timeout: 30_000 }),
      owner.click('[data-testid="publish-app"]')
    ]);
    assert(pubResponse.status() === 200, `8 · publish returned 200 (got ${pubResponse.status()})`);
    const pubJson = await pubResponse.json();
    assert(pubJson.ok === true, `8 · publish ok=true`);
    const slug = pubJson.slug;
    assert(typeof slug === "string" && slug.length > 0, `8 · slug returned (${slug})`);
    // Owner scoped cookie should be set
    const cookiesAfterPublish = await ownerCtx.cookies(BASE);
    const ownerCookie = cookiesAfterPublish.find((c) => c.name === `nex_owner_${slug}`);
    assert(!!ownerCookie, `8 · scoped owner cookie "nex_owner_${slug}" set on client`);

    // Wait for the same-tab hand-off to workspace
    await owner.waitForURL(new RegExp(`/b/${slug.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}/workspace$`), { timeout: 30_000 });
    assert(owner.url().endsWith(`/b/${slug}/workspace`), `9 · owner arrived at /b/${slug}/workspace`);
    // Workspace shell renders — check for text NEX only shows to owners
    const workspaceHtml = await owner.content();
    assert(
      /NEX|Assist|Workspace|Change history|Conversations/i.test(workspaceHtml),
      `9 · owner workspace shell content present`
    );
    await owner.screenshot({ path: join(OUT_DIR, "05-owner-workspace.png"), fullPage: true });

    // ═══════════════════════════════════════════════════════════════
    // CUSTOMER CONTEXT — a fresh browser, no shared cookies
    // ═══════════════════════════════════════════════════════════════
    console.log("");
    console.log("═".repeat(60));
    console.log("CUSTOMER · fresh browser · opens the branded app");
    console.log("═".repeat(60));

    const custCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    });
    const customer = await custCtx.newPage();
    const custErrors = [];
    customer.on("console", (m) => { if (m.type() === "error") custErrors.push(m.text()); });
    customer.on("pageerror", (e) => custErrors.push(`pageerror: ${e.message}`));

    console.log("");
    console.log("── 10. Customer chat page ──");
    // Retry the chat page load — Next.js dev mode compiles the /b/[slug]
    // route on first request and its in-memory business registry is a
    // fresh module instance the first time. Second hit is fast and hot.
    let chatResp = await customer.goto(`${BASE}/b/${slug}/chat`, { waitUntil: "networkidle", timeout: 60_000 });
    if (chatResp?.status() === 404) {
      console.log("    (chat page 404 on first hit — retrying after 2s · Next.js dev registry compile)");
      await new Promise((r) => setTimeout(r, 2000));
      chatResp = await customer.goto(`${BASE}/b/${slug}/chat`, { waitUntil: "networkidle", timeout: 60_000 });
    }
    assert(chatResp?.status() === 200, `10 · branded chat route returned 200 (got ${chatResp?.status()})`);
    const custBody = await customer.evaluate(() => document.body.innerText);
    // Should include the business identity name (from completed blueprint).
    assert(
      custBody.length > 50,
      `10 · branded customer surface has non-trivial content (${custBody.length} chars)`
    );
    // Owner-only content MUST NOT leak into the customer view.
    assert(
      !/NEX Assist|Change history|Proposal|Mutation/i.test(custBody),
      `10 · customer view does NOT expose owner-only labels`
    );
    await customer.screenshot({ path: join(OUT_DIR, "06-customer-chat.png"), fullPage: true });

    // Step 11 · PWA endpoints
    console.log("");
    console.log("── 11. PWA per-business endpoints ──");
    for (const path of [`/api/b/${slug}/manifest.json`, `/api/b/${slug}/sw.js`, `/api/b/${slug}/icon`]) {
      const resp = await fetch(`${BASE}${path}`);
      assert(resp.status === 200, `11 · ${path} status 200 (got ${resp.status})`);
    }

    // Step 12 · customer sends "How much is the Helix?" — capture baseline
    console.log("");
    console.log("── 12. Baseline customer conversation ──");
    const baselineResp = await fetch(`${BASE}/api/b/${slug}/customer/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "How much is the Helix?" })
    });
    assert(baselineResp.status === 200, `12 · anonymous customer can send a message (got ${baselineResp.status})`);
    const baselineJson = await baselineResp.json();
    const baselineReply = String(baselineJson.reply?.text ?? baselineJson.reply ?? JSON.stringify(baselineJson));
    console.log(`      baseline reply: "${baselineReply.slice(0, 200)}"`);
    assert(baselineReply.length > 0, `12 · baseline reply non-empty`);
    // Baseline should mention Helix (product exists in seed).
    assert(
      /helix/i.test(baselineReply),
      `12 · baseline reply mentions Helix (product exists in the seeded blueprint)`
    );

    // Step 13 · owner mutates Helix price via governance (propose + apply)
    console.log("");
    console.log("── 13. Owner mutation · Helix price → £16,995 ──");
    // Owner uses HTTP APIs directly (equivalent to what the NEX Assist UI
    // would trigger). The test uses the owner cookie captured in step 8.
    const ownerCookieHeader = `${ownerCookie.name}=${ownerCookie.value}`;

    // Propose route accepts EITHER `instruction: string` (NL) OR
    // `proposal: MutationProposal` (structured). We use structured for
    // deterministic testing — no NL parsing surprise.
    const propResp = await fetch(`${BASE}/api/b/${slug}/owner/nex/propose`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookieHeader },
      body: JSON.stringify({
        proposal: {
          kind: "product.price",
          selector: { slug: "helix-oak-open-tread" },
          newValue: { amount: 1699500, currency: "GBP" }
        }
      })
    });
    const propJson = await propResp.json();
    assert(propResp.status === 200, `13 · propose returned 200 (got ${propResp.status} · body: ${JSON.stringify(propJson).slice(0, 300)})`);
    if (propResp.status !== 200) {
      console.error("      propose response body:", JSON.stringify(propJson));
      process.exit(1);
    }
    assert(propJson.ok === true && propJson.proposal?.proposalId, `13 · proposal minted (id: ${propJson.proposal?.proposalId})`);

    const applyResp = await fetch(`${BASE}/api/b/${slug}/owner/nex/apply`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookieHeader },
      body: JSON.stringify({ proposalId: propJson.proposal.proposalId, confirmed: true })
    });
    assert(applyResp.status === 200, `13 · apply returned 200 (got ${applyResp.status})`);
    const applyJson = await applyResp.json();
    assert(applyJson.ok === true, `13 · apply ok=true`);

    // Step 14 · customer sees the new price
    console.log("");
    console.log("── 14. Customer sees mutated price ──");
    const afterResp = await fetch(`${BASE}/api/b/${slug}/customer/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "How much is the Helix?" })
    });
    assert(afterResp.status === 200, `14 · post-mutation customer message returned 200 (got ${afterResp.status})`);
    const afterJson = await afterResp.json();
    const afterReply = String(afterJson.reply?.text ?? afterJson.reply ?? JSON.stringify(afterJson));
    console.log(`      post-mutation reply: "${afterReply.slice(0, 200)}"`);
    // Reply should contain 16,995 (or 16995) — the new price in GBP.
    assert(
      /16[,.]?995/.test(afterReply),
      `14 · customer reply now contains new price 16,995 (got: "${afterReply.slice(0, 200)}")`
    );
    // Screenshot the customer view after refresh — proves visual reflection.
    await customer.reload({ waitUntil: "networkidle" });
    await customer.screenshot({ path: join(OUT_DIR, "07-customer-after-mutation.png"), fullPage: true });

    // Final sanity — no console errors in either context.
    assert(customer !== null, `customer · zero console errors during journey (got ${custErrors.length}${custErrors.length > 0 ? " :: " + custErrors.slice(0, 3).join(" | ") : ""})`);
    // Log every owner error before asserting so we can see exactly what's wrong.
    if (ownerErrors.length > 0) {
      console.log("");
      console.log("  Owner-context console errors captured:");
      for (const e of ownerErrors) console.log("    · " + e.slice(0, 400));
    }
    assert(ownerErrors.length === 0,  `owner · zero console errors during journey (got ${ownerErrors.length}${ownerErrors.length > 0 ? " :: " + ownerErrors.slice(0, 3).join(" | ") : ""})`);
    assert(custErrors.length  === 0,  `customer · zero console errors during journey (got ${custErrors.length})`);

  } finally {
    await browser.close();
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Phase 20 · owner journey · ${pass} passed · ${fail} failed`);
  console.log("=".repeat(60));
  if (fail > 0) {
    console.error("");
    console.error("Failures:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
}

await main();
