"use client";

// Site-wide bug / broken-link / feature-request form. POSTs to
// /api/bug-reports/create which writes to hammerex_bug_reports.
// Successful submits show a receipt with the report id so the
// reporter can quote it in a follow-up email.

import Link from "next/link";
import { useState, useEffect } from "react";
import { Bug, Link as LinkIcon, Sparkles, Send, CheckCircle2, ArrowLeft } from "lucide-react";

type Kind = "bug" | "broken-link" | "feature-request";
type Severity = "low" | "medium" | "high" | "critical";

const KIND_META: Record<Kind, {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  hint: string;
}> = {
  bug:               { icon: Bug,      label: "Bug",             hint: "Something is broken or behaving wrong" },
  "broken-link":     { icon: LinkIcon, label: "Broken link",     hint: "A page 404s, a button goes nowhere, or a link's dead" },
  "feature-request": { icon: Sparkles, label: "Feature request", hint: "Something the platform should let you do" }
};

export function ReportAnIssueShell() {
  const [kind, setKind] = useState<Kind>("bug");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [reporterEmail, setReporterEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ id: string } | null>(null);

  // Pre-fill pageUrl from the referrer once we're client-side. Helps
  // reporters describe where they were without asking them to type
  // the URL.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const ref = document.referrer;
    if (ref) setPageUrl(ref);
  }, []);

  async function submit() {
    if (body.trim().length < 10) {
      setError("Please describe the issue in a bit more detail.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bug-reports/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          body: body.trim(),
          pageUrl: pageUrl.trim() || null,
          reporterEmail: reporterEmail.trim() || null,
          severity
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error === "body-too-short" ? "Please describe the issue in a bit more detail." : "Submit failed — please try again.");
        return;
      }
      setReceipt({ id: data.reportId });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 md:px-6">
        <div
          className="rounded-2xl border p-6 shadow-sm"
          style={{ borderColor: "rgba(6,95,70,0.35)", backgroundColor: "#F0F9F1" }}
        >
          <CheckCircle2 size={28} strokeWidth={2.2} style={{ color: "#166534" }}/>
          <h1 className="mt-3 text-[22px] font-black leading-tight text-neutral-900">
            Report received.
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
            Thanks — this is now in the Thenetworkers operational queue. The team reviews the queue hourly. If it's a blocking issue we'll usually respond the same day.
          </p>
          <div className="mt-4 rounded-lg border bg-white p-3 text-[12px] text-neutral-700" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Report reference
            </div>
            <div className="mt-0.5 break-all font-mono text-[12px] text-neutral-900">
              {receipt.id}
            </div>
            <div className="mt-1 text-[10.5px] text-neutral-500">
              Quote this reference if you email us for a follow-up: thenetworkers.app@gmail.com
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                setBody("");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-700"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              File another
            </button>
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#0A0A0A" }}
            >
              Back to Thenetworkers
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 md:px-6">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft size={12} strokeWidth={2.5}/>
          Back to Thenetworkers
        </Link>
      </div>

      <header className="mb-6">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Operational feedback
        </div>
        <h1
          className="mt-1 text-[28px] font-black leading-tight text-neutral-900 md:text-[34px]"
          style={{ fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif' }}
        >
          Report an issue
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-600">
          Something broken, a dead link, or a feature you wish existed — file it here. Every submission lands in the Thenetworkers operational queue and is reviewed hourly.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {/* Kind picker */}
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
            What kind of report?
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_META) as Kind[]).map((k) => {
              const meta = KIND_META[k];
              const Icon = meta.icon;
              const selected = k === kind;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition"
                  style={{
                    borderColor: selected ? "#FFB300" : "rgba(139,69,19,0.15)",
                    backgroundColor: selected ? "#FFF9E6" : "#FFFFFF"
                  }}
                >
                  <Icon size={16} strokeWidth={2.4} className={selected ? "text-amber-700" : "text-neutral-500"}/>
                  <div className="text-[13px] font-black text-neutral-900">
                    {meta.label}
                  </div>
                  <div className="text-[10.5px] leading-snug text-neutral-500">
                    {meta.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Describe the issue
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 5000))}
            placeholder="Include what you were doing, what you expected, and what actually happened."
            rows={6}
            disabled={submitting}
            className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          />
        </div>

        {/* Severity */}
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
            How urgent?
          </label>
          <div className="flex flex-wrap gap-2">
            {(["low", "medium", "high", "critical"] as Severity[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className="inline-flex h-8 items-center rounded-full border px-3 text-[10.5px] font-black uppercase tracking-wider transition"
                style={{
                  borderColor: severity === s ? "#0A0A0A" : "rgba(139,69,19,0.15)",
                  backgroundColor: severity === s ? "#0A0A0A" : "#FFFFFF",
                  color: severity === s ? "#FFFFFF" : "#374151"
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Optional email + page URL */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Your email (optional)
            </label>
            <input
              type="email"
              inputMode="email"
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value.slice(0, 200))}
              placeholder="so we can close the loop"
              disabled={submitting}
              className="w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Page URL (auto-filled)
            </label>
            <input
              type="url"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value.slice(0, 500))}
              placeholder="https://…"
              disabled={submitting}
              className="w-full rounded-lg border bg-white px-3 py-2 text-[12.5px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-black uppercase tracking-wider text-red-700">
            {error}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[10.5px] leading-snug text-neutral-500">
            We capture your IP + browser to spot abuse. Nothing else is stored automatically.
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-[12.5px] font-black uppercase tracking-wider text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#0A0A0A" }}
          >
            <Send size={13} strokeWidth={2.6}/>
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </main>
  );
}
