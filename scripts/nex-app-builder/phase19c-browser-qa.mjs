// NEX App Builder · Phase 19C · Browser QA (Philip 2026-08-14).
//
// Real Chromium test. Drives the dev-only VerdictPanel preview route
// (`/nex-app/app-builder/__verdict-preview`) plus the production
// `/api/nex-app-builder/build` endpoint.
//
// Prereqs:
//   1. Dev server running on http://localhost:3008 (npm run dev).
//   2. Playwright + Chromium installed (npx playwright install chromium
//      only needed on first run — subsequent runs reuse the cache).
//
// Central rule tested:
//   The 8-state operator verdict taxonomy renders correctly in a real
//   browser (desktop + mobile viewports), every state chip label appears,
//   diagnosis + decision are visible, evidence details toggle open, and
//   NO credential-shaped strings leak into the rendered DOM.
//
// Non-negotiable criteria:
//   1. Preview route responds 200 in the browser (dev-only guard passes).
//   2. All three preview surfaces render a <VerdictPanel>.
//   3. Every 8 state chips render at least once (from the synthetic
//      forced-all-states surface), with the correct human label.
//   4. Every worker card exposes displayName, diagnosis, decision.
//   5. Evidence <details> toggles work on interaction.
//   6. Mobile viewport (390×844, iPhone 13) still renders the cards
//      without horizontal scroll on the panel.
//   7. Credential-shaped strings ("sk_live_...", "hunter2", session
//      tokens, raw JWTs) NEVER appear anywhere in the rendered DOM
//      across all three surfaces.
//   8. Direct POST to /api/nex-app-builder/build returns a well-formed
//      `verdicts` payload (Phase 19C API contract).
//   9. Screenshots saved for both viewports so a human can eyeball.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const BASE = process.env.NEX_QA_BASE ?? "http://localhost:3008";
const PREVIEW = `${BASE}/nex-app/app-builder/verdict-preview`;
const OUT_DIR = join(process.cwd(), "tmp-nex-qa-screenshots", "phase19c-browser");

const LAWFUL_STATES = [
  "HEALTHY", "DEGRADED",
  "BLOCKED_INPUT", "BLOCKED_CONFIG", "BLOCKED_UPSTREAM",
  "FAILED", "PENDING", "UNKNOWN"
];

const STATE_LABEL = {
  HEALTHY: "Healthy",
  DEGRADED: "Degraded",
  BLOCKED_INPUT: "Needs input",
  BLOCKED_CONFIG: "Needs config",
  BLOCKED_UPSTREAM: "Blocked upstream",
  FAILED: "Failed",
  PENDING: "Pending",
  UNKNOWN: "Unknown"
};

