"use client";

// WalletChip — always-visible washer balance in the AppShell header.
//
// Design references:
//   • Apple Wallet — flat card, big number, minimal chrome
//   • Cash App    — bold single-number hero on a coloured surface
//   • Stripe balance chip — click reveals recent activity
//   • Revolut     — subtle gradient card + transaction list
//
// The chip is unobtrusive (1 icon + balance). Click opens a
// popover with:
//   • Hero card: big washer balance + £ equivalent + subtitle
//   • Buy pack CTAs (small · medium · large)
//   • Last 5 transactions with icons + colours
//   • Footer link to the full washer bag admin page
//
// Balance polls every 30s while the popover is open so a boost or
// pack purchase reflects immediately. Otherwise fetched once on mount.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Radio,
  Rocket,
  Plus,
  Gift,
  ArrowUpRight,
  Loader2,
  Sparkles
} from "lucide-react";

type Tx = {
  id:           string;
  kind:         "grant" | "deduct" | "purchase" | "refund" | "idempotent-skip";
  delta:        number;
  balanceAfter: number;
  source:       string;
  createdAt:    string;
  detail:       Record<string, unknown> | null;
};

const YELLOW = "#FFB300";
const BLACK  = "#0A0A0A";
const CREAM  = "#FBF6EC";

// Cash-equivalent floor per washer at the best-value large pack
// (£49.99 / 1000 washers ≈ £0.05). Displayed as a subtle reassurance
// next to the balance so merchants know what they're holding.
const PENCE_PER_WASHER = 5;

export function WalletChip({
  ownerSlug,
  fullWalletHref
}: {
  ownerSlug:      string | null;
  fullWalletHref: string;
}) {
  const [open, setOpen]           = useState(false);
  const [balance, setBalance]     = useState<number | null>(null);
  const [txs, setTxs]             = useState<Tx[]>([]);
  const [loading, setLoading]     = useState(false);
  const popRef                    = useRef<HTMLDivElement>(null);

  // Poll balance on mount + every 30s while open.
  useEffect(() => {
    let cancelled = false;
    async function fetchBalance() {
      try {
        const res = await fetch("/api/washers/balance");
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) setBalance(Number(d?.balance ?? 0));
      } catch { /* silent */ }
    }
    fetchBalance();
    const id = open ? setInterval(fetchBalance, 30_000) : null;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [open]);

  // Load recent transactions when the popover opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/washers/history?limit=5");
        if (!res.ok) return;
        const d = await res.json();
        if (!cancelled) setTxs((d?.transactions ?? []) as Tx[]);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Click-outside close.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!ownerSlug) return null;

  const displayBalance = balance ?? 0;
  const gbpEquiv       = ((displayBalance * PENCE_PER_WASHER) / 100).toFixed(2);

  return (
    <div className="relative" ref={popRef}>
      {/* Chip — small, unobtrusive. Yellow circle + tabular balance
          so it always reads as "wallet" at a glance. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Washer wallet · ${displayBalance} washers`}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-[11.5px] font-black tabular-nums text-neutral-900 shadow-sm transition hover:brightness-105 active:scale-[0.97]"
        style={{ backgroundColor: YELLOW }}
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: BLACK, color: YELLOW }}
        >
          <span className="text-[9px] font-black tracking-wider">W</span>
        </span>
        {balance === null ? "—" : displayBalance.toLocaleString("en-GB")}
      </button>

      {/* Popover — flat card, minimal chrome, big number, list below.
          Position: absolute below the chip, right-anchored so it doesn't
          spill off-screen on narrow desktop windows. */}
      {open && (
        <div
          role="dialog"
          aria-label="Washer wallet"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border bg-white shadow-2xl md:w-96"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          {/* Hero — brand yellow surface, big tabular number */}
          <div
            className="relative overflow-hidden px-5 py-5"
            style={{
              background: `linear-gradient(135deg, ${YELLOW} 0%, #FF9E00 100%)`,
              color: BLACK
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">
                Wallet
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-70 tabular-nums">
                ≈ £{gbpEquiv}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[42px] font-black leading-none tracking-tight tabular-nums">
                {displayBalance.toLocaleString("en-GB")}
              </span>
              <span className="text-[12px] font-black uppercase tracking-widest opacity-70">washers</span>
            </div>
            <p className="mt-2 text-[10.5px] font-bold opacity-80">
              Spend on leads, boosts, features and priority — no card swipe.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Link
                href={fullWalletHref}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-[11.5px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: BLACK }}
              >
                <Plus size={13} strokeWidth={2.8}/>
                Top up
              </Link>
              <Link
                href={fullWalletHref}
                className="inline-flex h-9 items-center gap-0.5 rounded-lg px-3 text-[11.5px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "rgba(0,0,0,0.08)", color: BLACK }}
              >
                History
                <ArrowUpRight size={12} strokeWidth={2.6}/>
              </Link>
            </div>
          </div>

          {/* Recent activity — clean list with kind icons + delta colours */}
          <div className="px-1 py-1" style={{ backgroundColor: CREAM }}>
            <p className="px-3 pb-1 pt-2 text-[9.5px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Recent activity
            </p>
            {loading && !txs.length ? (
              <div className="flex items-center justify-center py-6 text-neutral-400">
                <Loader2 size={14} className="animate-spin"/>
              </div>
            ) : txs.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <Sparkles size={14} className="mx-auto text-neutral-400"/>
                <p className="mt-1 text-[10.5px] text-neutral-500">
                  No activity yet. Your first lead or boost lands here.
                </p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                {txs.map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5 px-3 py-2">
                    <TxIcon kind={t.kind} source={t.source}/>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-black text-neutral-900">
                        {txLabel(t)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-500 tabular-nums">
                        {shortAgo(t.createdAt)}
                      </p>
                    </div>
                    <span
                      className="flex-shrink-0 text-[12px] font-black tabular-nums"
                      style={{ color: t.delta > 0 ? "#166534" : t.delta < 0 ? "#B91C1C" : "#6B7280" }}
                    >
                      {t.delta > 0 ? "+" : ""}{t.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TxIcon({ kind, source }: { kind: Tx["kind"]; source: string }) {
  const cls = "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full";
  if (kind === "grant") {
    return <span className={cls} style={{ backgroundColor: "#DCFCE7", color: "#166534" }}><Gift size={13} strokeWidth={2.4}/></span>;
  }
  if (kind === "purchase") {
    return <span className={cls} style={{ backgroundColor: "#FEF3C7", color: "#7A4E00" }}><Plus size={13} strokeWidth={2.6}/></span>;
  }
  if (kind === "refund") {
    return <span className={cls} style={{ backgroundColor: "#DBEAFE", color: "#1E40AF" }}><ArrowUpRight size={13} strokeWidth={2.4}/></span>;
  }
  // deduct — differentiate by source
  if (source === "counter-boost") {
    return <span className={cls} style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}><Rocket size={13} strokeWidth={2.4}/></span>;
  }
  return <span className={cls} style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}><Radio size={13} strokeWidth={2.4}/></span>;
}

function txLabel(t: Tx): string {
  if (t.kind === "grant")             return "Signup bonus";
  if (t.kind === "purchase")          return "Pack purchased";
  if (t.kind === "refund")            return "Refund";
  if (t.kind === "idempotent-skip")   return "Duplicate contact (skipped)";
  // deduct
  if (t.source === "counter-boost") {
    const duration = (t.detail?.duration as string | undefined) ?? "";
    return duration ? `Boost · ${duration}` : "Counter boost";
  }
  return "WhatsApp lead";
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return "now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}
