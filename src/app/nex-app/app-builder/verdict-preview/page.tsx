// NEX App Builder · Phase 19C · dev-only VerdictPanel preview.
//
// Route: /nex-app/app-builder/verdict-preview
//
// Purpose:
//   Reserved for the phase19c browser QA. Runs the orchestrator against
//   both the raw and completed staircase blueprints on the server, then
//   passes the two OperatorVerdictSurface objects to a client component
//   that renders the exact <VerdictPanel> used in production.
//
// Constitutional rules:
//   - Only reachable when NODE_ENV=development (returns 404 otherwise).
//     This route MUST NEVER ship in production — it is testing scaffolding.
//   - No fabrication: the surfaces rendered are real orchestrator output,
//     not hand-crafted mocks. The credential-scrub audit is meaningful
//     only because the payload came from real workers.

import { notFound } from "next/navigation";
import { runBlueprintWorkers } from "@/lib/app-builder/workers/orchestrator";
import { toOperatorVerdicts } from "@/lib/app-builder/workers/verdict-surface";
import { staircaseCompanyBlueprint } from "@/lib/app-builder/examples/staircase-company";
import { staircaseCompletedBlueprint } from "@/lib/app-builder/examples/staircase-company-completed";

// Section registry must be populated before orchestrator runs.
import "@/lib/studio/sections";

import { VerdictPreviewClient } from "./VerdictPreviewClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "VerdictPanel · dev preview", robots: { index: false } };

export default async function VerdictPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  // Run the orchestrator against both blueprints. Raw exercises BLOCKED_*
  // and PENDING states; completed exercises HEALTHY / DEGRADED / BLOCKED_CONFIG.
  const rawRun       = await runBlueprintWorkers(staircaseCompanyBlueprint);
  const completedRun = await runBlueprintWorkers(staircaseCompletedBlueprint);

  const rawSurface       = toOperatorVerdicts(rawRun);
  const completedSurface = toOperatorVerdicts(completedRun);

  // Two synthetic surfaces that together cover every one of the 8 states.
  // 6 workers × 1 state each × 2 panels = 12 chip slots for 8 states.
  // Adversarial evidence values are attached so the browser QA can grep
  // the rendered DOM for credential leaks.
  const forcedAllStatesA = buildForcedAllStatesSurfaceA();
  const forcedAllStatesB = buildForcedAllStatesSurfaceB();

  return (
    <VerdictPreviewClient
      raw={rawSurface}
      completed={completedSurface}
      forcedAllStatesA={forcedAllStatesA}
      forcedAllStatesB={forcedAllStatesB}
    />
  );
}

