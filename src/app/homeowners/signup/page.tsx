// /homeowners/signup — client-side signup form for SiteBook.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Gift, ShieldCheck, Zap, Timer } from "lucide-react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";

const BRAND_YELLOW: string = "#FFB300";
const BRAND_GREEN:  string = "#166534";

export default function HomeownerSignupPage() {
  const router                       = useRouter();
  const searchParams                 = useSearchParams();
  const intent                       = searchParams.get("intent");        // 'create-project' → skip hub
  const claimedName                  = searchParams.get("name") || "";    // pre-filled SiteBook nickname from landing
  const [email, setEmail]            = useState("");
  const [password, setPassword]      = useState("");
  const [firstName, setFirstName]    = useState("");
  const [houseNickname, setHouseNick] = useState(claimedName);
  const [postcode, setPostcode]      = useState("");
  const [whatsapp, setWhatsapp]      = useState("");
  const [status, setStatus]          = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage]        = useState("");

  const errorMap: Record<string, string> = {
    "invalid-email":       "That doesn't look like a valid email.",
    "password-too-short":  "Password must be at least 8 characters.",
    "missing-first-name":  "Please enter your first name.",
    "missing-nickname":    "Please name your SiteBook — this becomes your URL.",
    "email-in-use":        "This email is already registered. Try logging in.",
    "signup-failed":       "Something went wrong. Please try again."
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/homeowner/signup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        email, password, firstName, postcode, whatsappNumber: whatsapp,
        houseNickname: houseNickname.trim() || undefined
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setMessage(errorMap[data.error] ?? "Something went wrong. Please try again.");
      return;
    }
    // Intent-based routing — if the visitor arrived from the "Post
    // your project" CTA, skip the empty hub and drop them directly on
    // the project-creation form. Otherwise land on the hub.
    router.push(intent === "create-project" ? "/sitebook/new" : "/sitebook");
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border-2 bg-white p-6 shadow-lg" style={{ borderColor: BRAND_YELLOW }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            {intent === "create-project" ? "Post your project" : "Start your SiteBook"}
          </p>
          <h1 className="mt-2 text-2xl font-black text-neutral-900">
            {intent === "create-project" ? "One quick account, then post" : "Create your account"}
          </h1>
          <p className="mt-1 text-[13px] text-neutral-600">
            {intent === "create-project"
              ? "60 seconds. Then you're on the project form. Your SiteBook is ready before your coffee gets cold."
              : "Free forever · No card · Your data belongs to you"}
          </p>

          {/* Audience clarifier — SiteBook is for people who OWN a
              project (homeowners, construction firms, developers, site
              managers). Trades/suppliers/merchants don't sign up here;
              they join via invite from a project owner. */}
          <div className="mt-3 rounded-lg border px-3 py-2 text-[11.5px] leading-snug text-neutral-700" style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#F9F5EA" }}>
            <p>
              <span className="font-black text-neutral-900">Who&rsquo;s this for:</span>{" "}
              homeowners, construction companies, developers, site managers &mdash; anyone with a renovation, new build, extension or repair project.
            </p>
            <p className="mt-1 text-neutral-600">
              <span className="font-black">Trade or supplier?</span> You don&rsquo;t need a SiteBook &mdash; project owners invite you directly from their post.{" "}
              <Link href="/trade-off" className="font-black text-neutral-900 underline">List your trade profile instead →</Link>
            </p>
          </div>

          {/* Founding-member perks strip — subtle value stack that
              turns the signup from a chore into a small win. Every
              item is real (documented in the SiteBook build), not
              marketing air. The "yours to keep" line lands the
              non-shouty urgency: this is a founding-member window,
              not a permanent thing. */}
          <div
            className="mt-3 rounded-xl border-2 p-3.5"
            style={{
              borderColor: BRAND_YELLOW,
              background: "linear-gradient(135deg, #FFFBEB 0%, #FFF5D6 100%)"
            }}
          >
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles size={13} strokeWidth={2.6} style={{ color: BRAND_YELLOW }}/>
              <p className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[#7A5B00]">
                Founding member perks · while we&rsquo;re growing
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              <PerkItem
                icon={<Gift size={13} strokeWidth={2.6}/>}
                title="Free PDF export"
                sub="Worth £9.99 · yours to keep"
              />
              <PerkItem
                icon={<Zap size={13} strokeWidth={2.6}/>}
                title="Priority trade responses"
                sub="24h average vs standard 48h"
              />
              <PerkItem
                icon={<ShieldCheck size={13} strokeWidth={2.6}/>}
                title="Unlimited warranty vault"
                sub="Every receipt & certificate, one place"
              />
              <PerkItem
                icon={<Timer size={13} strokeWidth={2.6}/>}
                title="AI cost check on quotes"
                sub="Know if a quote is fair before you say yes"
              />
            </ul>
            <p className="mt-2.5 text-[10.5px] leading-snug text-[#7A5B00]">
              No card. Nothing to cancel. These perks stay on your account for as long as you have it — even after we start charging new signups.
            </p>
          </div>

          {claimedName && (
            <div className="mt-4 rounded-lg border-2 p-3" style={{ borderColor: BRAND_YELLOW, backgroundColor: "#FFFBEB" }}>
              <p className="text-[10px] font-black uppercase tracking-wider text-[#7A5B00]">Reserving your SiteBook</p>
              <p className="mt-1 text-[15px] font-black text-neutral-900">&ldquo;{claimedName}&rdquo;</p>
              <p className="mt-0.5 text-[11px] text-neutral-600">Complete the form below to lock it in.</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="First name" htmlFor="firstName">
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Sarah"/>
            </Field>
            <Field label="Name your SiteBook (this becomes your URL)" htmlFor="houseNickname">
              <input
                id="houseNickname"
                required
                minLength={2}
                value={houseNickname}
                onChange={(e) => setHouseNick(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="e.g. The Old Rectory, 42 Elm Road"
              />
              {houseNickname.trim().length >= 2 && (
                <p className="mt-1.5 text-[10.5px] font-bold text-neutral-500">
                  Your URL: <span className="font-black text-neutral-900">thenetworkers.app/{houseNickname.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "").slice(0, 40)}</span>
                </p>
              )}
            </Field>
            <Field label="Email address" htmlFor="email">
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="you@your-email.com"/>
            </Field>
            <Field label="Password" htmlFor="password">
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="At least 8 characters"/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Postcode (optional)" htmlFor="postcode">
                <input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="M15 5EQ"/>
              </Field>
              <Field label="WhatsApp (optional)" htmlFor="whatsapp">
                <input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="+447..."/>
              </Field>
            </div>

            {status === "error" && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white transition hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {status === "sending"
                ? (intent === "create-project" ? "Setting up…" : "Creating your SiteBook…")
                : (intent === "create-project" ? "Continue to project form →" : "Create my SiteBook →")}
            </button>

            <p className="text-center text-[11px] text-neutral-500">
              By continuing you agree that your SiteBook data belongs to you and can be exported at any time.
            </p>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-neutral-600">
          Already have an account?{" "}
          <Link
            href={intent === "create-project" ? "/homeowners/login?next=/sitebook/new" : "/homeowners/login"}
            className="font-black text-neutral-900 underline"
          >
            Log in
          </Link>
        </p>
      </section>
      <XratedFooter/>
    </main>
  );
}

/** Compact perk row for the founding-member strip. Yellow tick chip
 *  + bold headline + one-line detail. Kept intentionally small so
 *  the strip doesn't shove the form below the fold. */
function PerkItem({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <li className="flex items-start gap-2 rounded-md bg-white/60 p-2">
      <span
        className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md"
        style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black leading-tight text-neutral-900">{title}</p>
        <p className="text-[10.5px] leading-tight text-neutral-600">{sub}</p>
      </div>
    </li>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
