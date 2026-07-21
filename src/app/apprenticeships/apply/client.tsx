"use client";

// Young-person apprenticeship application form.
//
// Copy tone: excitement + genuine encouragement. This is a kid
// putting their hand up in front of local employers — the form has
// to feel like an opportunity, not a bureaucratic hurdle.
//
// The Networkers commits to backing UK trade youth — we surface every
// serious application to verified local trades free. Trades pay
// 1 washer only when they actually want to reach out.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight, Sparkles, GraduationCap, ShieldCheck,
  CircleCheck, Loader2, AlertTriangle
} from "lucide-react";
import { CAREER_GUIDES } from "@/app/careers/config";
import { ApprenticeshipBanner } from "@/components/apprenticeships/ApprenticeshipBanner";
import { SeoSiteHeader } from "@/components/seo/SeoSiteHeader";

const TRADES = CAREER_GUIDES.map((g) => ({ slug: g.slug, name: g.displayName }));

export function ApplyForm() {
  const router          = useRouter();
  const searchParams    = useSearchParams();
  const prefTrade       = searchParams?.get("trade") ?? "";

  const [tradeSlug,     setTradeSlug]     = useState(prefTrade || TRADES[0].slug);
  const [fullName,      setFullName]      = useState("");
  const [age,           setAge]           = useState("");
  const [whatsapp,      setWhatsapp]      = useState("");
  const [city,          setCity]          = useState("");
  const [postcode,      setPostcode]      = useState("");
  const [addressLine,   setAddressLine]   = useState("");
  const [workedBefore,  setWorkedBefore]  = useState(false);
  const [leavingSchool, setLeavingSchool] = useState(false);
  const [experience,    setExperience]    = useState("");
  const [dutiesAware,   setDutiesAware]   = useState(false);
  const [disciplineAware, setDisciplineAware] = useState(false);
  const [aboutMe,       setAboutMe]       = useState("");
  const [cvUrl,         setCvUrl]         = useState("");
  const [photoUrl,      setPhotoUrl]      = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const tradeName = useMemo(
    () => TRADES.find((t) => t.slug === tradeSlug)?.name ?? "trade",
    [tradeSlug]
  );

  const valid =
    fullName.trim().length >= 2 &&
    Number(age) >= 16 &&
    whatsapp.trim().length >= 6 &&
    dutiesAware &&
    disciplineAware;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/apprenticeships/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        trade_slug:         tradeSlug,
        full_name:          fullName,
        age:                Number(age),
        whatsapp,
        city,
        postcode,
        address_line:       addressLine,
        worked_before:      workedBefore,
        leaving_school:     leavingSchool,
        experience_summary: experience,
        duties_aware:       dutiesAware,
        discipline_aware:   disciplineAware,
        about_me:           aboutMe,
        cv_url:             cvUrl || null,
        photo_url:          photoUrl || null
      })
    });
    const json = await res.json().catch(() => ({ ok: false, error: "bad-response" }));
    setSubmitting(false);
    if (!json.ok) {
      setError(json.error || "submit-failed");
      return;
    }
    router.push(`/apprenticeships/apply/success?trade=${tradeSlug}&notified=${json.notified ?? 0}`);
  }

  return (
    <main className="min-h-screen bg-[#FBF6EC]">
      <SeoSiteHeader/>
      <div className="mx-auto max-w-[900px] px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumbs" className="mb-4 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
          <Link href="/" className="hover:text-neutral-900">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/apprenticeships" className="hover:text-neutral-900">Apprenticeships</Link>
          <span aria-hidden>/</span>
          <span className="font-black text-neutral-900">Apply</span>
        </nav>

        {/* Start-free banner — burned-in CTA, whole image links to form (self-link is fine — the form is below) */}
        <ApprenticeshipBanner variant="start-free" className="mb-6"/>

        {/* Excitement hero */}
        <header className="rounded-2xl border-2 p-6 md:p-8" style={{ borderColor: "#FFB300", backgroundColor: "#FFFDF6" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-neutral-900"/>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-900">
              Employers are looking for suitable candidates. You could be chosen.
            </p>
          </div>
          <h1 className="mt-2 text-[32px] font-black leading-tight text-neutral-900 md:text-[44px]">
            Start your trade career
          </h1>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-800 md:text-[16px]">
            The Networkers supports UK trade youth. Fill out the details below and every verified
            {" "}<strong>{tradeName.toLowerCase()}</strong> in your area sees your application. Serious employers only —
            {" "}we charge them <strong>1 washer</strong> to reach out, so no time-wasters.
          </p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-neutral-900 px-3 py-1 text-[10.5px] font-black uppercase tracking-wider text-white">
            <GraduationCap size={11} strokeWidth={2.6}/>
            Every apprentice we place is a future networker
          </p>
        </header>

        {/* Form */}
        <form
          onSubmit={submit}
          className="mt-6 rounded-2xl border-2 bg-white p-5 shadow-sm md:p-6"
          style={{ borderColor: "rgba(139,69,19,0.10)" }}
        >
          {/* Trade + basics */}
          <Section title="What trade + who are you">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Trade I want to learn" required>
                <select
                  value={tradeSlug}
                  onChange={(e) => setTradeSlug(e.target.value)}
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] font-black text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                >
                  {TRADES.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Full name" required>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jamie McCartney"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Age (16+)" required>
                <input
                  type="number"
                  min="16"
                  max="65"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="17"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] tabular-nums text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="WhatsApp number" required>
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="07..."
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] tabular-nums text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>
          </Section>

          {/* Location */}
          <Section title="Where are you">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="City / town">
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Manchester"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Postcode">
                <input
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                  placeholder="M14 5RB"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] tabular-nums text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Address (kept private)">
                <input
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="14 Something Road"
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>
          </Section>

          {/* Experience */}
          <Section title="Your experience so far">
            <div className="space-y-3">
              <Checkbox
                label={`I've worked in ${tradeName.toLowerCase()} before (weekend, holiday, family job)`}
                checked={workedBefore}
                onChange={setWorkedBefore}
              />
              <Checkbox
                label="I'm leaving school this year (or already have)"
                checked={leavingSchool}
                onChange={setLeavingSchool}
              />
              <Field label="Any experience worth mentioning">
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  rows={3}
                  placeholder="e.g. Helped my uncle on 3 bathroom jobs. Level 1 Diploma at college. Confident with hand tools."
                  className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label={`Tell the ${tradeName.toLowerCase()} why you'll be the one they pick`}>
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  rows={4}
                  placeholder="Turn up on time. Learn fast. Genuinely interested in the trade. Willing to graft."
                  className="w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>
          </Section>

          {/* Awareness */}
          <Section title="Are you ready for the work">
            <div className="space-y-3">
              <Checkbox
                label={`I understand the day-to-day duties of a ${tradeName.toLowerCase()} — early starts, physical work, learning on the job`}
                checked={dutiesAware}
                onChange={setDutiesAware}
                required
              />
              <Checkbox
                label="I understand trade discipline — I show up on time, follow instructions, and treat the boss's tools + van with respect"
                checked={disciplineAware}
                onChange={setDisciplineAware}
                required
              />
            </div>
          </Section>

          {/* Optional media */}
          <Section title="CV + photo (optional, but helps)">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Link to your CV (Google Drive, Dropbox, etc)">
                <input
                  value={cvUrl}
                  onChange={(e) => setCvUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
              <Field label="Link to a photo of you">
                <input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-neutral-900"
                  style={{ borderColor: "rgba(139,69,19,0.20)" }}
                />
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">
              Any employer that reaches out will see these links. Only paste links you're happy to share.
            </p>
          </Section>

          {error && (
            <div
              className="mt-5 flex items-start gap-2 rounded-lg border-2 p-3"
              style={{ borderColor: "#EF4444", backgroundColor: "#FEF2F2" }}
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-700"/>
              <p className="text-[12px] font-black text-red-900">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!valid || submitting}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: "#FFB300" }}
          >
            {submitting ? <><Loader2 size={14} className="animate-spin"/> Submitting</> : <><Sparkles size={14} strokeWidth={2.6}/> Submit my application</>}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            <ShieldCheck size={11}/> Address stays private · WhatsApp shown only to trades who pay 1 washer to reach out
          </p>
        </form>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t pt-5 first:mt-0 first:border-0 first:pt-0" style={{ borderColor: "rgba(139,69,19,0.08)" }}>
      <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
        {label}
        {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange, required }: { label: string; checked: boolean; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-3 hover:bg-[#FBF6EC]" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required={required}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#FFB300]"
      />
      <span className="text-[12.5px] leading-snug text-neutral-800">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
    </label>
  );
}
