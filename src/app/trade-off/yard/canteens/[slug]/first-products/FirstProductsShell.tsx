"use client";

// First-products form — 3 tiny product cards. Name + price required,
// image URL optional. Submits each row that has both required fields
// to /api/canteens/[slug]/products/create in sequence. Empty rows are
// skipped silently. Any successful insert lands the product in Trade
// Center automatically (show_in_trade_center defaults to true).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { BRAND_YELLOW, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

type Row = { name: string; priceGbp: string; imageUrl: string; state: "idle" | "ok" | "err" };

const EMPTY: Row = { name: "", priceGbp: "", imageUrl: "", state: "idle" };

export function FirstProductsShell({ slug }: { slug: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY }, { ...EMPTY }, { ...EMPTY }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch, state: "idle" } : r)));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const toSubmit = rows
      .map((r, i) => ({ i, r }))
      .filter(({ r }) => r.name.trim().length >= 3 && Number(r.priceGbp) > 0);

    if (toSubmit.length === 0) {
      // Nothing to send — just go through to the canteen.
      router.push(`/trade-off/yard/canteens/${encodeURIComponent(slug)}?welcome=1`);
      return;
    }

    let anyFailed = false;
    for (const { i, r } of toSubmit) {
      try {
        const res = await fetch(`/api/canteens/${encodeURIComponent(slug)}/products/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: r.name.trim(),
            priceGbp: Number(r.priceGbp),
            imageUrl: r.imageUrl.trim() || undefined
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          anyFailed = true;
          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, state: "err" } : row)));
          if (data.error === "not-authenticated") {
            setError("You've been signed out — sign in and try again.");
            setSubmitting(false);
            return;
          }
        } else {
          setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, state: "ok" } : row)));
        }
      } catch {
        anyFailed = true;
        setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, state: "err" } : row)));
      }
    }

    if (anyFailed) {
      setError("Some rows didn't save. Fix them or skip — the ones marked ✓ are already live.");
      setSubmitting(false);
      return;
    }

    router.push(`/trade-off/yard/canteens/${encodeURIComponent(slug)}?welcome=1`);
  }

  const filledCount = rows.filter(
    (r) => r.name.trim().length >= 3 && Number(r.priceGbp) > 0
  ).length;

  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="mb-2 flex items-center gap-2">
        <span className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRAND_YELLOW }} aria-hidden/>
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Step 2 of 2 · Your first products
        </span>
      </div>
      <h1 className="text-[24px] font-black leading-tight text-neutral-900 sm:text-[30px]">
        Add 3 things you sell. You can flesh them out later.
      </h1>
      <p className="mt-1.5 max-w-xl text-[13px] leading-snug text-neutral-600 sm:text-[14px]">
        Just a name and price. Anything you add here shows on your canteen and in Trade Center right away. Skip if you'd rather set up first.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {rows.map((row, i) => (
          <div
            key={i}
            className="rounded-2xl border bg-white p-4 shadow-sm"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-neutral-900"
                style={{ backgroundColor: "#FEF3C7" }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="grid gap-3 sm:grid-cols-[1fr,120px]">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
                      Product name
                    </label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => update(i, { name: e.target.value.slice(0, 160) })}
                      placeholder="e.g. 25kg bag of building sand"
                      className="w-full rounded-lg border bg-white p-2.5 text-[13.5px] font-bold text-neutral-900 shadow-sm focus:border-yellow-400 focus:outline-none"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
                      Price £
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      value={row.priceGbp}
                      onChange={(e) => update(i, { priceGbp: e.target.value })}
                      placeholder="0"
                      className="w-full rounded-lg border bg-white p-2.5 text-[13.5px] font-bold text-neutral-900 shadow-sm focus:border-yellow-400 focus:outline-none"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    Image URL <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="url"
                    value={row.imageUrl}
                    onChange={(e) => update(i, { imageUrl: e.target.value })}
                    placeholder="https://…"
                    className="w-full rounded-lg border bg-white p-2.5 text-[12.5px] text-neutral-800 shadow-sm focus:border-yellow-400 focus:outline-none"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  />
                </div>
              </div>
              {row.state === "ok" && (
                <CheckCircle2 size={18} strokeWidth={2.4} className="mt-1 shrink-0" style={{ color: BRAND_GREEN_DARK }}/>
              )}
              {row.state === "err" && (
                <AlertCircle size={18} strokeWidth={2.4} className="mt-1 shrink-0 text-red-600"/>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          <AlertCircle size={13} strokeWidth={2.5}/>
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: BRAND_YELLOW }}
        >
          <Send size={13} strokeWidth={2.5}/>
          {submitting
            ? "Saving…"
            : filledCount > 0
              ? `Save ${filledCount} & continue`
              : "Continue"}
        </button>
        <Link
          href={`/trade-off/yard/canteens/${encodeURIComponent(slug)}?welcome=1`}
          className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-neutral-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700"
        >
          Skip for now
          <ArrowRight size={12} strokeWidth={2.5}/>
        </Link>
      </div>

      <p className="mt-3 text-[11px] text-neutral-500">
        Each product you add lands in Trade Center automatically. You can hide any of them from Trade Center in Manage → Products later.
      </p>
    </section>
  );
}
