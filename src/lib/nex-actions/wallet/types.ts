// NEX Sparks Wallet · type contracts · F2 (2026-08-25).
//
// The wallet is server-authoritative. Every function in this layer either
// reads from nex.user_wallet + nex.wallet_transaction, or writes through the
// SQL functions installed by migration 102 (wallet_reserve_spend,
// wallet_commit_spend, wallet_refund_spend, wallet_grant_sparks,
// wallet_record_purchase). The client cannot bypass these.

export type SparksAmount = number & { readonly __brand: "SparksAmount" };
export function toSparks(n: number): SparksAmount {
  if (!Number.isInteger(n)) throw new Error(`Sparks must be integer (got ${n})`);
  if (n < 0) throw new Error(`Sparks amount cannot be negative (got ${n})`);
  return n as SparksAmount;
}

// ── Balance snapshot returned by getBalance() ───────────────────────────
export type SparksBalance = {
  userId: string;
  balance: SparksAmount;
  lifetimeGranted: SparksAmount;
  lifetimePurchased: SparksAmount;
  lifetimeSpent: SparksAmount;
  createdAt: Date;
  updatedAt: Date;
};

// ── Transaction ledger row ──────────────────────────────────────────────
export type WalletTransactionKind =
  | "signup_grant"
  | "promotion_grant"
  | "admin_adjustment"
  | "purchase"
  | "spend_reserved"
  | "spend_committed"
  | "spend_refunded";

export type WalletTransaction = {
  transactionId: string;
  userId: string;
  kind: WalletTransactionKind;
  deltaSparks: number;               // signed
  idempotencyKey: string;
  relatedTransactionId?: string;
  actionId?: string;                 // linked NexAction.id when applicable
  purchaseRef?: string;              // Stripe session/payment id
  operatorId?: string;               // admin who authored an adjustment
  note?: string;
  balanceAfter: SparksAmount;
  createdAt: Date;
};

// ── Reservation handle · returned by reserveSpend() ─────────────────────
// The runtime holds this between reserve → commit/refund.
export type SparksReservation = {
  reservationId: string;
  userId: string;
  actionId: string;
  amount: SparksAmount;
  balanceAfter: SparksAmount;
  idempotencyKey: string;
  idempotentHit: boolean;            // true if the reservation was already recorded
  createdAt: Date;
};

// ── Errors · translated into NexActionError by the runtime adapter ─────
export class WalletError extends Error {
  constructor(
    public readonly code:
      | "insufficient-sparks"
      | "wallet-not-found"
      | "invalid-amount"
      | "invalid-kind"
      | "reservation-not-found"
      | "db-error",
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WalletError";
  }
}

// ── Grant sources · what the wallet library exposes to the app ─────────
export type GrantSource = "signup_grant" | "promotion_grant" | "admin_adjustment";

// ── Purchase record · returned after a Stripe purchase is credited ─────
export type PurchaseCredit = {
  userId: string;
  amount: SparksAmount;
  purchaseRef: string;
  balanceAfter: SparksAmount;
  createdAt: Date;
};
