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

// ─── Registry ──────────────────────────────────────

class ProcessorRegistry {
  private processors = new Map<string, PaymentProcessor>();
  register(p: PaymentProcessor) {
    this.processors.set(p.providerId, p);
  }
  get(providerId: string): PaymentProcessor | undefined {
    return this.processors.get(providerId);
  }
  list(): PaymentProcessor[] {
    return Array.from(this.processors.values());
  }
}

export const paymentProcessors = new ProcessorRegistry();

/** Utility for providers that fail to authenticate — returns the
 *  standardised error shape so the API returns a clean 4xx. */
export function credentialsMissing(reason: string): PaymentSessionResult {
  return { kind: "error", error: `Credentials missing: ${reason}` };
}
