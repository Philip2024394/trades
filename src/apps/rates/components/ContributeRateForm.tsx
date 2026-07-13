// ContributeRateForm — user submits a real-world rate to help build
// the verified market signal.
//
// Renders on /tc/rates when the trade+region has fewer than 3
// verified contributors in the last 3 months (i.e. no aggregate
// exists yet). Once submitted, the row goes through a 24-hour
// cool-down before entering the aggregation job.
//
// Constitutional rules exposed to the user right in the form copy —
// no dark patterns, transparent thresholds.

"use client";

import { useState } from "react";
import { ShieldCheck, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { SOC_TO_TRADE_SLUG, NUTS1_REGIONS, UK_CITIES } from "@/lib/rates/taxonomy";

type Props = {
  /** Pre-fill from the trade's own rate card if we have it. */
  defaultTradeSlug?: string;
  defaultRegionCode?: string;
};

type Status = "idle" | "submitting" | "success" | "error";

export function ContributeRateForm({ defaultTradeSlug, defaultRegionCode }: Props) {
  const [tradeSlug, setTradeSlug]   = useState(defaultTradeSlug   ?? "");
  const [regionCode, setRegionCode] = useState(defaultRegionCode  ?? "");
  const [citySlug, setCitySlug]     = useState<string>("");
  const [rateType, setRateType]     = useState<"hourly" | "daily" | "annual">("hourly");
  const [gbpAmount, setGbpAmount]   = useState("");
  const [dateOfWork, setDateOfWork] = useState(new Date().toISOString().slice(0, 10));
  const [sourceType, setSourceType] = useState<"invoice" | "quote" | "hourly-rate" | "day-rate" | "contract">("invoice");

  // City list is filtered to the picked region so trades pick a valid
  // (region, city) pair. If region is unset, the city selector is
  // disabled — city is optional overall.
  const eligibleCities = regionCode
    ? UK_CITIES.filter((c) => c.regionCode === regionCode)
    : [];
  const [status, setStatus]         = useState<Status>("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);

  const canSubmit =
    tradeSlug !== "" &&
    regionCode !== "" &&
    Number(gbpAmount) > 0 &&
    dateOfWork !== "" &&
    status !== "submitting";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/rates/submit", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          tradeSlug,
          regionCode,
          citySlug: citySlug || undefined,
          rateType,
          gbpAmount: Number(gbpAmount),
          dateOfWork,
          sourceType
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(json.detail ?? json.error ?? "submission_failed");
        return;
      }
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("network_error");
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-2xl border p-5 shadow-sm"
        style={{ backgroundColor: "#F0FDF4", borderColor: "rgba(22,101,52,0.35)" }}
        role="status"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
          >
            <CheckCircle2 size={16} strokeWidth={2.5}/>
          </div>
          <div>
            <div className="text-[13px] font-black" style={{ color: "#166534" }}>
              Thanks — your rate is under review
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-neutral-700">
              We hold submissions for 24 hours for fraud review, then they enter the aggregation window. A verified market signal appears once 3+ contributors from your region have submitted within a 3-month window and the standard deviation is under 15%.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <header className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
        >
          <ShieldCheck size={16}/>
        </div>
        <div>
          <div className="text-[13px] font-black text-neutral-900">
            Contribute a verified rate
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
            Help build the market signal for your region. Rates go through a 24-hour review then enter aggregation. Displayed anonymously; your name never appears with the rate.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Trade">
          <select
            value={tradeSlug}
            onChange={(e) => setTradeSlug(e.target.value)}
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <option value="">Pick your trade…</option>
            {SOC_TO_TRADE_SLUG.map((t) => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Region">
          <select
            value={regionCode}
            onChange={(e) => {
              setRegionCode(e.target.value);
              setCitySlug(""); // clear city when region changes
            }}
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <option value="">Pick your region…</option>
            {NUTS1_REGIONS.map((r) => (
              <option key={r.code} value={r.code}>{r.label}</option>
            ))}
          </select>
        </Field>

        <Field label="City (optional — helps the city aggregate)">
          <select
            value={citySlug}
            onChange={(e) => setCitySlug(e.target.value)}
            disabled={eligibleCities.length === 0}
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900 disabled:opacity-50"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <option value="">
              {regionCode ? "Skip (region only)" : "Pick a region first…"}
            </option>
            {eligibleCities.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Rate type">
          <select
            value={rateType}
            onChange={(e) => setRateType(e.target.value as typeof rateType)}
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="annual">Annual</option>
          </select>
        </Field>

        <Field label="Amount (£)">
          <input
            type="number"
            step="0.01"
            min="0"
            value={gbpAmount}
            onChange={(e) => setGbpAmount(e.target.value)}
            placeholder="e.g. 18.50"
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          />
        </Field>

        <Field label="Date of work">
          <input
            type="date"
            value={dateOfWork}
            onChange={(e) => setDateOfWork(e.target.value)}
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          />
        </Field>

        <Field label="Source">
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
            className="min-h-[42px] w-full rounded-md border bg-white px-3 text-[12.5px] text-neutral-900"
            style={{ borderColor: "rgba(139,69,19,0.18)" }}
          >
            <option value="invoice">Invoice paid</option>
            <option value="quote">Quote accepted</option>
            <option value="hourly-rate">Standard hourly rate</option>
            <option value="day-rate">Standard day rate</option>
            <option value="contract">Contract line item</option>
          </select>
        </Field>
      </div>

      {errorMsg && (
        <div
          className="flex items-start gap-2 rounded-md p-3 text-[11.5px]"
          style={{ backgroundColor: "#FEE2E2", color: "#7F1D1D" }}
        >
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>
          <div>
            <div className="font-black">Submission not accepted</div>
            <div className="mt-0.5">{errorMsg}</div>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition disabled:opacity-40"
        style={{ backgroundColor: "#166534" }}
      >
        <Send size={13}/>
        {status === "submitting" ? "Submitting…" : "Submit rate for verification"}
      </button>

      <p className="text-[10.5px] leading-snug text-neutral-500">
        Sanity check: rates more than 200% above or below the ONS baseline are auto-rejected as likely typos. You get one submission per trade × region × rate type × month.
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
      </span>
      {children}
    </label>
  );
}
