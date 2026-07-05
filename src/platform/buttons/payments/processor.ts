// Payment processor contract — every provider implements this shape.
//
// Callers hit /api/pay/session with a provider-agnostic payload;
// the orchestrator loads the provider's config from
// studio_payment_providers, resolves the processor, and calls
// `createSession`. Return value is a checkout URL the client redirects
// to (or `handoff` details for post-paid methods like COD).
//
// Webhooks land at /api/pay/webhook/[providerId]; the orchestrator
// calls `verifyAndParseWebhook` which returns the normalised order
// state we persist to studio_payment_orders.
//
// ─────────────────────────────────────────────────────────────────
// Migration note (Milestone 1, registryKit reference migration):
// The registry now composes over `createRegistry` from registryKit
// so it inherits `.search()`, `.describe()`, `.selfCheck()`, alias
// resolution, and telemetry for free — without breaking any of the
// 20+ existing processor files that call
// `paymentProcessors.register(processor)` with only the raw
// PaymentProcessor shape.
//
// The facade at `.register()` normalises a raw PaymentProcessor into
// a full PaymentProcessorRegistration by deriving id/name/description/
// category from providerId. Existing consumers see the same public
// surface; new processors can pass an enriched registration if they
// want proper marketplace metadata + search keywords.

import { createRegistry } from "@/platform/registryKit";
import type { RegistrationBase } from "@/platform/registryKit";

export type PaymentSessionRequest = {
  brandId: string;
  amountMinor: number; // cents / paise / rupiah smallest unit
  currency: string;
  orderRef: string;
  description?: string;
  customerEmail?: string;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
};

export type PaymentSessionResult =
  | {
      kind: "redirect";
      /** Where the client's browser should navigate to. */
      checkoutUrl: string;
      /** Provider's own session/order id — stored on the order row. */
      externalRef: string;
    }
  | {
      kind: "handoff";
      /** For COD / bank transfer — provider has no online checkout.
       *  UI shows instructions instead of redirecting. */
      instructions: string;
      externalRef: string;
    }
  | {
      kind: "not-implemented";
      /** Fallback so buttons degrade to their href. */
      reason: string;
    }
  | {
      kind: "error";
      error: string;
    };

export type WebhookResult =
  | {
      kind: "update";
      externalRef: string;
      status: "paid" | "failed" | "cancelled" | "refunded" | "pending";
      metadata?: Record<string, unknown>;
    }
  | {
      kind: "ignore";
      reason: string;
    }
  | {
      kind: "error";
      error: string;
    };

export type PaymentProcessor = {
  providerId: string;
  createSession: (
    request: PaymentSessionRequest,
    credentials: Record<string, unknown>
  ) => Promise<PaymentSessionResult>;
  /** Providers may not have webhooks (COD, bank transfer). Optional. */
  verifyAndParseWebhook?: (
    rawBody: string,
    headers: Headers,
    credentials: Record<string, unknown>
  ) => Promise<WebhookResult>;
};

/** Enriched form — RegistrationBase fields merged onto PaymentProcessor.
 *  New processor files SHOULD ship this shape so marketplace + AI SDK
 *  surfaces render properly. Existing files can keep passing raw
 *  PaymentProcessor and the registry facade fills sensible defaults. */
export type PaymentProcessorRegistration = PaymentProcessor & RegistrationBase;

// ─── Registry ──────────────────────────────────────
//
// Underlying store is the registryKit factory. Public API preserves
// the historic `.register / .get / .list` surface plus everything the
// factory adds (`.search`, `.describe`, `.selfCheck`, etc.).

const inner = createRegistry<PaymentProcessorRegistration>({
  label: "paymentProcessors",
  idFormat: "slug"
});

function normalise(
  input: PaymentProcessor | PaymentProcessorRegistration
): PaymentProcessorRegistration {
  const asBase = input as Partial<PaymentProcessorRegistration>;
  const id = asBase.id ?? input.providerId;
  return {
    ...input,
    id,
    version: asBase.version ?? "1.0.0",
    name: asBase.name ?? deriveName(id),
    description:
      asBase.description ?? `Payment processor adapter for ${deriveName(id)}.`,
    category: asBase.category ?? "payment_processor",
    searchKeywords: asBase.searchKeywords,
    aliases: asBase.aliases,
    marketplace: asBase.marketplace,
    deprecation: asBase.deprecation
  };
}

function deriveName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export const paymentProcessors = {
  register(p: PaymentProcessor | PaymentProcessorRegistration): void {
    inner.register(normalise(p));
  },
  get(providerId: string): PaymentProcessorRegistration | undefined {
    return inner.get(providerId);
  },
  list(): PaymentProcessorRegistration[] {
    return inner.list();
  },
  has(providerId: string): boolean {
    return inner.has(providerId);
  },
  search(query: string, limit?: number): PaymentProcessorRegistration[] {
    return inner.search(query, limit);
  },
  describe(providerId: string): string {
    return inner.describe(providerId);
  },
  selfCheck(): { warnings: string[]; errors: string[] } {
    return inner.selfCheck();
  }
};

/** Utility for providers that fail to authenticate — returns the
 *  standardised error shape so the API returns a clean 4xx. */
export function credentialsMissing(reason: string): PaymentSessionResult {
  return { kind: "error", error: `Credentials missing: ${reason}` };
}