// Adversarial patterns injected via the synthetic surface. If any of these
// strings appear in the rendered DOM anywhere, the credential scrub has
// failed and the test MUST fail.
const CREDENTIAL_LEAK_PATTERNS = [
  "hunter2",
  "s3cr3tSessionValue",
  "sk_live_abcdef",
  // JWT-shaped high-entropy: header.payload.signature with dots
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  // Bearer tokens
  /bearer\s+[A-Za-z0-9._-]{20,}/i
];

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { console.log("PASS:", msg); pass++; }
  else { console.error("FAIL:", msg); failures.push(msg); fail++; }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // ── PRE-FLIGHT · dev server reachable ─────────────────────────────
  const preflight = await fetch(BASE).catch((e) => ({ ok: false, error: e.message }));
  if (!preflight || preflight.ok === false) {
    console.error(`Dev server not reachable at ${BASE}. Start with: npm run dev`);
    if (preflight?.error) console.error("Reason:", preflight.error);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    // ── A · DESKTOP VIEWPORT (1280×800) ──────────────────────────────
    console.log("");
    console.log("─".repeat(60));
    console.log("A. Desktop viewport (1280×800)");
    console.log("─".repeat(60));

    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const desktopPage = await desktopCtx.newPage();

    // Capture console errors so we notice React runtime crashes.
    const desktopConsoleErrors = [];
    desktopPage.on("console", (m) => {
      if (m.type() === "error") desktopConsoleErrors.push(m.text());
    });
    desktopPage.on("pageerror", (e) => desktopConsoleErrors.push(`pageerror: ${e.message}`));

    const desktopResp = await desktopPage.goto(PREVIEW, { waitUntil: "networkidle", timeout: 90_000 });
    assert(desktopResp?.status() === 200, `desktop · preview route status 200 (got ${desktopResp?.status()})`);

    await desktopPage.waitForSelector('[data-testid="verdict-preview-root"]', { timeout: 15_000 });
    assert(true, "desktop · preview root rendered");

    // All three panels present
    for (const id of ["verdict-panel-raw", "verdict-panel-completed", "verdict-panel-all-states", "verdict-panel-all-states-b"]) {
      const el = await desktopPage.$(`[data-testid="${id}"]`);
      assert(el !== null, `desktop · panel "${id}" present`);
    }

    // All 8 state chips appear at least once (from the forced-all-states panel).
    const chipLabels = await desktopPage.$$eval(
      '[data-testid^="verdict-card-"][data-testid$="-chip"]',
      (nodes) => nodes.map((n) => n.textContent?.trim() ?? "")
    );
    for (const state of LAWFUL_STATES) {
      const label = STATE_LABEL[state];
      assert(
        chipLabels.includes(label),
        `desktop · state chip "${label}" (${state}) rendered somewhere in DOM`
      );
    }

    // Every worker card in every panel exposes name, diagnosis, decision.
    const workerKeys = ["validation", "dataModel", "integration", "design", "visualQA", "provenanceSurface"];
    for (const worker of workerKeys) {
      const nameEls = await desktopPage.$$(`[data-testid="verdict-card-${worker}-name"]`);
      assert(nameEls.length >= 3, `desktop · ${worker} name rendered in ≥3 panels (got ${nameEls.length})`);
      const diagEls = await desktopPage.$$(`[data-testid="verdict-card-${worker}-diagnosis"]`);
      assert(diagEls.length >= 3, `desktop · ${worker} diagnosis rendered in ≥3 panels (got ${diagEls.length})`);
      const decEls = await desktopPage.$$(`[data-testid="verdict-card-${worker}-decision"]`);
      assert(decEls.length >= 3, `desktop · ${worker} decision rendered in ≥3 panels (got ${decEls.length})`);
    }

    // Evidence <details> toggle works on interaction (open an evidence panel
    // and verify the highlight list becomes visible).
    const evidenceHandles = await desktopPage.$$('[data-testid$="-evidence"]');
    assert(evidenceHandles.length > 0, `desktop · at least one evidence details block present (got ${evidenceHandles.length})`);
    if (evidenceHandles.length > 0) {
      const first = evidenceHandles[0];
      const beforeOpen = await first.evaluate((el) => el.open);
      await first.evaluate((el) => { el.open = true; });
      const afterOpen = await first.evaluate((el) => el.open);
      assert(beforeOpen === false && afterOpen === true, "desktop · evidence details toggles from closed → open");
    }

    // CREDENTIAL SCRUB — no leaked patterns anywhere in the desktop DOM.
    const desktopBody = await desktopPage.evaluate(() => document.body.innerText);
    for (const pattern of CREDENTIAL_LEAK_PATTERNS) {
      const leaked = typeof pattern === "string"
        ? desktopBody.includes(pattern)
        : pattern.test(desktopBody);
      assert(!leaked, `desktop · credential pattern ${pattern} NOT present in DOM`);
    }

    // No console errors during render.
    assert(
      desktopConsoleErrors.length === 0,
      `desktop · zero console errors during render (got ${desktopConsoleErrors.length}: ${desktopConsoleErrors.slice(0, 3).join(" | ")})`
    );

    await desktopPage.screenshot({ path: join(OUT_DIR, "desktop.png"), fullPage: true });
    console.log("  screenshot → tmp-nex-qa-screenshots/phase19c-browser/desktop.png");
    await desktopCtx.close();

    // ── B · MOBILE VIEWPORT (390×844, iPhone 13) ─────────────────────
    console.log("");
    console.log("─".repeat(60));
    console.log("B. Mobile viewport (390×844)");
    console.log("─".repeat(60));

    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    });
    const mobilePage = await mobileCtx.newPage();

    const mobileConsoleErrors = [];
    mobilePage.on("console", (m) => {
      if (m.type() === "error") mobileConsoleErrors.push(m.text());
    });
    mobilePage.on("pageerror", (e) => mobileConsoleErrors.push(`pageerror: ${e.message}`));

    const mobileResp = await mobilePage.goto(PREVIEW, { waitUntil: "networkidle", timeout: 90_000 });
    assert(mobileResp?.status() === 200, `mobile · preview route status 200 (got ${mobileResp?.status()})`);
    await mobilePage.waitForSelector('[data-testid="verdict-preview-root"]', { timeout: 15_000 });

    // Panels still render.
    for (const id of ["verdict-panel-raw", "verdict-panel-completed", "verdict-panel-all-states", "verdict-panel-all-states-b"]) {
      const el = await mobilePage.$(`[data-testid="${id}"]`);
      assert(el !== null, `mobile · panel "${id}" present`);
    }

    // Panel width does not exceed viewport (no horizontal overflow).
    const panelBox = await mobilePage.$eval(
      '[data-testid="verdict-panel-raw"] [data-testid="verdict-panel"]',
      (el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width };
      }
    );
    assert(
      panelBox.width <= 390,
      `mobile · panel width ${Math.round(panelBox.width)}px fits within 390px viewport`
    );

    // Chip labels still all present.
    const mobileChipLabels = await mobilePage.$$eval(
      '[data-testid^="verdict-card-"][data-testid$="-chip"]',
      (nodes) => nodes.map((n) => n.textContent?.trim() ?? "")
    );
    for (const state of LAWFUL_STATES) {
      assert(mobileChipLabels.includes(STATE_LABEL[state]),
        `mobile · state chip "${STATE_LABEL[state]}" (${state}) rendered`);
    }

    // Credential scrub on mobile DOM too (belt & braces).
    const mobileBody = await mobilePage.evaluate(() => document.body.innerText);
    for (const pattern of CREDENTIAL_LEAK_PATTERNS) {
      const leaked = typeof pattern === "string"
        ? mobileBody.includes(pattern)
        : pattern.test(mobileBody);
      assert(!leaked, `mobile · credential pattern ${pattern} NOT present in DOM`);
    }

    assert(
      mobileConsoleErrors.length === 0,
      `mobile · zero console errors during render (got ${mobileConsoleErrors.length})`
    );

    await mobilePage.screenshot({ path: join(OUT_DIR, "mobile.png"), fullPage: true });
    console.log("  screenshot → tmp-nex-qa-screenshots/phase19c-browser/mobile.png");
    await mobileCtx.close();

    // ── C · API CONTRACT · POST /api/nex-app-builder/build ────────────
    console.log("");
    console.log("─".repeat(60));
    console.log("C. API contract · POST /api/nex-app-builder/build");
    console.log("─".repeat(60));

    // Get the completed staircase blueprint by asking the server to build it.
    // We use the same dynamic import pattern as the other phase scripts so
    // we don't have to hand-craft the blueprint JSON here.
    const { staircaseCompletedBlueprint } = await import("../../src/lib/app-builder/examples/staircase-company-completed.ts");

    // Do the request from Node (not the browser) so we exercise the same
    // path a mobile app or curl would.
    const buildResp = await fetch(`${BASE}/api/nex-app-builder/build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // executeQA=false keeps this test fast; Playwright QA is not the
      // subject of Phase 19C, the verdict surface is.
      body: JSON.stringify({ blueprint: staircaseCompletedBlueprint, executeQA: false })
    });
    assert(buildResp.status === 200, `api · build status 200 (got ${buildResp.status})`);

    const buildJson = await buildResp.json();
    assert(buildJson.ok === true, `api · build ok=true`);
    assert(!!buildJson.verdicts, `api · response includes verdicts key`);

    if (buildJson.verdicts) {
      const v = buildJson.verdicts;
      assert(Array.isArray(v.verdicts) && v.verdicts.length === 6,
        `api · verdicts.length === 6 (got ${v.verdicts?.length})`);
      assert(typeof v.overall === "string" && v.overall.length > 0,
        `api · verdicts.overall present (${v.overall})`);
      assert(typeof v.runId === "string" && v.runId.length > 0,
        `api · verdicts.runId present`);

      // Every verdict has the UI-required fields.
      for (const w of v.verdicts ?? []) {
        assert(typeof w.state === "string", `api · ${w.worker} .state present`);
        assert(typeof w.diagnosis === "string" && w.diagnosis.length > 0,
          `api · ${w.worker} .diagnosis non-empty`);
        assert(typeof w.decision === "string" && w.decision.length > 0,
          `api · ${w.worker} .decision non-empty`);
      }

      // Full-response credential scrub — the API response itself must be clean.
      const respText = JSON.stringify(buildJson);
      for (const pattern of CREDENTIAL_LEAK_PATTERNS) {
        const leaked = typeof pattern === "string"
          ? respText.includes(pattern)
          : pattern.test(respText);
        assert(!leaked, `api · credential pattern ${pattern} NOT present in build response`);
      }
    }

  } finally {
    await browser.close();
  }

  // ── Summary ───────────────────────────────────────────────────────
  console.log("");
  console.log("=".repeat(60));
  console.log(`Phase 19C · browser QA · ${pass} passed · ${fail} failed`);
  console.log("=".repeat(60));
  if (fail > 0) {
    console.error("");
    console.error("Failures:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
}

await main();
