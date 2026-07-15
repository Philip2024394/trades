"use client";

// Merchant washer-bag dashboard. Balance widget + pack purchase +
// auto-topup toggle + recent activity strip.
//
// All state is currently client-mocked — no DB, no Stripe wiring yet.
// The "Buy pack" and "Toggle auto-topup" actions optimistically update
// UI state and log the intent to console with a clear TODO(backend)
// marker so the flow can be walked through end-to-end while the
// backend catches up.

import Link from "next/link";
import { useState } from "react";
import {
  Circle,
  ShoppingBag,
  Zap,
  AlertTriangle,
  Info,
  ArrowLeft,
  CheckCircle2,
  MinusCircle,
  Gift,
  RefreshCw,
  Flag,
  X
} from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

type Pack = {
  id: "small" | "medium" | "large";
  washers: number;
  priceGbp: number;
  perLeadPence: number;
  label: string;
  featured?: boolean;
};

const PACKS: Pack[] = [
  { id: "small",  washers: 50,   priceGbp: 4.99,  perLeadPence: 10,  label: "Starter bag" },
  { id: "medium", washers: 200,  priceGbp: 14.99, perLeadPence: 7.5, label: "Site bag", featured: true },
  { id: "large",  washers: 1000, priceGbp: 49.99, perLeadPence: 5,   label: "Trade bag" }
];

// Real transaction rows arrive from src/app/trade-off/edit/[slug]/washers/page.tsx
// which server-loads them via lib/washers.ts. Shape is defined on the
// prop below.

type TxRow = {
  id: string;
  kind: "grant" | "deduct" | "purchase" | "refund";
  delta: number;
  label: string;
  source: string;
  createdAt: string;
};

