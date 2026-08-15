// NEX App Builder · Playwright QA runner (Philip 2026-08-14).
//
// Turns the visual-qa-worker's PLAN into REAL PASS/FAIL/PENDING results
// by driving each representative-rendered page through headless Chromium.
//
// Constitutional rules enforced here:
//   - Playwright unavailable → PENDING (never PASS)
//   - Check not executed → PENDING
//   - Check executed → PASS or FAIL (never fabricated)
//   - Screenshot only recorded when Playwright actually captured it
//
// This module dynamically imports Playwright so callers without it
// installed can still run the plan-mode worker.

import type { AppBlueprint } from "../blueprint-schema";
import type { StudioLayoutJson } from "@/lib/studio/schema";
import type { VisualQACheck, VisualQAPlan } from "../workers/visual-qa-worker";
import { renderRepresentativePages, type RepresentativePage } from "./representative-renderer";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type ViewportProfile = "desktop" | "mobile";

const VIEWPORTS: Record<ViewportProfile, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  mobile:  { width:  390, height: 844 }
};

export type PlaywrightRunOptions = {
  screenshotDir?: string;   // absolute path — screenshots saved here per page x viewport
  onlyPageIds?: string[];   // optionally scope
};

export type PlaywrightRunReport = {
  ran: boolean;              // true if Playwright launched successfully
  reason?: string;           // populated when ran=false
  totalChecks: number;
  executed: number;
  pass: number;
  fail: number;
  pending: number;
  screenshots: Array<{ pageId: string; viewport: ViewportProfile; path: string }>;
  updatedChecks: VisualQACheck[];
  durationMs: number;
};

