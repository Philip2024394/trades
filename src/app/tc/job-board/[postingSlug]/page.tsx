// /tc/job-board/[postingSlug] — Job posting detail.
//
// Shows the customer's job in full + all submitted quotes + the trade
// "submit a quote" form (visible to viewers who are verified trades in
// the discipline). Customer picks a trade → messaging thread opens.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Clock,
  PoundSterling,
  Users,
  Calendar,
  Send
} from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { QuoteCard } from "@/apps/jobBoard/components/QuoteCard";
import {
  findJobPosting,
  DISCIPLINE_LABELS,
  type JobQuote
} from "@/apps/jobBoard/data/jobPostings";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

export default function JobPostingDetailPage() {
  const params = useParams<{ postingSlug: string }>();
  const viewer = currentViewerTrade();
  const seed = params?.postingSlug ? findJobPosting(params.postingSlug) : undefined;
  const [localQuotes, setLocalQuotes] = useState<JobQuote[]>([]);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!seed) return notFound();

  const allQuotes = useMemo(() => [...seed.quotes, ...localQuotes], [seed.quotes, localQuotes]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    const d = parseInt(days, 10);
    if (isNaN(amt) || amt <= 0 || isNaN(d) || d <= 0 || !note.trim()) return;
    const q: JobQuote = {
      id: `q-local-${Date.now()}`,
      tradeSlug: viewer.slug,
      submittedAtIso: new Date().toISOString(),
      amountGbp: amt,
      estimatedDurationDays: d,
      note: note.trim()
    };
    setLocalQuotes((prev) => [...prev, q]);
    setSubmitted(true);
    setAmount("");
    setDays("");
    setNote("");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/tc/job-board"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          All open jobs
        </Link>

        {/* Header */}
        <header>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
            >
              {DISCIPLINE_LABELS[seed.discipline]}
            </span>
          </div>
          <h1 className="mt-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[26px]">
            {seed.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <MapPin size={11}/> {seed.customerLocation}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={11}/>
              Posted {new Date(seed.postedAtIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </span>
            {seed.desiredStartIso && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={11}/>
                Desired start {new Date(seed.desiredStartIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </span>
            )}
            {seed.budgetRangeGbp && (
              <span className="inline-flex items-center gap-1">
                <PoundSterling size={11}/>
                <strong className="text-neutral-900">
                  £{seed.budgetRangeGbp[0].toLocaleString()}–£{seed.budgetRangeGbp[1].toLocaleString()}
                </strong>
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users size={11}/>
              <strong className="text-neutral-900">{allQuotes.length}</strong> quote{allQuotes.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        {/* Description */}
        <section
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            The job
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-800">
            {seed.description}
          </p>
        </section>

        {/* Quotes */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Quotes — in submission order
            </div>
            <div className="text-[10.5px] text-neutral-500">
              Trade Center never re-ranks quotes
            </div>
          </div>
          {allQuotes.length === 0 ? (
            <div
              className="rounded-xl border-2 border-dashed p-6 text-center"
              style={{ borderColor: "rgba(139,69,19,0.20)" }}
            >
              <div className="text-[12.5px] font-black text-neutral-900">
                No quotes yet
              </div>
              <p className="mt-1 text-[11.5px] text-neutral-600">
                Be the first — quotes usually start rolling in within 2 hours of posting.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {allQuotes.map((q) => (
                <li key={q.id}>
                  <QuoteCard quote={q}/>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Trade-side quote form */}
        <section
          className="rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Submit a quote
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-neutral-600">
            You&apos;re quoting as <strong>{viewer.displayName}</strong> · {viewer.tradeType}. Your Verified Identity + reviews + rate card are shown alongside your quote.
          </p>

          <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Quote total (£)
                </span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="min-h-[44px] rounded-lg border bg-white px-3 text-[13px] font-black"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  required
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                  Estimated duration (days)
                </span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  className="min-h-[44px] rounded-lg border bg-white px-3 text-[13px] font-black"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  required
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                Short note — what&apos;s included, assumptions, materials basis
              </span>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-lg border bg-white p-3 text-[13px]"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
                placeholder="Two-coat skim on 55 m² · prep + dust sheets included · materials at cost..."
                required
              />
            </label>
            <div className="flex items-center justify-end gap-3">
              {submitted && (
                <span className="text-[11px] font-bold text-[#166534]">
                  Quote submitted — customer notified.
                </span>
              )}
              <button
                type="submit"
                disabled={!amount || !days || !note.trim()}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-sm disabled:opacity-40"
                style={{ backgroundColor: "#166534" }}
              >
                <Send size={13}/>
                Submit quote
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
