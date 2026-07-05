// StrategyAwareBookingFlow — the runtime renderer.
//
// Reads ResolvedStrategy, selects the best booking flow via
// bookingRegistry.recommend(), adapts inputs (CTA label, service
// ordering, deposit policy, gate, availability), and renders the
// chosen flow's renderer.
//
// Consumers pass a ResolvedStrategy — that's it. Zero other config.

"use client";

import type { ResolvedStrategy } from "@/platform/business/resolver";
import { bookingRegistry } from "./registry";
import type { FrozenBookingManifest } from "./types";

/** Vocabulary for cta.primary intents → button labels. */
const CTA_LABEL_BY_INTENT: Record<string, string> = {
  "book-consultation": "Book Consultation",
  "book-appointment": "Book Appointment",
  "book-survey": "Book Survey",
  "free-survey": "Book Free Survey",
  "request-quote": "Request Quote",
  "call-now": "Call Now",
  "whatsapp": "Message on WhatsApp",
  "open-trade-account": "Open Trade Account"
};

function ctaLabelFor(strategy: ResolvedStrategy, fallback: string): string {
  const intent = strategy.get("cta", "primary") as
    | { intent?: string }
    | undefined;
  if (intent?.intent && CTA_LABEL_BY_INTENT[intent.intent]) {
    return CTA_LABEL_BY_INTENT[intent.intent];
  }
  return fallback;
}

function servicesFor(
  strategy: ResolvedStrategy,
  fallback: readonly string[]
): readonly string[] {
  const priority = strategy.get("booking", "priorityServices") as
    | { list?: readonly string[] }
    | undefined;
  if (priority?.list?.length) return priority.list;
  const push = strategy.inputs.strategy.pushServices;
  if (push?.length) return push;
  return fallback;
}

function depositPolicyFor(
  strategy: ResolvedStrategy
): "required" | "optional" | "none" {
  const policy = strategy.get("booking", "depositPolicy") as
    | { value?: string }
    | undefined;
  if (policy?.value === "required" || policy?.value === "optional") {
    return policy.value;
  }
  return "none";
}

function availabilityDisplayFor(
  strategy: ResolvedStrategy,
  fallback: "calendar" | "next-available" | "callback-only" | "consultation"
): "calendar" | "next-available" | "callback-only" | "consultation" {
  const disp = strategy.get("booking", "availabilityDisplay") as
    | { value?: string }
    | undefined;
  if (disp?.value === "calendar" || disp?.value === "next-available" ||
      disp?.value === "callback-only" || disp?.value === "consultation") {
    return disp.value;
  }
  return fallback;
}

function gateFor(strategy: ResolvedStrategy): "emergency" | "none" {
  const gate = strategy.get("booking", "gate") as { value?: string } | undefined;
  if (gate?.value === "emergency") return "emergency";
  return "none";
}

export type StrategyAwareBookingFlowProps = {
  strategy: ResolvedStrategy;
  /** Force a specific flow slug (bypasses ranking) — used in Studio
   *  preview + tests. */
  forceFlowSlug?: string;
  /** Called at the final step with the collected payload. */
  onSubmit?: (payload: Record<string, unknown>) => Promise<void> | void;
};

export function StrategyAwareBookingFlow({
  strategy,
  forceFlowSlug,
  onSubmit
}: StrategyAwareBookingFlowProps) {
  let flow: FrozenBookingManifest | undefined;
  if (forceFlowSlug) {
    flow = bookingRegistry.get(forceFlowSlug);
  } else {
    flow = bookingRegistry.recommend(strategy);
  }

  if (!flow) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-[13px] text-amber-900">
        No booking flow matched this strategy. Try
        <code className="mx-1 rounded bg-white px-1 py-0.5">forceFlowSlug=&quot;quote-only&quot;</code>
        as a fallback.
      </div>
    );
  }

  const Renderer = flow.renderer;
  const primaryCtaLabel = ctaLabelFor(strategy, "Confirm booking");
  const services = servicesFor(strategy, strategy.inputs.profile.primaryServices);
  const depositPolicy = depositPolicyFor(strategy);
  const availabilityDisplay = availabilityDisplayFor(
    strategy,
    flow.requiresCalendarSync ? "calendar" : "callback-only"
  );
  const gate = gateFor(strategy);

  return (
    <Renderer
      manifest={flow}
      services={services}
      primaryCtaLabel={primaryCtaLabel}
      depositPolicy={depositPolicy}
      availabilityDisplay={availabilityDisplay}
      gate={gate}
      onSubmit={onSubmit ?? (() => Promise.resolve())}
    />
  );
}
