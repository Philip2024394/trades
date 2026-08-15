// NEX App Builder · Worker 5 · Visual QA (Philip 2026-08-14).
//
// Consumes: assembled StudioLayoutJson per page (from Blueprint → pipeline adapter).
// Produces: VisualQAPlan — a structured list of checks the QA harness
//           MUST run once a preview URL is available.
//
// This worker DOES NOT render pages itself and DOES NOT invent screenshots.
// It plans the QA surface deterministically from the Blueprint + assembled
// layouts. A subsequent worker (or a Playwright integration step) executes
// the plan against a real preview URL and reports back.
//
// Constitutional rule: never fabricate a "PASS" without evidence. Every
// check in the plan is either PENDING (not yet executed) or has a real
// executed result attached.

import type { AppBlueprint } from "../blueprint-schema";
import type {
  EvidenceRecord,
  EvidenceVerdict,
  WorkerContext,
  WorkerReport
} from "./types";
import { startReport } from "./types";
import type { StudioLayoutJson } from "@/lib/studio/schema";

export type VisualQACheckKind =
  | "desktop-renders"
  | "mobile-renders"
  | "no-section-overflow"
  | "no-image-crop-broken"
  | "typography-legible"
  | "cta-visible-above-fold"
  | "navigation-present"
  | "footer-present"
  | "no-empty-section"
  | "no-broken-binding"
  | "all-heroes-load"
  | "page-title-set";

export type VisualQAStatus = "PENDING" | "PASS" | "FAIL" | "SKIP";

export type VisualQACheck = {
  id: string;
  pageId: string;
  kind: VisualQACheckKind;
  target?: string;             // section instanceId when scoped to a section
  description: string;
  status: VisualQAStatus;
  /** Only present when status !== PENDING. */
  evidence?: {
    detail: string;
    screenshotUrl?: string;
    measurement?: Record<string, unknown>;
  };
};

export type VisualQAPlan = {
  checks: VisualQACheck[];
  totals: {
    total: number;
    pending: number;
    pass: number;
    fail: number;
    skip: number;
  };
  /** Preconditions the QA runner needs before it can execute. */
  runnerRequirements: {
    playwrightInstalled: boolean;
    previewUrlNeeded: boolean;
    devServerNeeded: boolean;
  };
};

