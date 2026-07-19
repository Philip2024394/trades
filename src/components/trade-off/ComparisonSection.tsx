"use client";

// ComparisonSection — per-region proof matrix rendered on /trade-off.
// Networkers positions as a global platform, so /trade-off stacks
// three instances of this component (UK / USA / Australia) so the
// visitor sees at a glance that no competitor anywhere matches
// Networkers on these dimensions.
//
// The dataset per region lives in src/data/comparisonSummary.ts
// (region-scoped rows, competitors, pricing). The full deep-dive
// reports live at /trade-off/{region}/compare-platforms driven by
// tradePlatformComparison[.us|.au].ts.
//
// A single ComparisonLeadForm (email capture for the full PDF) is
// rendered separately — do NOT nest inside per-region charts, or
// visitors will see it three times.
//
// Legal: chart passes BPRs 2008 reg.4 / Lanham Act §43(a) / ACL
// s.18+29 respectively. See docs/LEGAL_{UK,US,AU}_COMPARATIVE_ADVERTISING.md.

import Link from "next/link";
import { useState } from "react";
import { Check, X, Mail } from "lucide-react";
import { REGION_SUMMARIES, UK_SUMMARY, US_SUMMARY, AU_SUMMARY, type RegionSummary, type YesNo } from "@/data/comparisonSummary";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

const REGION_MAP: Record<"uk" | "us" | "au", RegionSummary> = {
  uk: UK_SUMMARY,
  us: US_SUMMARY,
  au: AU_SUMMARY
};

