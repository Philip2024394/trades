// Orders App — shared types.

export type OrderStatus =
  | "placed"
  | "accepted"
  | "preparing"
  | "dispatched"
  | "delivered"
  | "cancelled";

// ─── Trade Center Guaranteed (escrow) ─────────────────────────────────
// Constitution Rule #6: Trade Center never holds funds. The funds sit
// with the regulated payment provider (Stripe Connect delayed payout OR
// Shieldpay escrow) throughout. Trade Center is the arbitrator + the
// orchestrator, never the counterparty.

export type EscrowProvider = "stripe-connect-delayed-payout" | "shieldpay-escrow";

export type EscrowStatus =
  | "not-guaranteed"      // order under threshold or opted out
  | "funds-held"          // buyer paid, funds in partner's safeguarding account
  | "release-scheduled"   // buyer confirmed delivery, N-day auto-release timer running
  | "released"            // funds released to merchant
  | "disputed"            // dispute open, funds held pending arbitration
  | "refunded";           // arbitration ruled for buyer

export type DisputeCase = {
  raisedByRole: "buyer" | "merchant";
  raisedAtIso: string;
  reason: string;
  buyerStatement?: string;
  merchantStatement?: string;
  status: "under-review" | "resolved-buyer" | "resolved-merchant" | "split";
  resolvedAtIso?: string;
  arbitrationNotes?: string;
};

export type EscrowDetails = {
  status: EscrowStatus;
  provider: EscrowProvider;
  fundsHeldGbp: number;
  fundsHeldAtIso?: string;
  deliveryConfirmedAtIso?: string;
  autoReleaseAtIso?: string;   // usually 14 days after delivery confirm
  releasedAtIso?: string;
  refundedAtIso?: string;
  dispute?: DisputeCase;
};

export type Order = {
  id: string;
  merchantSlug: string;
  status: OrderStatus;
  placedAt: number;
  requestedDeliveryAt?: number;
  confirmedDeliveryAt?: number;
  itemCount: number;
  subtotalGbp: number;
  deliveryGbp: number;
  totalGbp: number;
  itemsSummary: string;
  trackingRef?: string;
  /** Trade Center Guaranteed — attached when the order qualifies for
   *  escrow (see GUARANTEE_THRESHOLD_GBP). Absent for small orders. */
  escrow?: EscrowDetails;
};

/** Orders at or above this threshold automatically get Trade Center
 *  Guaranteed via Stripe Connect delayed payout. Below this, standard
 *  Stripe checkout applies and merchant refunds directly on dispute. */
export const GUARANTEE_THRESHOLD_GBP = 100;

/** Orders above this threshold route through Shieldpay full escrow
 *  instead of Stripe delayed payout — reflects the higher-value + more
 *  complex documentation trail Shieldpay is built for. */
export const SHIELDPAY_ESCROW_THRESHOLD_GBP = 5000;

export function escrowProviderFor(totalGbp: number): EscrowProvider | undefined {
  if (totalGbp < GUARANTEE_THRESHOLD_GBP) return undefined;
  if (totalGbp >= SHIELDPAY_ESCROW_THRESHOLD_GBP) return "shieldpay-escrow";
  return "stripe-connect-delayed-payout";
}
