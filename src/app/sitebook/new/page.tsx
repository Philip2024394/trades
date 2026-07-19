// /sitebook/new — create a new SiteBook project.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TRADE_TYPE_OPTIONS, TIMELINE_OPTIONS, type ProjectTimeline } from "@/lib/homeowners/types";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle]         = useState("");
  const [description, setDesc]    = useState("");
  const [tradeTypes, setTrades]   = useState<string[]>([]);
  const [postcode, setPostcode]   = useState("");
  const [city, setCity]           = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [timeline, setTimeline]   = useState<ProjectTimeline | "">("");
  const [status, setStatus]       = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState("");

  function toggleTrade(slug: string) {
    setTrades((cur) => cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    const res = await fetch("/api/homeowner/projects", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        title, description,
        trade_types:      tradeTypes,
        address_postcode: postcode,
        address_city:     city,
        budget_min_gbp:   budgetMin ? parseFloat(budgetMin) : null,
        budget_max_gbp:   budgetMax ? parseFloat(budgetMax) : null,
        timeline:         timeline || null
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setErrorMsg(data.error === "missing-title" ? "Please give your project a title." : "Something went wrong. Try again.");
      return;
    }
    router.push(`/sitebook/${data.projectId}`);
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/sitebook" className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">← Back to SiteBook</Link>

      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Post your project</p>
        <h1 className="mt-1 text-2xl font-black text-neutral-900 sm:text-3xl">Tell us about your project</h1>
        <p className="mt-1 text-[13px] text-neutral-600">
          You can save as draft anytime and edit later. When you publish, we&rsquo;ll notify the 3 nearest matching trades in your area and they can reply with quotes right here in your SiteBook.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border-2 bg-white p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <Field label="Project title" htmlFor="title" hint="e.g. Bathroom refit, boiler replacement, garden makeover">
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"/>
        </Field>

        <Field label="Description" htmlFor="description" hint="Optional. What are you trying to achieve? Size, style, key details.">
          <textarea id="description" rows={4} value={description} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"/>
        </Field>

        <div>
          <p className="mb-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-600">Trades you&rsquo;ll need</p>
          <p className="mb-3 text-[11.5px] text-neutral-500">Pick all that apply. Bathroom refit usually needs plumber + tiler + electrician.</p>
          <div className="flex flex-wrap gap-1.5">
            {TRADE_TYPE_OPTIONS.map((t) => {
              const active = tradeTypes.includes(t.slug);
              return (
                <button
                  type="button"
                  key={t.slug}
                  onClick={() => toggleTrade(t.slug)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                    active
                      ? "text-neutral-900 shadow-sm"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                  style={active ? { backgroundColor: BRAND_YELLOW, borderColor: BRAND_YELLOW } : {}}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Postcode" htmlFor="postcode">
            <input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="M15 5EQ"/>
          </Field>
          <Field label="City / area" htmlFor="city">
            <input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Manchester"/>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget min (£)" htmlFor="budget-min">
            <input id="budget-min" type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"/>
          </Field>
          <Field label="Budget max (£)" htmlFor="budget-max">
            <input id="budget-max" type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"/>
          </Field>
        </div>

        <Field label="Timeline" htmlFor="timeline">
          <select id="timeline" value={timeline} onChange={(e) => setTimeline(e.target.value as ProjectTimeline | "")} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400">
            <option value="">Select…</option>
            {TIMELINE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        {status === "error" && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">{errorMsg}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={status === "saving"}
            className="inline-flex h-11 items-center gap-2 rounded-full px-5 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            {status === "saving" ? "Saving…" : "Save as draft →"}
          </button>
          <Link href="/sitebook" className="text-[12px] font-bold text-neutral-600 hover:text-neutral-900">Cancel</Link>
        </div>
      </form>
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-neutral-600">{label}</span>
      {hint && <span className="mb-1.5 block text-[11px] text-neutral-500">{hint}</span>}
      {children}
    </label>
  );
}
