"use client";

// CounterComposerModal — owner-only "Post to The Counter" dialog.
//
// Rendered from any canteen surface where the host clicks the yellow
// "+ Post" pill. Client-side pre-validation (canteen-name warning,
// character counts) reduces server round-trips; the server does the
// authoritative validation before insert.
//
// If the server returns 423 counter-banned, we render a live countdown
// so the user knows exactly when they can post again.

import { useEffect, useState } from "react";
import { X, Send, Loader2, AlertTriangle, Info, Rocket, Circle } from "lucide-react";
import Link from "next/link";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

type Kind = "counter" | "make-offer" | "wanted";

// Boost pricing — mirrors DURATION_WASHERS in /api/counter/boost.
// Kept in sync manually until we extract to a shared constants file.
type BoostDuration = "none" | "24h" | "7d" | "30d";
const BOOST_COST: Record<BoostDuration, number> = { none: 0, "24h": 10, "7d": 50, "30d": 200 };
const BOOST_GBP:  Record<BoostDuration, string> = { none: "£0", "24h": "≈£0.50", "7d": "≈£2.50", "30d": "≈£10" };

export function CounterComposerModal({
  open,
  onClose,
  onPosted
}: {
  open:    boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [kind, setKind]     = useState<Kind>("counter");
  const [title, setTitle]   = useState("");
  const [body, setBody]     = useState("");
  const [price, setPrice]   = useState<string>("");
  const [boost, setBoost]   = useState<BoostDuration>("none");
  const [ack, setAck]       = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);
  const [remaining, setRemaining]     = useState<string>("");
  const [washerBalance, setWasherBalance] = useState<number | null>(null);

  // Load the merchant's washer balance once the modal opens — used to
  // show "you have N washers" alongside the boost picker so the choice
  // is informed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/washers/balance")
      .then((r) => r.ok ? r.json() : { balance: 0 })
      .then((d) => { if (!cancelled) setWasherBalance(Number(d?.balance ?? 0)); })
      .catch(() => { if (!cancelled) setWasherBalance(0); });
    return () => { cancelled = true; };
  }, [open]);

  // Countdown ticker for a banned poster.
  useEffect(() => {
    if (!bannedUntil) return;
    function tick() {
      const ms = new Date(bannedUntil as string).getTime() - Date.now();
      if (ms <= 0) { setBannedUntil(null); setRemaining(""); return; }
      const h = Math.floor(ms / 3600_000);
      const m = Math.floor((ms % 3600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bannedUntil]);

  if (!open) return null;

  async function submit() {
    if (!ack || busy) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/counter/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title, body, kind,
          priceGbp: price.trim() ? Number(price) : undefined
        })
      });
      const data = await res.json();
      if (res.status === 423 && data.bannedUntil) {
        setBannedUntil(data.bannedUntil);
        setError(data.reason ?? "You're temporarily paused from posting to The Counter.");
        return;
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Post failed");
        if (data.banned && data.ruleId) {
          // Server applied a ban on this attempt — fetch the ban timer.
          setBannedUntil(new Date(Date.now() + 72 * 3600_000).toISOString());
        }
        return;
      }

      // Optional boost — chained call after successful post creation.
      // Silent failure surfaces as a toast-style error but the post
      // stays live; merchant can boost later from their dashboard.
      if (boost !== "none" && data.id) {
        try {
          const boostRes = await fetch("/api/counter/boost", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ postId: data.id, duration: boost })
          });
          const boostData = await boostRes.json();
          if (!boostRes.ok && boostData?.error === "insufficient-washers") {
            setError(`Post published — but boost skipped: you need ${boostData.required} washers (have ${boostData.balance}). Top up in your washer bag.`);
            // Don't close on partial success — let the merchant see the message.
            return;
          }
        } catch { /* boost silently skipped; post is still live */ }
      }

      // Success — reset + close.
      setTitle(""); setBody(""); setPrice(""); setBoost("none"); setAck(false);
      onPosted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  const titleCount = title.trim().length;
  const bodyCount  = body.trim().length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 md:items-center"
      style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: BRAND_YELLOW }}/>
            <h2 className="text-[14px] font-black text-neutral-900">Post to The Counter</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Close">
            <X size={16}/>
          </button>
        </div>

        {/* Banned banner */}
        {bannedUntil && (
          <div className="border-b bg-red-50 p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-red-700"/>
              <div className="min-w-0 flex-1 text-[11.5px]">
                <p className="font-black text-red-900">Posting paused for {remaining}</p>
                <p className="mt-0.5 text-red-800">{error}</p>
                <Link href="/counter/terms" className="mt-1 inline-block text-[10.5px] font-black uppercase tracking-wider text-red-900 underline">
                  Read the terms
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          {/* Kind selector */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <KindPill label="For sale"        active={kind === "counter"}    onClick={() => setKind("counter")}/>
            <KindPill label="Make me an offer" active={kind === "make-offer"} onClick={() => setKind("make-offer")}/>
            <KindPill label="Wanted"          active={kind === "wanted"}     onClick={() => setKind("wanted")}/>
          </div>

          {/* Title */}
          <label className="mt-2 block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Festool TS55 track saw — mint condition"
              maxLength={120}
              className="mt-1 h-10 w-full rounded-lg border bg-neutral-50 px-3 text-[13px] outline-none focus:bg-white"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
              disabled={busy}
            />
            <div className="mt-0.5 flex justify-between text-[9.5px] text-neutral-400">
              <span>6-120 characters. No canteen names.</span>
              <span className="tabular-nums">{titleCount}/120</span>
            </div>
          </label>

          {/* Body */}
          <label className="mt-3 block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Description</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What is it, condition, accessories, collection location, contact preference…"
              maxLength={1200}
              rows={5}
              className="mt-1 w-full rounded-lg border bg-neutral-50 px-3 py-2 text-[13px] outline-none focus:bg-white"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
              disabled={busy}
            />
            <div className="mt-0.5 flex justify-between text-[9.5px] text-neutral-400">
              <span>20-1200 characters. Construction / trade products + services only.</span>
              <span className="tabular-nums">{bodyCount}/1200</span>
            </div>
          </label>

          {/* Price / Budget (optional) — label follows kind. Wanted =
              max budget the buyer is willing to pay; other kinds = price
              or asking. */}
          <label className="mt-3 block">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              {kind === "wanted" ? "Budget" : "Price"} · GBP
              {kind === "make-offer" && <span className="ml-1 normal-case text-neutral-400">(asking)</span>}
              {kind === "wanted"     && <span className="ml-1 normal-case text-neutral-400">(max)</span>}
            </span>
            <input
              type="number" min={0} step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="120"
              className="mt-1 h-10 w-40 rounded-lg border bg-neutral-50 px-3 text-[13px] outline-none focus:bg-white"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
              disabled={busy}
            />
          </label>

          {/* Boost picker — optional. Spends washers to float this
              listing above organic posts on The Counter. Zero card
              swipe (Philip 2026-07-20 unified-wallet strategy). */}
          <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5">
                <Rocket size={13} className="text-neutral-700"/>
                <span className="text-[10.5px] font-black uppercase tracking-[0.16em] text-neutral-700">
                  Boost this listing
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 tabular-nums">
                Wallet: {washerBalance ?? "—"} washers
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <BoostPill label="None"      cost="Free"                active={boost === "none"} onClick={() => setBoost("none")}/>
              <BoostPill label="24 hours"  cost={`${BOOST_COST["24h"]} · ${BOOST_GBP["24h"]}`}  active={boost === "24h"}  onClick={() => setBoost("24h")}/>
              <BoostPill label="7 days"    cost={`${BOOST_COST["7d"]} · ${BOOST_GBP["7d"]}`}    active={boost === "7d"}   onClick={() => setBoost("7d")}/>
              <BoostPill label="30 days"   cost={`${BOOST_COST["30d"]} · ${BOOST_GBP["30d"]}`}  active={boost === "30d"}  onClick={() => setBoost("30d")}/>
            </div>
            {boost !== "none" && washerBalance !== null && washerBalance < BOOST_COST[boost] && (
              <p className="mt-2 text-[10.5px] font-bold text-red-700">
                Not enough washers ({washerBalance} of {BOOST_COST[boost]}). Boost will skip; post still publishes.{" "}
                <Link href="/washers" className="underline">Top up →</Link>
              </p>
            )}
          </div>

          {/* Terms */}
          <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
            <div className="flex items-start gap-2">
              <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-700"/>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-neutral-900">Rules of The Counter</p>
                <ul className="mt-1 space-y-0.5 text-[10.5px] leading-snug text-neutral-700">
                  <li>· No other canteens named in title or body</li>
                  <li>· Construction or trade services / products only</li>
                  <li>· No non-construction images</li>
                  <li>· No canteen banners reposted as listings</li>
                </ul>
                <p className="mt-1 text-[10px] text-neutral-500">
                  Break a rule → 72-hour posting ban.{" "}
                  <Link href="/counter/terms" className="font-black underline">Full terms</Link>
                </p>
              </div>
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-neutral-800">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} disabled={busy}/>
              I've read the rules
            </label>
          </div>

          {error && !bannedUntil && (
            <p className="mt-3 text-[11px] font-bold text-red-700">{error}</p>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button" onClick={onClose} disabled={busy}
              className="h-10 rounded-md border px-3 text-[11.5px] font-black uppercase tracking-wider text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >Cancel</button>
            <button
              type="button"
              onClick={submit}
              disabled={busy || !ack || !!bannedUntil || titleCount < 6 || bodyCount < 20}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-4 text-[11.5px] font-black uppercase tracking-wider shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              {busy ? <Loader2 size={13} className="animate-spin"/> : <Send size={13} strokeWidth={2.6}/>}
              Post to Counter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KindPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-3 py-1 text-[10.5px] font-black uppercase tracking-wider transition"
      style={
        active
          ? { backgroundColor: BRAND_GREEN_DARK, color: "#FFFFFF", borderColor: "transparent" }
          : { backgroundColor: "#E5E7EB",       color: "#4B5563", borderColor: "transparent" }
      }
    >
      {label}
    </button>
  );
}

function BoostPill({ label, cost, active, onClick }: { label: string; cost: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-center justify-center gap-0.5 rounded-md border px-2 py-1.5 transition"
      style={
        active
          ? { backgroundColor: BRAND_GREEN_DARK, color: "#FFFFFF", borderColor: "transparent" }
          : { backgroundColor: "#E5E7EB",       color: "#4B5563", borderColor: "transparent" }
      }
    >
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      <span className="text-[9px] tabular-nums opacity-80">{cost}</span>
    </button>
  );
}