/** Attempt to run the QA plan with real Playwright. Never fabricates PASS. */
export async function runQAPlanWithPlaywright(
  bp: AppBlueprint,
  assembled: Record<string, StudioLayoutJson>,
  plan: VisualQAPlan,
  opts: PlaywrightRunOptions = {}
): Promise<PlaywrightRunReport> {
  const t0 = Date.now();
  // Attempt to load Playwright dynamically. If missing, everything stays PENDING.
  let chromium: unknown;
  try {
    const pw = await import("@playwright/test");
    chromium = (pw as { chromium?: unknown }).chromium ?? null;
    if (!chromium) throw new Error("chromium adapter missing");
  } catch (err) {
    return {
      ran: false,
      reason: "Playwright not installed — " + (err as Error).message,
      totalChecks: plan.checks.length,
      executed: 0,
      pass: 0,
      fail: 0,
      pending: plan.checks.length,
      screenshots: [],
      updatedChecks: plan.checks,   // unmodified · all remain PENDING
      durationMs: Date.now() - t0
    };
  }

  const screenshotDir = opts.screenshotDir ?? join(process.cwd(), "tmp-nex-qa-screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  const pages = renderRepresentativePages(bp, assembled)
    .filter((p) => !opts.onlyPageIds || opts.onlyPageIds.includes(p.pageId));

  // Launch browser
  const browser = await (chromium as {
    launch: (opts?: object) => Promise<{
      newContext: (opts?: object) => Promise<unknown>;
      close: () => Promise<void>;
    }>;
  }).launch({ headless: true });

  const screenshots: PlaywrightRunReport["screenshots"] = [];
  const updatedChecks: VisualQACheck[] = plan.checks.map((c) => ({ ...c }));

  try {
    for (const pageArt of pages) {
      for (const viewport of ["desktop", "mobile"] as ViewportProfile[]) {
        const size = VIEWPORTS[viewport];
        const context = await (browser as {
          newContext: (opts?: object) => Promise<{
            newPage: () => Promise<unknown>;
            close: () => Promise<void>;
          }>;
        }).newContext({ viewport: size });

        const page = await (context as {
          newPage: () => Promise<unknown>;
        }).newPage() as {
          setContent: (html: string, opts?: object) => Promise<void>;
          screenshot: (opts: object) => Promise<Buffer>;
          title: () => Promise<string>;
          locator: (sel: string) => {
            count: () => Promise<number>;
            first: () => { boundingBox: () => Promise<{ x: number; y: number; width: number; height: number } | null> };
          };
          evaluate: (fn: () => unknown) => Promise<unknown>;
        };

        // Set the representative HTML content
        await page.setContent(pageArt.html, { waitUntil: "load" });

        // Screenshot
        const shotPath = join(screenshotDir, `${pageArt.pageId}__${viewport}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        screenshots.push({ pageId: pageArt.pageId, viewport, path: shotPath });

        // ── Execute checks for this page × viewport ──────────────────────
        for (const check of updatedChecks) {
          if (check.pageId !== pageArt.pageId) continue;

          // Only run each check for its intended viewport (desktop/mobile
          // checks are scoped by kind; other checks run once on desktop).
          if (check.kind === "desktop-renders" && viewport !== "desktop") continue;
          if (check.kind === "mobile-renders"  && viewport !== "mobile")  continue;
          if (!["desktop-renders", "mobile-renders"].includes(check.kind) && viewport !== "desktop") continue;

          try {
            const outcome = await executeCheck(check, page);
            check.status = outcome.status;
            check.evidence = { detail: outcome.detail, screenshotUrl: shotPath, measurement: outcome.measurement };
          } catch (err) {
            check.status = "FAIL";
            check.evidence = { detail: "runner threw · " + (err as Error).message, screenshotUrl: shotPath };
          }
        }

        await (context as { close: () => Promise<void> }).close();
      }
    }
  } finally {
    await (browser as { close: () => Promise<void> }).close();
  }

  // Save an index file so operator can find screenshots
  writeFileSync(
    join(screenshotDir, "index.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), screenshots }, null, 2)
  );

  const passCount = updatedChecks.filter((c) => c.status === "PASS").length;
  const failCount = updatedChecks.filter((c) => c.status === "FAIL").length;
  const pendingCount = updatedChecks.filter((c) => c.status === "PENDING").length;

  return {
    ran: true,
    totalChecks: updatedChecks.length,
    executed: passCount + failCount,
    pass: passCount,
    fail: failCount,
    pending: pendingCount,
    screenshots,
    updatedChecks,
    durationMs: Date.now() - t0
  };
}

// ────────────────────────────────────────────────────────────────
// Check executors
// ────────────────────────────────────────────────────────────────

async function executeCheck(
  check: VisualQACheck,
  page: {
    title: () => Promise<string>;
    locator: (sel: string) => {
      count: () => Promise<number>;
      first: () => { boundingBox: () => Promise<{ x: number; y: number; width: number; height: number } | null> };
    };
    evaluate: (fn: () => unknown) => Promise<unknown>;
  }
): Promise<{ status: "PASS" | "FAIL"; detail: string; measurement?: Record<string, unknown> }> {
  switch (check.kind) {
    case "desktop-renders":
    case "mobile-renders": {
      // A representative render loads if `body` has children.
      const bodyChildren = await page.evaluate(() => document.body.children.length);
      if ((bodyChildren as number) > 0) {
        return { status: "PASS", detail: `body has ${bodyChildren} children on load`, measurement: { bodyChildren } };
      }
      return { status: "FAIL", detail: "body has no children · page failed to render" };
    }
    case "navigation-present": {
      const navCount = await page.locator('[data-testid="site-nav"]').count();
      if (navCount > 0) return { status: "PASS", detail: "site-nav present" };
      return { status: "FAIL", detail: "site-nav missing" };
    }
    case "footer-present": {
      const c = await page.locator('[data-testid="site-footer"]').count();
      if (c > 0) return { status: "PASS", detail: "site-footer present" };
      return { status: "FAIL", detail: "site-footer missing" };
    }
    case "page-title-set": {
      const t = await page.title();
      if (!t || t.length === 0) return { status: "FAIL", detail: "title empty or missing" };
      // Placeholder detection — any bracket-shaped placeholder ([Xxx] or [xxx]) means
      // an unfilled REQUIRED customer field is being rendered to the customer.
      // Constitutional rule: never present REQUIRED as complete.
      const placeholderMatch = t.match(/\[[^\]]+\]/);
      if (placeholderMatch) {
        return { status: "FAIL", detail: `title exposes unfilled placeholder "${placeholderMatch[0]}" in "${t}"` };
      }
      return { status: "PASS", detail: `title="${t}"` };
    }
    case "no-section-overflow": {
      // Compare document.body scrollWidth to viewport width
      const overflow = await page.evaluate(() => {
        const bodyScrollWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        return { bodyScrollWidth, winWidth, overflow: bodyScrollWidth > winWidth + 2 };
      }) as { bodyScrollWidth: number; winWidth: number; overflow: boolean };
      if (!overflow.overflow) {
        return { status: "PASS", detail: `body ${overflow.bodyScrollWidth}px ≤ viewport ${overflow.winWidth}px`, measurement: overflow };
      }
      return { status: "FAIL", detail: `body ${overflow.bodyScrollWidth}px overflows viewport ${overflow.winWidth}px`, measurement: overflow };
    }
    case "all-heroes-load": {
      // In the representative render, hero images are <img> tags with src attributes.
      const heroImgs = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('[data-nex-family="hero"] img'));
        return imgs.map((i) => ({ src: (i as HTMLImageElement).src, complete: (i as HTMLImageElement).complete, naturalWidth: (i as HTMLImageElement).naturalWidth }));
      }) as Array<{ src: string; complete: boolean; naturalWidth: number }>;
      const missingSrc = heroImgs.filter((i) => !i.src);
      if (missingSrc.length > 0) {
        return { status: "FAIL", detail: `${missingSrc.length} hero image(s) have no src`, measurement: { heroImgs } };
      }
      return { status: "PASS", detail: `${heroImgs.length} hero image(s) have src attributes`, measurement: { heroImgs } };
    }
    case "no-empty-section": {
      // check.target is the specific section instanceId
      if (check.target) {
        const empty = await page.evaluate((tid: string) => {
          const el = document.querySelector(`[data-testid="section-${tid}"]`);
          return el?.getAttribute("data-nex-empty") === "true";
        }, check.target as never) as boolean;
        return empty
          ? { status: "FAIL", detail: `section ${check.target} marked empty` }
          : { status: "PASS", detail: `section ${check.target} has content` };
      }
      // Page-level empty check — count empty sections
      const emptyCount = await page.evaluate(() => document.querySelectorAll('[data-nex-empty="true"]').length) as number;
      if (emptyCount === 0) return { status: "PASS", detail: "no sections marked empty" };
      return { status: "FAIL", detail: `${emptyCount} section(s) marked empty` };
    }
    default:
      return { status: "FAIL", detail: `no executor for kind="${check.kind}"` };
  }
}