export function runVisualQAWorker(
  ctx: WorkerContext,
  args: { assembledLayouts: Record<string, StudioLayoutJson> }
): WorkerReport<VisualQAPlan> {
  const report = startReport("visual-qa");
  const bp = ctx.blueprint;

  const checks: VisualQACheck[] = [];

  for (const page of bp.pages) {
    const layout = args.assembledLayouts[page.id];
    if (!layout) {
      checks.push({
        id: `qa_${page.id}_missing_layout`,
        pageId: page.id,
        kind: "no-empty-section",
        description: `page "${page.id}" has no assembled StudioLayoutJson · cannot QA`,
        status: "FAIL",
        evidence: { detail: "adapter did not produce a layout for this page" }
      });
      continue;
    }

    // Standard per-page checks that don't need a live URL to plan:
    checks.push({
      id: `qa_${page.id}_desktop`,
      pageId: page.id,
      kind: "desktop-renders",
      description: `page "${page.id}" renders on desktop (1440x900) without console errors`,
      status: "PENDING"
    });
    checks.push({
      id: `qa_${page.id}_mobile`,
      pageId: page.id,
      kind: "mobile-renders",
      description: `page "${page.id}" renders on mobile (390x844) without console errors`,
      status: "PENDING"
    });
    checks.push({
      id: `qa_${page.id}_no_overflow`,
      pageId: page.id,
      kind: "no-section-overflow",
      description: `no section on "${page.id}" horizontally overflows the viewport`,
      status: "PENDING"
    });
    checks.push({
      id: `qa_${page.id}_nav`,
      pageId: page.id,
      kind: "navigation-present",
      description: `top navigation renders on "${page.id}"`,
      status: "PENDING"
    });
    checks.push({
      id: `qa_${page.id}_title`,
      pageId: page.id,
      kind: "page-title-set",
      description: `<title> on "${page.id}" is non-empty and matches Blueprint SEO template`,
      status: "PENDING"
    });

    // Section-scoped checks
    for (const s of layout.sections) {
      if (s.key.startsWith("hero")) {
        checks.push({
          id: `qa_${page.id}_${s.instanceId}_hero_loads`,
          pageId: page.id,
          kind: "all-heroes-load",
          target: s.instanceId,
          description: `hero image on "${page.id}" (${s.key}) loads successfully`,
          status: "PENDING"
        });
      }
      // Empty-section check
      if (Object.keys(s.config as Record<string, unknown>).length === 0) {
        checks.push({
          id: `qa_${page.id}_${s.instanceId}_empty`,
          pageId: page.id,
          kind: "no-empty-section",
          target: s.instanceId,
          description: `section "${s.instanceId}" has no config · likely to render as empty`,
          status: "FAIL",
          evidence: { detail: "config object is empty" }
        });
      }
    }
  }

  const totals = {
    total: checks.length,
    pending: checks.filter((c) => c.status === "PENDING").length,
    pass: checks.filter((c) => c.status === "PASS").length,
    fail: checks.filter((c) => c.status === "FAIL").length,
    skip: checks.filter((c) => c.status === "SKIP").length
  };

  // Runner-preflight — WITHOUT actually launching Playwright, we check the
  // things a runner would need. This surfaces to Studio what's still missing.
  const runnerRequirements: VisualQAPlan["runnerRequirements"] = {
    playwrightInstalled: hasPlaywright(),
    previewUrlNeeded: true,          // always true until a URL is passed to the runner
    devServerNeeded: true            // local runs need `next dev` up somewhere
  };

  const status = totals.fail > 0 ? "warn" : "ok";

  // ── Phase 19B · Evidence-based verdict ─────────────────────────────
  const evidence: EvidenceRecord[] = [];
  evidence.push({
    observation: `Planned ${totals.total} visual QA check(s) across ${bp.pages.length} page(s)`,
    source: "adapter",
    value: totals
  });
  evidence.push({
    observation: `Playwright ${runnerRequirements.playwrightInstalled ? "IS" : "IS NOT"} installed`,
    source: "runtime",
    value: { playwrightInstalled: runnerRequirements.playwrightInstalled }
  });
  for (const c of checks.filter((c) => c.status === "FAIL")) {
    evidence.push({
      observation: `Plan-time FAIL: ${c.description} · ${c.evidence?.detail ?? "no detail"}`,
      source: "adapter",
      path: c.target ? `pages.${c.pageId}.sections.${c.target}` : `pages.${c.pageId}`
    });
  }
  if (totals.pending > 0) {
    evidence.push({
      observation: `${totals.pending} check(s) are PENDING — require live Playwright execution before verdict can move to PASS or FAIL`,
      source: "runtime"
    });
  }

  const verdict: EvidenceVerdict = totals.fail > 0
    ? {
        state: "FAILED",
        evidence,
        diagnosis: `${totals.fail} QA check(s) failed at PLAN time (empty configs, missing layouts) — a live run would still fail`,
        decision: "Fix the plan-time failures in the Blueprint before running the live QA"
      }
    : totals.pending > 0 && !runnerRequirements.playwrightInstalled
      ? {
          state: "PENDING",
          evidence,
          diagnosis: `${totals.pending} check(s) require live execution but Playwright is not installed — verdict deferred (never fabricate PASS)`,
          decision: "Install @playwright/test locally and re-run with executeQA=true, OR accept PENDING as the honest current state"
        }
      : totals.pending > 0
        ? {
            state: "PENDING",
            evidence,
            diagnosis: `${totals.pending} check(s) planned; awaiting live execution to move to PASS/FAIL`,
            decision: "Run orchestrator with executeQA=true against a live preview URL"
          }
        : totals.pass > 0
          ? {
              state: "HEALTHY",
              evidence,
              diagnosis: `All ${totals.pass} check(s) passed on a live run`,
              decision: "Proceed"
            }
          : {
              state: "HEALTHY",
              evidence,
              diagnosis: "No QA checks required (empty blueprint)",
              decision: "Proceed"
            };

  return report.finish<VisualQAPlan>(
    status,
    { checks, totals, runnerRequirements },
    verdict,
    {
      errors: [],
      warnings: totals.fail > 0
        ? [{ code: "visual-qa-fail-before-run", message: `${totals.fail} check(s) failed at PLAN time (empty configs, missing layouts) · fix before running the live QA` }]
        : [],
      messages: [{
        level: "info",
        text: `Visual QA plan produced · ${totals.total} checks · ${totals.pending} PENDING execution · Playwright ${runnerRequirements.playwrightInstalled ? "available" : "NOT installed"}.`
      }]
    }
  );
}

function hasPlaywright(): boolean {
  try {
    // Attempt to resolve without importing — presence-only check.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve("@playwright/test");
    return true;
  } catch {
    return false;
  }
}
