// /tc/post-job — Customer posts a job to the board.
//
// Homeowner-facing form. Verified trades in the discipline + region see
// the job when it goes live and can submit quotes. Customer picks the
// trade they want and threads open in Trade Center Messages.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Info,
  Briefcase
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import {
  DISCIPLINE_LABELS,
  type JobDiscipline,
  type JobUrgency
} from "@/apps/jobBoard/data/jobPostings";

const URGENCY_OPTIONS: Array<{ value: JobUrgency; label: string }> = [
  { value: "flexible",       label: "Flexible — no rush" },
  { value: "within-month",   label: "Within a month" },
  { value: "within-week",    label: "Within a week" },
  { value: "urgent",         label: "Urgent — this week" }
];

export default function PostJobPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [discipline, setDiscipline] = useState<JobDiscipline>("plastering");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [urgency, setUrgency] = useState<JobUrgency>("within-month");
  const [submitted, setSubmitted] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !name.trim() || !postcode.trim()) return;
    setSubmitted(true);
    setTimeout(() => router.push("/tc/job-board"), 1400);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <TradeCenterHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-8">
          <div
            className="w-full rounded-2xl border bg-white p-6 text-center shadow-sm"
            style={{ borderColor: "rgba(22,101,52,0.35)" }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "#166534" }}
            >
              <ShieldCheck size={26} strokeWidth={2.5} className="text-white"/>
            </div>
            <h1 className="mt-4 text-[18px] font-black text-neutral-900">
              Your job is live on the board
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-neutral-600">
              Verified trades in your area typically start quoting within a couple of hours.
              You&apos;ll get a notification for each quote. Trade Center never shares your
              contact details until you pick a trade.
            </p>
            <Link
              href="/tc/job-board"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              View the board
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/tc/job-board"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Job board
        </Link>

        <header>
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Post a job
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            <Briefcase size={24}/>
            Tell us about the job
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Every trade quoting on your job has verified identity, insurance and reviews. You
            pick who you want — Trade Center never assigns for you.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          {/* Contact */}
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              You
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Your name" required>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  required
                />
              </Field>
              <Field label="Postcode (or area)" required>
                <input
                  type="text"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  placeholder="M20 or Withington"
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  required
                />
              </Field>
            </div>
          </fieldset>

          {/* Job details */}
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              The job
            </legend>
            <div className="grid gap-3">
              <Field label="What kind of work" required>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as JobDiscipline)}
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  {(Object.keys(DISCIPLINE_LABELS) as JobDiscipline[]).map((d) => (
                    <option key={d} value={d}>{DISCIPLINE_LABELS[d]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Short title" required hint="e.g. 'Lounge re-skim' — helps trades scan the board">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  required
                />
              </Field>
              <Field label="Description" required hint="What needs doing, any known problems, access details, materials chosen">
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-lg border bg-white p-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  required
                />
              </Field>
            </div>
          </fieldset>

          {/* Budget + urgency */}
          <fieldset>
            <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Budget + timing
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Budget minimum (£)" hint="Optional — leave blank for 'any'">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                />
              </Field>
              <Field label="Budget maximum (£)">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                />
              </Field>
              <Field label="When">
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as JobUrgency)}
                  className="min-h-[44px] w-full rounded-lg border bg-white px-3 text-[13px]"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  {URGENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          {/* Provenance note */}
          <div className="flex items-start gap-2 rounded-md bg-neutral-50 p-3">
            <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
            <p className="text-[10.5px] leading-snug text-neutral-500">
              Your contact details are NOT shared until you pick a trade. Only your first name,
              area, and job description are visible on the board. Trade Center never assigns a
              trade or reorders quotes.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider text-white shadow-sm"
              style={{ backgroundColor: "#166534" }}
            >
              <Send size={14}/>
              Post job to the board
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  hint
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] leading-snug text-neutral-500">{hint}</span>}
    </label>
  );
}