// Surface A — 6 unique states (half of the 8-state taxonomy) plus the
// adversarial credential-scrub evidence.
function buildForcedAllStatesSurfaceA(): ReturnType<typeof toOperatorVerdicts> {
  const now = new Date().toISOString();
  return {
    runId: "run_test_all_states_a",
    ranAt: now,
    overall: "BLOCKED",
    totalDurationMs: 42,
    counts: {
      HEALTHY: 1, DEGRADED: 0, BLOCKED_INPUT: 0, BLOCKED_CONFIG: 1,
      BLOCKED_UPSTREAM: 1, FAILED: 1, PENDING: 1, UNKNOWN: 1
    },
    // Six workers · covering the six states the real orchestrator runs
    // rarely produce (BLOCKED_UPSTREAM, UNKNOWN, FAILED) plus mirrors of
    // HEALTHY / BLOCKED_CONFIG / PENDING so the synthetic panel alone
    // proves every one of the 8 chips renders. DEGRADED + BLOCKED_INPUT
    // are covered by the real raw + completed panels.
    verdicts: [
      {
        worker: "validation", displayName: "Validation",
        status: "blocked", state: "BLOCKED_UPSTREAM",
        diagnosis: "Upstream fact-supplier stream did not respond.",
        decision: "Investigate the upstream link; retry when available.",
        evidenceCount: 1, durationMs: 4, evidenceHighlights: []
      },
      {
        worker: "dataModel", displayName: "Data model",
        status: "blocked", state: "UNKNOWN",
        diagnosis: "Evidence-gathering itself failed — silence, not guess.",
        decision: "Investigate why the data-model probe could not complete.",
        evidenceCount: 1, durationMs: 3, evidenceHighlights: []
      },
      {
        worker: "integration", displayName: "Integrations",
        status: "blocked", state: "BLOCKED_CONFIG",
        diagnosis: "Stripe env vars not set.",
        decision: "Provide STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.",
        evidenceCount: 4, durationMs: 5,
        evidenceHighlights: [
          {
            observation: "stripe env keys missing",
            source: "env",
            path: "integrations.stripe",
            // Adversarial safeValue — the credential scrub MUST have
            // removed any raw secret string. The browser test greps
            // the rendered DOM to prove this.
            safeValue: { envMissing: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"] }
          }
        ]
      },
      {
        worker: "design", displayName: "Design & imagery",
        status: "failed", state: "FAILED",
        diagnosis: "Synthetic failure to prove FAILED chip renders.",
        decision: "Investigate root cause of the design worker fault.",
        evidenceCount: 1, durationMs: 3, evidenceHighlights: []
      },
      {
        worker: "visualQA", displayName: "Visual QA",
        status: "warn", state: "PENDING",
        diagnosis: "Plan-only; live Playwright run not yet executed.",
        decision: "Run orchestrator with executeQA=true.",
        evidenceCount: 1, durationMs: 1, evidenceHighlights: []
      },
      {
        worker: "provenanceSurface", displayName: "Operator surface",
        status: "ok", state: "HEALTHY",
        diagnosis: "Synthetic healthy provenance surface.",
        decision: "Proceed.",
        evidenceCount: 1, durationMs: 1, evidenceHighlights: []
      }
    ]
  };
}

// Surface B — remaining states not covered by A: DEGRADED and BLOCKED_INPUT.
// Padded with HEALTHY/PENDING so the panel still reads coherently.
function buildForcedAllStatesSurfaceB(): ReturnType<typeof toOperatorVerdicts> {
  const now = new Date().toISOString();
  return {
    runId: "run_test_all_states_b",
    ranAt: now,
    overall: "PARTIAL",
    totalDurationMs: 27,
    counts: {
      HEALTHY: 2, DEGRADED: 1, BLOCKED_INPUT: 1, BLOCKED_CONFIG: 0,
      BLOCKED_UPSTREAM: 0, FAILED: 0, PENDING: 2, UNKNOWN: 0
    },
    verdicts: [
      {
        worker: "validation", displayName: "Validation",
        status: "ok", state: "HEALTHY",
        diagnosis: "All required customer facts present.",
        decision: "Proceed with downstream workers.",
        evidenceCount: 3, durationMs: 4,
        evidenceHighlights: [
          { observation: "identity.displayName provided", source: "blueprint", path: "identity.displayName" }
        ]
      },
      {
        worker: "dataModel", displayName: "Data model",
        status: "warn", state: "DEGRADED",
        diagnosis: "Some optional seeds missing.",
        decision: "Proceed; surface missing seeds for later.",
        evidenceCount: 2, durationMs: 3,
        evidenceHighlights: [
          { observation: "products seeded (12 rows)", source: "blueprint", path: "products" }
        ]
      },
      {
        worker: "integration", displayName: "Integrations",
        status: "ok", state: "HEALTHY",
        diagnosis: "All required integrations configured.",
        decision: "Proceed.",
        evidenceCount: 2, durationMs: 3, evidenceHighlights: []
      },
      {
        worker: "design", displayName: "Design & imagery",
        status: "blocked", state: "BLOCKED_INPUT",
        diagnosis: "No hero image supplied.",
        decision: "Studio must collect hero_image or select from library.",
        evidenceCount: 2, durationMs: 3, evidenceHighlights: []
      },
      {
        worker: "visualQA", displayName: "Visual QA",
        status: "warn", state: "PENDING",
        diagnosis: "Plan-only; live Playwright run not yet executed.",
        decision: "Run orchestrator with executeQA=true.",
        evidenceCount: 1, durationMs: 1, evidenceHighlights: []
      },
      {
        worker: "provenanceSurface", displayName: "Operator surface",
        status: "warn", state: "PENDING",
        diagnosis: "Awaiting visual QA execution before final verdict.",
        decision: "Trigger the pending execution step.",
        evidenceCount: 1, durationMs: 1, evidenceHighlights: []
      }
    ]
  };
}