export function ComparisonStack() {
  return (
    <>
      <section className="mt-10 sm:mt-14">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            The proof · global
          </p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl md:text-5xl">
            Networkers vs the top trade platforms{" "}
            <span style={{ color: BRAND_YELLOW }}>in every market we serve.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700 sm:text-base">
            {REGION_SUMMARIES.length} regions, {REGION_SUMMARIES.reduce((n, r) => n + r.competitors.length, 0)} named competitors, one honest scoreboard.
            Charts below show live 2026 pricing next to feature availability.
            Facts as at <span className="font-black">{new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long" })}</span>.
          </p>
        </div>
      </section>

      {REGION_SUMMARIES.map((region) => (
        <ComparisonSection key={region.key} region={region.key}/>
      ))}

      <ComparisonLeadForm/>
    </>
  );
}

export function ComparisonSection({ region = "uk" }: { region?: "uk" | "us" | "au" }) {
  const data     = REGION_MAP[region];
  const usCount  = data.rows.filter((r) => r.us === true).length;
  const asAtDate = new Date().toLocaleDateString(data.intlLocale, { year: "numeric", month: "long" });

  return (
    <section className="mt-10 sm:mt-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
            <span className="text-base leading-none">{data.flag}</span>
            <span>{data.regionLabel}</span>
          </p>
          <h3 className="mt-3 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            Networkers vs the top {data.regionLabel} trade platforms.
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
            <span className="font-bold text-neutral-900">{usCount} of {data.rows.length} features</span> live on Networkers in {data.regionLabel}.
            Fair-picture rows show where competitors beat us.
            Facts as at <span className="font-black">{asAtDate}</span>{" "}
            from each platform&rsquo;s public docs.{" "}
            <Link href={`${data.reportHref}#methodology`} className="font-black text-neutral-800 underline hover:text-neutral-900">
              Methodology &amp; sources
            </Link>
          </p>
        </div>

        {/* Comparison matrix */}
        <div className="mt-6 overflow-x-auto rounded-2xl border shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
          <table className="w-full min-w-[820px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Feature
                </th>
                <th className="px-2 py-3 text-center">
                  <span
                    className="networkers-tick-heartbeat inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm"
                    style={{ backgroundColor: BRAND_YELLOW }}
                  >
                    Networkers
                  </span>
                </th>
                {data.competitors.map((c) => (
                  <th key={c} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Pricing row — money comparison before feature scoring. */}
              <tr className="border-b" style={{ backgroundColor: "#FFFBEB", borderColor: "rgba(0,0,0,0.06)" }}>
                <td className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-neutral-700">
                  Starting price
                </td>
                <td className="px-2 py-2.5 text-center text-[11px] font-black" style={{ backgroundColor: "rgba(22,101,52,0.08)", color: BRAND_GREEN }}>
                  {data.usPricingShort}
                </td>
                {data.competitors.map((c) => (
                  <td key={c} className="px-2 py-2.5 text-center text-[10px] font-bold text-neutral-700">
                    {data.competitorPricing[c]}
                  </td>
                ))}
              </tr>
              {data.rows.map((r, i) => (
                <tr key={r.label} className={i % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                  <td className="px-3 py-2.5 text-[11.5px] font-bold text-neutral-800">
                    {r.label}
                  </td>
                  <td className="px-2 py-2.5 text-center" style={{ backgroundColor: r.us ? "rgba(22,101,52,0.08)" : undefined }}>
                    <Cell v={r.us} accent/>
                  </td>
                  {data.competitors.map((c) => (
                    <td key={c} className="px-2 py-2.5 text-center">
                      <Cell v={r.comp[c]}/>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mx-auto mt-3 max-w-3xl space-y-1.5 text-center text-[11px] text-neutral-500 sm:text-xs">
          <p>
            ✅ = live · ❌ = not offered · — = couldn&rsquo;t verify from public info.{" "}
            <Link href={data.reportHref} className="font-black text-neutral-700 underline hover:text-neutral-900">
              See full {data.regionLabel} report →
            </Link>
          </p>
          <p>
            <span className="font-black text-neutral-700">Competitor: think a row is wrong?</span>{" "}
            <a href={`mailto:admin@thenetworkers.app?subject=${encodeURIComponent(data.regionLabel + " comparison chart correction request")}`} className="underline hover:text-neutral-900">
              Email us
            </a>{" "}
            — we correct within 14 days. Trade marks named are the property of their respective owners.
          </p>
        </div>
      </div>
    </section>
  );
}

// Email lead capture — rendered ONCE at the end of the stack, not
// per region. Keeps the CTA singular so visitors don't see three
// identical forms.
export function ComparisonLeadForm() {
  const [email, setEmail]     = useState("");
  const [status, setStatus]   = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/comparison-lead", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.error === "invalid-email" ? "Check that email address." : "Something went wrong. Try again.");
        return;
      }
      setStatus("sent");
      setMessage(data.message ?? "Thanks — we'll email you shortly.");
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <section className="mt-10 sm:mt-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <form
          onSubmit={submitLead}
          className="mx-auto max-w-xl rounded-2xl border p-5 shadow-sm"
          style={{ borderColor: "rgba(184,134,11,0.30)", backgroundColor: "#FFF7DB" }}
        >
          <div className="flex items-baseline gap-2">
            <Mail size={14} strokeWidth={2.4} className="text-[#7A5B00]"/>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7A5B00]">
              Get the full global report
            </p>
          </div>
          <p className="mt-2 text-[15px] font-black text-neutral-900">
            Every UK · USA · Australia trade platform side-by-side, in one PDF.
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-neutral-700">
            Which take commissions. Which charge per lead. Which give you WhatsApp. Which force you to bid. Which trap you in their walled garden. We&rsquo;ll email you the full comparison plus the honest gaps in our own product.
          </p>
          {status !== "sent" ? (
            <>
              <div className="mt-4 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@your-trade.com"
                  className="flex-1 rounded-md border px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                  style={{ borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#FFFFFF" }}
                />
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white transition disabled:opacity-60"
                  style={{ backgroundColor: BRAND_GREEN }}
                >
                  {status === "sending" ? "Sending…" : "Send me the report"}
                </button>
              </div>
              {status === "error" && message && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700">
                  {message}
                </p>
              )}
              <p className="mt-3 text-[10px] leading-snug text-neutral-500">
                We&rsquo;ll email you once. No mailing list. No signup required.
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-md bg-green-50 px-3 py-3 text-[12px] font-bold text-green-800">
              <Check size={14} strokeWidth={2.6} className="mr-1 inline"/>
              {message}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}

function Cell({ v, accent }: { v: YesNo; accent?: boolean }) {
  if (v === true) {
    return (
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full${accent ? " networkers-tick-heartbeat" : ""}`}
        style={{ backgroundColor: accent ? BRAND_GREEN : "rgba(22,101,52,0.15)", color: accent ? "#FFFFFF" : BRAND_GREEN }}
        aria-label="Yes"
      >
        <Check size={11} strokeWidth={3}/>
      </span>
    );
  }
  if (v === false) {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full"
        style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
        aria-label="No"
      >
        <X size={11} strokeWidth={3}/>
      </span>
    );
  }
  return <span className="text-[11px] text-neutral-300" aria-label="Unknown">—</span>;
}