export function WashersShell({
  slug,
  initialBalance,
  initialAutoTopup,
  transactions,
  backendReady
}: {
  slug: string;
  initialBalance: number;
  initialAutoTopup: boolean;
  transactions: TxRow[];
  backendReady: boolean;
}) {
  const [balance, setBalance] = useState(initialBalance);
  const [autoTopUp, setAutoTopUp] = useState(initialAutoTopup);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  // Spam-flag state — which tx is being flagged, the reason draft,
  // submission status, and the set of already-flagged tx ids (so the
  // Flag button doesn't re-open on rows we've already reported).
  const [flaggingTxId, setFlaggingTxId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  async function submitFlag() {
    if (!flaggingTxId) return;
    const reason = flagReason.trim();
    if (reason.length < 4) {
      setFlagError("Please add a short reason.");
      return;
    }
    setFlagError(null);
    setFlagSubmitting(true);
    try {
      const res = await fetch(`/api/washers/spam-flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: flaggingTxId,
          merchantSlug: slug,
          reason
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFlagError(data.error ?? "Flag failed — please try again.");
        return;
      }
      setFlaggedIds((prev) => new Set(prev).add(flaggingTxId));
      setFlaggingTxId(null);
      setFlagReason("");
    } catch {
      setFlagError("Network error — please try again.");
    } finally {
      setFlagSubmitting(false);
    }
  }

  async function confirmPurchase() {
    if (!selectedPack) return;
    setPurchaseSubmitting(true);
    setPurchaseError(null);
    // TODO(backend): POST /api/washers/purchase → Stripe checkout session
    // for the selected pack. On success, webhook credits the merchant
    // bag with pack.washers and appends a transaction row.
    try {
      await new Promise((r) => setTimeout(r, 700));
      setBalance((b) => b + selectedPack.washers);
      setSelectedPack(null);
    } catch {
      setPurchaseError("Purchase failed — please try again.");
    } finally {
      setPurchaseSubmitting(false);
    }
  }

  const emptyBag = balance <= 0;
  const lowBag = balance > 0 && balance <= 5;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 md:px-6 md:pt-10">
      <div className="mb-6">
        <Link
          href={`/trade-off/edit/${slug}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
          Back to dashboard
        </Link>
      </div>

      {/* Header — copy on the left, decorative washer-bag illustration
          on the right. Illustration is object-contain per the global
          image rule (`feedback_global_images_contain`) and stays hidden
          on the smallest widths so the text is never squeezed. */}
      <header className="mb-6 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Verified WhatsApp leads
          </div>
          <h1
            className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]"
            style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
          >
            Your washer bag
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
            Every verified WhatsApp lead pulls one washer from your bag. Ten free on signup, then top up whenever you like. Washers never expire.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/Untitledsdasdaaabbb-removebg-preview.png"
          alt=""
          aria-hidden
          className="hidden h-24 w-auto flex-shrink-0 object-contain sm:block md:h-32"
          loading="lazy"
        />
      </header>

      {/* Backend-pending banner — shows only when the washer tables
          aren't yet applied to the DB. Once the migration has run for
          this merchant, the loader returns a real bag and this line
          disappears. */}
      {!backendReady && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border-l-4 border-neutral-800 bg-neutral-100 px-3 py-3 text-[12px] leading-snug text-neutral-800 md:px-4">
          <AlertTriangle size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0"/>
          <div>
            <div className="font-black">Washer backend not yet applied for this account.</div>
            <div className="mt-0.5 text-neutral-600">
              You&apos;re viewing the UI on default state. Run the washer migration and reload to see live balance + activity.
            </div>
          </div>
        </div>
      )}

      {/* Empty-bag red banner (loss-aversion nudge) */}
      {emptyBag && backendReady && (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border-l-4 border-red-600 bg-red-50 px-3 py-3 text-[12.5px] leading-snug text-red-900 md:px-4"
        >
          <AlertTriangle size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0"/>
          <div>
            <div className="font-black">Your bag is empty.</div>
            <div className="mt-0.5">
              Buyers can still see your WhatsApp button, but each lead that reaches you now is missed revenue. Top up below to keep taking leads.
            </div>
          </div>
        </div>
      )}
      {lowBag && backendReady && (
        <div
          className="mb-4 flex items-start gap-2 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-3 text-[12.5px] leading-snug text-amber-900 md:px-4"
        >
          <AlertTriangle size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0"/>
          <div>
            <div className="font-black">Only {balance} washer{balance === 1 ? "" : "s"} left.</div>
            <div className="mt-0.5">Top up now so you never miss a lead.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        {/* LEFT — packs + activity */}
        <div className="flex flex-col gap-6">
          {/* Packs */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[16px] font-black text-neutral-900">Refill your bag</h2>
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                Cheaper per lead as the bag grows
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPack(p)}
                  className="relative flex flex-col gap-1 rounded-xl border bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                  style={{ borderColor: p.featured ? BRAND_YELLOW : "rgba(139,69,19,0.15)" }}
                >
                  {p.featured && (
                    <span
                      className="absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] shadow-sm"
                      style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
                    >
                      Best value
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag size={13} strokeWidth={2.4} className="text-neutral-500"/>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                      {p.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[26px] font-black leading-none text-neutral-900">
                      {p.washers}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">washers</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-[15px] font-black" style={{ color: BRAND_GREEN_DARK }}>
                      £{p.priceGbp.toFixed(2)}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-500">
                      {p.perLeadPence < 1 ? "<1p" : `${p.perLeadPence % 1 === 0 ? p.perLeadPence : p.perLeadPence.toFixed(1)}p`} /lead
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <h2 className="mb-3 text-[16px] font-black text-neutral-900">Recent activity</h2>
            {transactions.length === 0 ? (
              <div
                className="rounded-xl border bg-white p-4 text-[12px] text-neutral-500 shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                No washer activity yet — your first verified WhatsApp lead will show up here.
              </div>
            ) : (
            <ul
              className="divide-y overflow-hidden rounded-xl border bg-white shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              {transactions.map((tx) => {
                const Icon =
                  tx.kind === "deduct"   ? MinusCircle
                  : tx.kind === "purchase" ? ShoppingBag
                  : tx.kind === "refund"   ? RefreshCw
                  : Gift;
                const iconColor =
                  tx.kind === "deduct"   ? "#B45309"
                  : tx.kind === "purchase" ? BRAND_GREEN_DARK
                  : tx.kind === "refund"   ? "#7A5B00"
                  : BRAND_YELLOW;
                return (
                  <li key={tx.id} className="flex items-center gap-3 px-3 py-2.5 md:px-4">
                    <Icon size={16} strokeWidth={2.4} style={{ color: iconColor }} className="flex-shrink-0"/>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-black text-neutral-900">
                        {tx.label}
                      </div>
                      <div className="truncate text-[10.5px] text-neutral-500">
                        {tx.source} · {tx.createdAt}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {tx.kind === "deduct" && (
                        flaggedIds.has(tx.id) ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
                            <Flag size={9} strokeWidth={2.6}/>
                            Flagged
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setFlaggingTxId(tx.id);
                              setFlagReason("");
                              setFlagError(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50"
                            style={{ borderColor: "rgba(139,69,19,0.15)" }}
                            title="Flag as spam"
                          >
                            <Flag size={9} strokeWidth={2.6}/>
                            Flag
                          </button>
                        )
                      )}
                      <div
                        className="text-[13px] font-black tabular-nums"
                        style={{ color: tx.delta >= 0 ? BRAND_GREEN_DARK : "#B45309" }}
                      >
                        {tx.delta >= 0 ? `+${tx.delta}` : tx.delta}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            )}
          </section>
        </div>

        {/* RIGHT — sticky balance widget + auto-topup toggle + explainer */}
        <aside className="flex flex-col gap-4">
          {/* Balance card */}
          <div
            className="rounded-2xl border p-4 shadow-lg"
            style={{
              borderColor: BRAND_YELLOW,
              backgroundColor: BRAND_BLACK,
              color: "#FFFFFF"
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
              <Circle size={10} strokeWidth={2.5} style={{ color: BRAND_YELLOW }}/>
              Bag balance
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className="text-[54px] font-black leading-none tabular-nums"
                style={{ color: BRAND_YELLOW }}
              >
                {balance}
              </span>
              <span className="text-[12px] font-black uppercase tracking-wider text-white/70">
                washers
              </span>
            </div>
            <div className="mt-2 text-[11px] leading-snug text-white/70">
              Enough for {balance} verified WhatsApp lead{balance === 1 ? "" : "s"}. Washers never expire.
            </div>
          </div>

          {/* Auto top-up toggle */}
          <div
            className="rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Zap size={13} strokeWidth={2.4} style={{ color: BRAND_YELLOW }}/>
                  <span className="text-[13px] font-black text-neutral-900">
                    Auto top-up
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
                  Automatically buy a Site bag (200 · £14.99) when your bag drops below 5.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoTopUp}
                onClick={() => {
                  // TODO(backend): PATCH /api/washers/auto-topup with { enabled }
                  setAutoTopUp((v) => !v);
                }}
                className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition"
                style={{ backgroundColor: autoTopUp ? BRAND_GREEN_DARK : "#D4D4D4" }}
              >
                <span
                  className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                  style={{ transform: autoTopUp ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>
            {autoTopUp && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md bg-green-50 px-2 py-1.5 text-[10.5px] font-bold text-green-900">
                <CheckCircle2 size={12} strokeWidth={2.5}/>
                On — you'll never run out mid-week.
              </div>
            )}
          </div>

          {/* How it works */}
          <div
            className="rounded-2xl border bg-white p-4 text-[11.5px] leading-relaxed text-neutral-700 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="mb-1.5 flex items-center gap-1.5">
              <Info size={13} strokeWidth={2.4} className="text-neutral-500"/>
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                How washers work
              </span>
            </div>
            <ul className="flex flex-col gap-1.5 pl-4" style={{ listStyleType: "disc" }}>
              <li>1 washer = 1 verified WhatsApp lead.</li>
              <li>Buyers confirm name + phone + message before your WhatsApp opens.</li>
              <li>Same buyer within 30 days = still 1 washer.</li>
              <li>Fellow trades on the network never burn a washer.</li>
              <li>Spam a washer to the red zone if the lead was bad — refund on approval.</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Flag-as-spam modal — collects the merchant's reason, POSTs
          to /api/washers/spam-flag which writes a row to the red zone
          queue. Admin reviews and either refunds or denies. */}
      {flaggingTxId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Flag lead as spam"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !flagSubmitting) setFlaggingTxId(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                  Request refund
                </div>
                <h3 className="mt-1 text-[19px] font-black leading-tight text-neutral-900">
                  Flag this lead as spam
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFlaggingTxId(null)}
                disabled={flagSubmitting}
                aria-label="Close"
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
              >
                <X size={16} strokeWidth={2.6}/>
              </button>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
              Thenetworkers admin will review your flag and, if approved, refund the washer to your bag. False flags reduce your future refund credibility, so please only flag genuinely bad leads.
            </p>
            <label className="mt-3 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Why is this lead spam?
            </label>
            <textarea
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value.slice(0, 500))}
              placeholder="e.g. Fake name and number, no follow-up on WhatsApp. Looks like a competitor phishing."
              rows={3}
              disabled={flagSubmitting}
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] leading-snug text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            />
            {flagError && (
              <div className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-red-700">
                {flagError}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFlaggingTxId(null)}
                disabled={flagSubmitting}
                className="inline-flex h-9 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 disabled:opacity-50"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitFlag}
                disabled={flagSubmitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "#B45309" }}
              >
                <Flag size={12} strokeWidth={2.6}/>
                {flagSubmitting ? "Submitting…" : "Submit for review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase confirmation modal — sits above the shell */}
      {selectedPack && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm washer purchase"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !purchaseSubmitting) setSelectedPack(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-2xl"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
              Confirm purchase
            </div>
            <h3 className="mt-1 text-[19px] font-black leading-tight text-neutral-900">
              {selectedPack.label} · {selectedPack.washers} washers
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-700">
              Charging <strong>£{selectedPack.priceGbp.toFixed(2)}</strong> to your saved card. Washers land in your bag instantly.
            </p>
            <div className="mt-3 rounded-lg bg-neutral-100 p-2.5 text-[11px] leading-snug text-neutral-700">
              <div><strong>{selectedPack.washers}</strong> verified WhatsApp leads</div>
              <div><strong>{selectedPack.perLeadPence < 1 ? "under 1p" : `${selectedPack.perLeadPence % 1 === 0 ? selectedPack.perLeadPence : selectedPack.perLeadPence.toFixed(1)}p`}</strong> per lead</div>
            </div>
            {purchaseError && (
              <div className="mt-2 text-[11px] font-black uppercase tracking-wider text-red-600">
                {purchaseError}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPack(null)}
                disabled={purchaseSubmitting}
                className="inline-flex h-9 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700 disabled:opacity-50"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPurchase}
                disabled={purchaseSubmitting}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <ShoppingBag size={12} strokeWidth={2.6}/>
                {purchaseSubmitting ? "Charging…" : `Pay £${selectedPack.priceGbp.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
