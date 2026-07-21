"use client";

// CheckQuoteTool — client-side interactive UK trade quote checker.
//
// Runs entirely in the browser (no API call, no quote storage). Uses
// the same TRADE_ROWS + CITY_ROWS data as /price-index — so the tool
// and the data page are always in sync.
//
// Verdict logic:
//   • Compare user's quote to the low-high range for that trade + rate type
//   • Apply the city multiplier to derive the local range
//   • FAIR      = within range
//   • LOW       = below range (unusual — could be a mistake or unlicensed)
//   • HIGH      = up to 20% above the top of range
//   • VERY HIGH = >20% above the top of range

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, CircleCheck, CircleAlert, CircleX, TrendingUp,
  ShieldCheck, Share2, Sparkles, Info
} from "lucide-react";
import { TRADE_ROWS, CITY_ROWS } from "../price-index/config";
import { ResourcesBar } from "@/components/seo/ResourcesBar";

type RateType = "hourly" | "day" | "emergency";
type Verdict  = "fair" | "high" | "very-high" | "low";

const RATE_LABEL: Record<RateType, string> = {
  hourly:    "Hourly rate",
  day:       "Day rate",
  emergency: "Emergency callout"
};

export function CheckQuoteTool() {
  const [tradeSlug, setTradeSlug] = useState<string>("plumber");
  const [citySlug,  setCitySlug]  = useState<string>("london");
  const [rateType,  setRateType]  = useState<RateType>("day");
  const [amount,    setAmount]    = useState<string>("");
  const [submitted, setSubmitted] = useState(false);

  const trade = TRADE_ROWS.find((t) => t.tradeSlug === tradeSlug)!;
  const city  = CITY_ROWS.find((c) => c.citySlug === citySlug)!;

  const range = useMemo(() => {
    if (rateType === "hourly")    return { low: trade.hourlyLow,          high: trade.hourlyHigh };
    if (rateType === "day")       return { low: trade.dayRateLow,         high: trade.dayRateHigh };
    /* emergency */               return { low: trade.emergencyCalloutLow, high: trade.emergencyCalloutHigh };
  }, [trade, rateType]);

  const localRange = useMemo(() => ({
    low:  Math.round(range.low  * city.multiplier),
    high: Math.round(range.high * city.multiplier)
  }), [range, city]);

  const numericAmount = Number(amount);
  const validAmount   = Number.isFinite(numericAmount) && numericAmount > 0;

  const verdict: Verdict | null = useMemo(() => {
    if (!validAmount) return null;
    if (numericAmount < localRange.low)  return "low";
    if (numericAmount <= localRange.high) return "fair";
    if (numericAmount <= localRange.high * 1.20) return "high";
    return "very-high";
  }, [numericAmount, validAmount, localRange]);

  const pctDelta = validAmount
    ? Math.round(((numericAmount - (localRange.low + localRange.high) / 2) / ((localRange.low + localRange.high) / 2)) * 100)
    : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (validAmount) setSubmitted(true);
  }

  function shareVerdict() {
    if (!verdict) return;
    const text = `My ${trade.displayName} ${RATE_LABEL[rateType].toLowerCase()} quote of £${numericAmount} in ${city.displayName} is ${verdictLabel(verdict)} (${pctDelta > 0 ? "+" : ""}${pctDelta}% vs UK average). Checked with @TheNetworkers.`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      navigator.share({ text, url: window.location.href }).catch(() => {});
    } else if (typeof navigator !== "undefined") {
      navigator.clipboard?.writeText(text + " " + window.location.href).catch(() => {});
    }
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-6 md:py-12">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
        <Link href="/" className="hover:text-neutral-900">Home</Link>
        <span aria-hidden>/</span>
        <span className="font-black text-neutral-900">Quote Checker</span>
      </nav>

      {/* Hero */}
      <header className="grid gap-6 md:grid-cols-[1fr_minmax(280px,420px)] md:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#FFB300" }}>
            Free · No sign-up · No stored data
          </p>
          <h1 className="mt-1 text-[36px] font-black leading-tight text-neutral-900 md:text-[52px]">
            Is your trade quote fair?
          </h1>
          <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-neutral-600 md:text-[15px]">
            Check any UK trade quote against The Networkers' live UK Trade Price Index. Instant fair, high, or low verdict — with the percentage difference and underlying UK range.
          </p>
        </div>
        {/* Hero image — right side, object-contain so it's never cropped */}
        <div
          className="relative w-full overflow-hidden rounded-2xl border-2 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#0A0A0A" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2006_58_31%20AM.png"
            alt="UK Trade Quote Checker — is your quote fair?"
            className="block h-auto w-full object-contain"
            loading="eager"
          />
        </div>
      </header>

      {/* Tool */}
      <form
        onSubmit={submit}
        className="mt-8 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6"
        style={{ borderColor: "rgba(139,69,19,0.10)" }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Trade">
            <select
              value={tradeSlug}
              onChange={(e) => { setTradeSlug(e.target.value); setSubmitted(false); }}
              className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] font-black text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              {TRADE_ROWS.map((t) => (
                <option key={t.tradeSlug} value={t.tradeSlug}>{t.displayName}</option>
              ))}
            </select>
          </Field>
          <Field label="City">
            <select
              value={citySlug}
              onChange={(e) => { setCitySlug(e.target.value); setSubmitted(false); }}
              className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] font-black text-neutral-900"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              {CITY_ROWS.map((c) => (
                <option key={c.citySlug} value={c.citySlug}>{c.displayName} ({c.multiplier.toFixed(2)}×)</option>
              ))}
            </select>
          </Field>
          <Field label="Rate type">
            <div className="flex flex-wrap gap-1.5">
              {(["hourly", "day", "emergency"] as RateType[]).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => { setRateType(rt); setSubmitted(false); }}
                  className="h-11 rounded-lg px-3 text-[11px] font-black uppercase tracking-wider transition"
                  style={
                    rt === rateType
                      ? { backgroundColor: "#166534", color: "#FFFFFF" }
                      : { backgroundColor: "#E5E7EB", color: "#4B5563" }
                  }
                >
                  {RATE_LABEL[rt]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Quote amount (£)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-black text-neutral-400">£</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setSubmitted(false); }}
                placeholder="e.g. 350"
                className="h-11 w-full rounded-lg border bg-white pl-7 pr-3 text-[13px] font-black tabular-nums text-neutral-900"
                style={{ borderColor: "rgba(139,69,19,0.20)" }}
              />
            </div>
          </Field>
        </div>

        <button
          type="submit"
          disabled={!validAmount}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "#FFB300" }}
        >
          <Sparkles size={14} strokeWidth={2.6}/>
          Check my quote
        </button>
      </form>

      {/* Verdict */}
      {submitted && verdict && (
        <section className="mt-6 space-y-4">
          <VerdictCard
            verdict={verdict}
            amount={numericAmount}
            pctDelta={pctDelta}
            localRange={localRange}
            trade={trade.displayName}
            rateLabel={RATE_LABEL[rateType]}
            city={city.displayName}
          />

          {/* Actions */}
          <div className="grid gap-3 md:grid-cols-2">
            {(verdict === "high" || verdict === "very-high") && (
              <Link
                href={`/trades/${tradeSlug}/${citySlug}`}
                className="rounded-2xl border-2 p-5 shadow-sm transition hover:-translate-y-0.5"
                style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Recommended next step</p>
                <p className="mt-1 text-[15px] font-black text-neutral-900">
                  Get a 2nd quote from verified {trade.displayName.toLowerCase()}s in {city.displayName}
                </p>
                <p className="mt-1 text-[11.5px] text-neutral-600">
                  No lead broker. Direct WhatsApp contact. Free.
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-900">
                  Find verified trades <ArrowUpRight size={11} strokeWidth={2.6}/>
                </p>
              </Link>
            )}
            {verdict === "fair" && (
              <div
                className="rounded-2xl border-2 p-5 shadow-sm"
                style={{ borderColor: "rgba(34,197,94,0.30)", backgroundColor: "#F0FDF4" }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-green-700">Verdict</p>
                <p className="mt-1 text-[15px] font-black text-green-900">
                  This quote is in the fair UK range
                </p>
                <p className="mt-1 text-[11.5px] text-green-800">
                  Still worth getting 2-3 quotes for peace of mind — verified trades on The Networkers reply direct.
                </p>
                <Link href={`/trades/${tradeSlug}/${citySlug}`} className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-green-900">
                  Compare with verified trades <ArrowUpRight size={11} strokeWidth={2.6}/>
                </Link>
              </div>
            )}
            {verdict === "low" && (
              <div
                className="rounded-2xl border-2 p-5 shadow-sm"
                style={{ borderColor: "rgba(234,179,8,0.30)", backgroundColor: "#FEFCE8" }}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-yellow-700">Verdict</p>
                <p className="mt-1 text-[15px] font-black text-yellow-900">
                  Quote is below the UK fair range
                </p>
                <p className="mt-1 text-[11.5px] text-yellow-800">
                  Could be a bargain — could also indicate missing insurance, missing qualifications, or scope confusion. Check credentials before booking.
                </p>
                <Link href="/answers/do-i-need-a-gas-safe-engineer-to-fit-a-hob" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-yellow-900">
                  How to verify a trade <ArrowUpRight size={11} strokeWidth={2.6}/>
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={shareVerdict}
              className="rounded-2xl border-2 p-5 text-left shadow-sm transition hover:-translate-y-0.5"
              style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#FFFFFF" }}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Share this verdict</p>
              <p className="mt-1 text-[15px] font-black text-neutral-900">
                <Share2 size={14} strokeWidth={2.6} className="mb-0.5 inline"/> Copy or share result
              </p>
              <p className="mt-1 text-[11.5px] text-neutral-600">
                Sharing your check helps friends avoid overpaying too.
              </p>
            </button>
          </div>
        </section>
      )}

      {/* Explainer */}
      <section className="mt-10">
        <h2 className="text-[16px] font-black leading-tight text-neutral-900 md:text-[20px]">
          How the Quote Checker works
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <StepCard n={1} title="You enter">
            Trade, city, rate type (hourly / day / emergency), quote amount.
          </StepCard>
          <StepCard n={2} title="We compare">
            Against The Networkers' UK Trade Price Index for that trade + region + rate type. City multiplier applied.
          </StepCard>
          <StepCard n={3} title="You get a verdict">
            Fair, high, or low — with % difference and UK range. If high, we help you find a second quote.
          </StepCard>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <Info size={14} strokeWidth={2.4} className="mt-0.5 shrink-0 text-neutral-500"/>
          <p className="text-[12px] text-neutral-600">
            We don't store your quote or your details. This tool runs entirely in your browser. See the raw data feeding the comparison at
            {" "}<Link href="/price-index" className="font-black text-neutral-900 hover:underline">UK Trade Price Index →</Link>
          </p>
        </div>
      </section>

      {/* Cross-sell */}
      <section className="mt-8 grid gap-3 md:grid-cols-3">
        <Link href="/price-index" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} strokeWidth={2.6} className="text-neutral-900"/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Data source</span>
          </div>
          <p className="mt-2 text-[14px] font-black text-neutral-900">UK Trade Price Index →</p>
          <p className="mt-1 text-[11.5px] text-neutral-600">Day rates + hourly rates + regions</p>
        </Link>
        <Link href="/grants" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} strokeWidth={2.6} className="text-neutral-900"/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Reduce the cost</span>
          </div>
          <p className="mt-2 text-[14px] font-black text-neutral-900">UK Grants Tracker →</p>
          <p className="mt-1 text-[11.5px] text-neutral-600">Boiler + insulation + heat pump grants</p>
        </Link>
        <Link href="/answers" className="rounded-2xl border-2 bg-white p-4 shadow-sm hover:-translate-y-1 transition" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={14} strokeWidth={2.6} className="text-neutral-900"/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Q&amp;A</span>
          </div>
          <p className="mt-2 text-[14px] font-black text-neutral-900">Trade Q&amp;A hub →</p>
          <p className="mt-1 text-[11.5px] text-neutral-600">15 straight answers, growing</p>
        </Link>
      </section>

      <ResourcesBar active="check-quote" className="mt-8"/>

      {/* Trust footer */}
      <footer className="mt-12 flex flex-wrap items-center gap-4 border-t pt-6 text-[11px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
        <span className="inline-flex items-center gap-1"><ShieldCheck size={12}/> No quote data stored · Runs entirely client-side</span>
        <span>Data from UK Trade Price Index · Refreshed monthly</span>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function StepCard({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
        style={{ backgroundColor: "#0A0A0A" }}
      >
        {n}
      </span>
      <p className="mt-2 text-[13.5px] font-black text-neutral-900">{title}</p>
      <p className="mt-1 text-[12px] text-neutral-600">{children}</p>
    </div>
  );
}

function VerdictCard({
  verdict, amount, pctDelta, localRange, trade, rateLabel, city
}: {
  verdict:    Verdict;
  amount:     number;
  pctDelta:   number;
  localRange: { low: number; high: number };
  trade:      string;
  rateLabel:  string;
  city:       string;
}) {
  const config = {
    "fair":      { bg: "#F0FDF4", fg: "#166534", border: "#22C55E", label: "Fair", Icon: CircleCheck },
    "high":      { bg: "#FEF3C7", fg: "#92400E", border: "#F59E0B", label: "High", Icon: CircleAlert },
    "very-high": { bg: "#FEE2E2", fg: "#B91C1C", border: "#EF4444", label: "Very high", Icon: CircleX },
    "low":       { bg: "#FEFCE8", fg: "#854D0E", border: "#EAB308", label: "Low", Icon: CircleAlert }
  }[verdict];

  return (
    <div
      className="rounded-2xl border-2 p-6 shadow-sm md:p-8"
      style={{ borderColor: config.border, backgroundColor: config.bg }}
    >
      <div className="flex items-center gap-2">
        <config.Icon size={18} strokeWidth={2.6} style={{ color: config.fg }}/>
        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: config.fg, opacity: 0.75 }}>
          Verdict
        </p>
      </div>
      <p className="mt-2 text-[36px] font-black leading-tight md:text-[48px]" style={{ color: config.fg }}>
        {config.label}
        <span className="ml-3 text-[24px] tabular-nums md:text-[28px]" style={{ opacity: 0.75 }}>
          {pctDelta > 0 ? "+" : ""}{pctDelta}%
        </span>
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: config.fg }}>
        Your <strong>£{amount.toLocaleString("en-GB")}</strong> {rateLabel.toLowerCase()} quote for a <strong>{trade}</strong> in <strong>{city}</strong> is <strong>{verdictLabel(verdict).toLowerCase()}</strong>
        {" "}vs the UK Price Index range of <strong>£{localRange.low.toLocaleString("en-GB")} - £{localRange.high.toLocaleString("en-GB")}</strong> for this trade + region.
      </p>
    </div>
  );
}

function verdictLabel(v: Verdict): string {
  if (v === "fair")      return "Fair";
  if (v === "high")      return "High";
  if (v === "very-high") return "Very high";
  return "Low";
}
