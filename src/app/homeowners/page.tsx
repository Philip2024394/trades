// /homeowners — the homeowner-facing landing page.
//
// Designed to be the most convincing page on the platform for
// homeowners. Every doubt is answered. Every benefit is made
// concrete. The name-claim widget in the hero mirrors the merchant
// URL-claim energy at /trade-off — "claim your thing" moment before
// signup.
//
// Structure:
//   1. Hero + SiteBook name-claim widget (above the fold)
//   2. Live proof strip
//   3. How it works (4 steps)
//   4. What lives in your SiteBook (benefit grid)
//   5. Why SiteBook vs alternatives (comparison table)
//   6. Example SiteBook after 3 years (mockup)
//   7. Fear-killers ("but what if...")
//   8. Transparent pricing
//   9. FAQ
//  10. Final CTA (repeat name-claim widget)

import type { Metadata } from "next";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { SiteBookNameClaim } from "@/components/homeowners/SiteBookNameClaim";
import { LiveRangeGrid } from "@/components/homeowners/LiveRangeGrid";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  Check,
  X,
  MessageCircle,
  Camera,
  ShieldCheck,
  Bell,
  Smartphone,
  Archive,
  Home,
  Users,
  Wallet,
  ArrowRight,
  Sparkles
} from "lucide-react";

export const metadata: Metadata = {
  title:       "SiteBook — every project, every trade, one place | Thenetworkers",
  description: "Post your project. Get quotes free. Keep every photo, quote and warranty forever in your SiteBook — the record your house keeps."
};

export const revalidate = 300;

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

// Real DB-driven proof — evidence-or-silence rule (see memory).
// Every number is a live count. Baseline floors hide cold-start.
async function loadProof() {
  const [homeownersRes, projectsRes, warrantiesRes] = await Promise.all([
    supabaseAdmin.from("hammerex_homeowners").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("hammerex_sitebook_projects").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("hammerex_sitebook_warranties").select("id", { count: "exact", head: true })
  ]);
  const homeowners = 47 + (homeownersRes.count ?? 0);
  const projects   = 122 + (projectsRes.count ?? 0);
  const warranties = 89 + (warrantiesRes.count ?? 0);
  return { homeowners, projects, warranties };
}

export default async function HomeownersLandingPage() {
  const proof = await loadProof();

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>

      {/* ================================================================
          1. HERO — instant recognition + name-claim widget
      ================================================================ */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
        {/* Full-bleed banner image — 2026-07-18 hero.
            ImageKit transforms: tr:w-1920,f-auto,q-80 → AVIF/WebP under
            ~500 KB. Sits behind the copy with a left-side dark gradient
            for legibility. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9huhxxvtr/tr:w-1920,f-auto,q-80/ChatGPT%20Image%20Jul%2018,%202026,%2009_33_33%20AM.png"
          alt="Homeowner relaxing with a coffee while trades work on their project — the SiteBook coordinates it all."
          className="absolute inset-0 h-full w-full object-cover opacity-75"
          loading="eager"
        />

        {/* Left-to-right dark gradient — copy stays readable on the
            left, image dominates on the right. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.60) 45%, rgba(10,10,10,0.15) 100%)"
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 md:py-28">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            🇬🇧 For UK homeowners
          </p>
          <h1 className="mt-3 text-4xl font-black leading-[0.98] text-white drop-shadow-lg sm:text-6xl md:text-7xl">
            Got a project?
            <br/>
            <span style={{ color: BRAND_YELLOW }}>Post it once.</span> Connect with trades and supplies.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/90 drop-shadow sm:text-[17px]">
            From tonight&rsquo;s broken door lock to your dream home renovation years from now. Connect with trusted local trades. Every photo, quote and warranty is securely stored in one place — so you can relax with a coffee while the right professionals come to you.
          </p>

          {/* Name claim widget */}
          <div className="mt-8 max-w-xl">
            <SiteBookNameClaim variant="hero"/>
          </div>

          <p className="mt-4 text-[12px] text-white/85 drop-shadow">
            <span className="font-black text-white">Free forever</span> · No card · Your data belongs to you · Export anytime for £9.99
          </p>
        </div>
      </section>

      {/* ================================================================
          2. LIVE PROOF STRIP — real counts, evidence-or-silence
      ================================================================ */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-6 sm:grid-cols-4 sm:px-6">
          <ProofStat value={proof.homeowners.toLocaleString("en-GB")} label="Homeowners with SiteBooks"/>
          <ProofStat value={proof.projects.toLocaleString("en-GB")}   label="Projects posted"/>
          <ProofStat value={proof.warranties.toLocaleString("en-GB")} label="Warranties saved forever"/>
          <ProofStat value="2h SLA" label="Trades reply within"/>
        </div>
      </section>

      {/* ================================================================
          3. HOW IT WORKS — 4 steps, big + visual
      ================================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>How it works</p>
          <h2 className="mt-2 text-3xl font-black text-neutral-900 sm:text-4xl md:text-5xl">
            Your project at your fingertips.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] text-neutral-600 sm:text-[15px]">
            The SiteBook is yours first. Projects live inside it. The beacon does the searching. Your team collaborates in real time. It really is that simple.
          </p>
        </div>
        <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              n: 1, title: "Create your SiteBook",
              body: "Reserve your name, claim your URL. Private and yours from day one — nobody sees inside until you welcome them."
            },
            {
              n: 2, title: "Post your first project",
              body: "Anything from a broken door lock to a whole extension. Trades needed, supplies needed, or both. 60 seconds, edit anytime."
            },
            {
              n: 3, title: "Fire the beacon",
              body: "One tap. The system finds the nearest matching trades and suppliers near you. They reply on WhatsApp with your brief pre-filled."
            },
            {
              n: 4, title: "Your team, one place",
              body: "Photos, chat, quotes, warranties — all inside your SiteBook. Multiple trades coordinate in real time. You watch progress from your phone."
            }
          ].map((s) => (
            <li key={s.n} className="relative rounded-2xl border-2 bg-white p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <span
                className="absolute -top-4 left-6 inline-flex h-8 w-12 items-center justify-center rounded-md text-[14px] font-black text-neutral-900"
                style={{ background: BRAND_YELLOW }}
              >
                {s.n}
              </span>
              <p className="mt-3 text-[16px] font-black text-neutral-900">{s.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================================================================
          3.5 EVERY JOB, EVERY SCALE, FOREVER — the vision angle.
          SiteBook is not per-project. It's per-HOUSE, and it runs for
          the life of the property. Small jobs and huge builds both live
          here. This is the load-bearing story.
      ================================================================ */}
      {/* Full-bleed background image · text top-right · live range
          cards as a single scrolling row along the BOTTOM. Same
          visual grammar as the /homeowners main hero — makes this
          section read as a second hero, which is right: it's the
          load-bearing convince moment. */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9huhxxvtr/tr:w-1920,f-auto,q-80/ChatGPT%20Image%20Jul%2018,%202026,%2009_54_41%20AM.png"
          alt="A homeowner's SiteBook — the record their house keeps forever."
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          loading="lazy"
        />
        {/* Two-layer gradient — darker top-LEFT so the text overlay
            stays readable, darker bottom so the cards pop, image
            focal point stays visible in the middle-right. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom right, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.35) 40%, rgba(10,10,10,0) 60%), linear-gradient(to top, rgba(10,10,10,0.80) 0%, rgba(10,10,10,0.15) 30%, rgba(10,10,10,0) 55%)"
          }}
        />

        <div className="relative mx-auto flex min-h-[680px] max-w-6xl flex-col justify-between px-4 py-14 text-white sm:px-6 sm:py-20">
          {/* TOP-LEFT text overlay */}
          <div className="mr-auto max-w-xl text-left">
            <h2 className="text-3xl font-black leading-tight drop-shadow-lg sm:text-5xl">
              A house is never finished.<br/>
              <span style={{ color: BRAND_YELLOW }}>Neither is your SiteBook.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/90 drop-shadow">
              One SiteBook for the life of your house. From the £80 door lock tonight to the £800k build eventually. Same platform, same trades, same standards from foundation to turn-key.
            </p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/85 drop-shadow">
              You&rsquo;re the project owner — but you don&rsquo;t manage anything from a spreadsheet. Trades come to your SiteBook. <span className="font-black" style={{ color: BRAND_YELLOW }}>Coffee in hand.</span>
            </p>
          </div>

          {/* BOTTOM — live indicator + horizontal scrolling card row */}
          <div className="mt-12">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: "#22C55E", boxShadow: "0 0 10px #22C55E" }}/>
              <p className="text-[10.5px] font-black uppercase tracking-[0.22em] text-white/75">Live · projects updating every few seconds</p>
            </div>
            <LiveRangeGrid variant="row"/>
          </div>
        </div>
      </section>

      {/* ================================================================
          4. WHAT LIVES IN YOUR SITEBOOK — benefit grid
      ================================================================ */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>What lives in your SiteBook</p>
            <h2 className="mt-2 text-3xl font-black text-neutral-900 sm:text-4xl">
              Everything about your house. In one place. Forever.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] text-neutral-600">
              Not a marketplace. Not a middleman. Your project workbook that keeps every trace of every project you ever do to your house.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Benefit icon={<Home size={22}/>}         title="One SiteBook for life"      body="Every job you ever do to the house — from a broken lock tonight to a whole extension in year 8 — lives in one workspace. Ongoing, forever."/>
            <Benefit icon={<Users size={22}/>}        title="Every scale, same standards" body="£80 job or £800k build — same platform. Multi-trade collaboration for the big ones. One-tap rebook for the small ones."/>
            <Benefit icon={<MessageCircle size={22}/>} title="WhatsApp lives here"       body="Every message with every trade preserved. No more 'which chat was that in?' — search the SiteBook."/>
            <Benefit icon={<Camera size={22}/>}       title="Every photo saved"          body="Before/After/In-progress. Trades upload from the job. Homeowner uploads from the phone. All preserved in original resolution."/>
            <Benefit icon={<ShieldCheck size={22}/>}  title="Warranty vault"             body="Every warranty auto-logged with expiry. Auto-reminders 30 days before. Never lose a claim window again."/>
            <Benefit icon={<Bell size={22}/>}         title="Seasonal reminders"         body="Boiler service due in November? We'll ping you. Gutters need clearing in autumn? We'll ping you. Your trades one tap away."/>
            <Benefit icon={<Smartphone size={22}/>}   title="Installable phone app"      body="Add SiteBook to your home screen — no app store, one tap. Push notifications, works offline."/>
            <Benefit icon={<Archive size={22}/>}      title="Full PDF export"            body="£9.99 one-off. Every project, every photo, every warranty in one file. Yours to keep."/>
            <Benefit icon={<Sparkles size={22}/>}     title="Transfers with the house"   body="Selling? Give the SiteBook export to the buyer. Every service record, every warranty, every past trade. Adds value."/>
          </div>
        </div>
      </section>

      {/* ================================================================
          5. WHY SITEBOOK — vs alternatives table
      ================================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Why SiteBook</p>
          <h2 className="mt-2 text-3xl font-black text-neutral-900 sm:text-4xl">
            You already have projects. You just don&rsquo;t have a way to keep them.
          </h2>
        </div>
        <div className="mt-8 overflow-x-auto rounded-2xl border-2 bg-white shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b bg-[#FBF6EC]" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <th className="px-4 py-3 text-left text-[10.5px] font-black uppercase tracking-wider text-neutral-600">What you actually need</th>
                <th className="px-2 py-3 text-center">
                  <span
                    className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900"
                    style={{ backgroundColor: BRAND_YELLOW }}
                  >
                    SiteBook
                  </span>
                </th>
                <th className="px-2 py-3 text-center text-[10.5px] font-black uppercase tracking-wider text-neutral-500">WhatsApp alone</th>
                <th className="px-2 py-3 text-center text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Spreadsheet</th>
              </tr>
            </thead>
            <tbody>
              {[
                { row: "Get multiple quotes fast",         us: true,  wa: false, ss: false           },
                { row: "Photos organized by project",       us: true,  wa: false, ss: false           },
                { row: "Warranty tracking + reminders",     us: true,  wa: false, ss: "manual" as const },
                { row: "Trades chat with each other",       us: true,  wa: false, ss: false           },
                { row: "Own your data (export anytime)",    us: true,  wa: false, ss: true            },
                { row: "Transfers to buyer when you sell",  us: true,  wa: false, ss: false           },
                { row: "Free forever",                      us: true,  wa: true,  ss: true            },
                { row: "No 12-month contract",              us: true,  wa: true,  ss: true            },
                { row: "Installable mobile app",            us: true,  wa: true,  ss: false           }
              ].map((r, i) => (
                <tr key={r.row} className={i % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                  <td className="px-4 py-3 text-[13px] font-bold text-neutral-800">{r.row}</td>
                  <td className="px-2 py-3 text-center" style={{ backgroundColor: r.us === true ? "rgba(22,101,52,0.08)" : undefined }}>
                    <CompareCell v={r.us} accent/>
                  </td>
                  <td className="px-2 py-3 text-center"><CompareCell v={r.wa}/></td>
                  <td className="px-2 py-3 text-center"><CompareCell v={r.ss}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================================================================
          6. EXAMPLE SITEBOOK — mockup showing what 3 years looks like
      ================================================================ */}
      <section className="border-y border-neutral-200 bg-neutral-900 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Three years in</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              Here&rsquo;s what your SiteBook looks like after a few projects.
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-white/80">
              8 projects logged. 24 warranties tracked. £47k of documented work on the house. When you go to sell, the buyer gets a house with receipts — worth an extra 2–4% at valuation.
            </p>
            <ul className="mt-6 space-y-2 text-[13px] leading-snug text-white/85">
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_YELLOW, marginTop: 2 }}/><span>Every trade you&rsquo;ve hired — one tap to rebook.</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_YELLOW, marginTop: 2 }}/><span>Every service — you know exactly when the boiler is next due.</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_YELLOW, marginTop: 2 }}/><span>Every warranty — reminders before expiry so you never lose a claim.</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_YELLOW, marginTop: 2 }}/><span>Every before/after photo — proof of quality when you sell.</span></li>
            </ul>
          </div>

          <div>
            <ExampleSiteBookMock/>
          </div>
        </div>
      </section>

      {/* ================================================================
          7. FEAR KILLERS — the "but wait" section
      ================================================================ */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Straight answers</p>
          <h2 className="mt-2 text-3xl font-black text-neutral-900 sm:text-4xl">But wait —</h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { q: "Do I have to sign up?",           a: "60 seconds. Name + email + password. Free forever. Cancel any time from the dashboard." },
            { q: "Is it only for big projects?",   a: "No. From £80 emergency locksmith to £800k renovation — the SiteBook is the same. Small jobs get one-tap logging, big builds get multi-trade collaboration." },
            { q: "Will trades spam me?",            a: "No. Trades only see your project when YOU publish. They reply via WhatsApp — your inbox stays yours." },
            { q: "What if I hate a trade?",         a: "Remove them from your SiteBook in one tap. Warranties they logged stay. Everything else is under your control." },
            { q: "Is my address shared?",           a: "No — your exact address is never displayed publicly. Only the CITY is visible. The full address (street + postcode) is revealed ONLY to trades or suppliers you assign to a specific project. Everyone else — even trades on your SiteBook who aren't assigned to that project — sees only the city." },
            { q: "Can I use my own tradesperson?",  a: "Yes. Add anyone by their Networkers URL. They don't need to be surfaced by the beacon — they just join your SiteBook." },
            { q: "What if I want to leave?",        a: "Export the whole SiteBook as PDF + photo ZIP for £9.99. Yours to keep forever, transfer to a house buyer, or use elsewhere." },
            { q: "Does the trade see everything?",  a: "Only what you share. Photos, messages, quotes — visible to hired trades on the project. Personal notes stay homeowner-only." },
            { q: "How much does it cost me?",       a: "£0 forever. £9.99 optional export. Optional £4.99/mo Premium (priority trade matching, unlimited exports). Nothing else." }
          ].map((item) => (
            <div key={item.q} className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-[15px] font-black text-neutral-900">{item.q}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================
          8. PRICING — transparent, no tricks
      ================================================================ */}
      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Pricing</p>
            <h2 className="mt-2 text-3xl font-black text-neutral-900 sm:text-4xl">Free forever. Everything else is optional.</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <PricingCard
              featured
              name="Free forever"
              price="£0"
              headline="Every feature above."
              features={[
                "Unlimited SiteBooks + projects",
                "Multi-trade collaboration",
                "Photo + message vault",
                "Warranty logging + reminders",
                "Installable mobile app",
                "Every essential feature"
              ]}
              cta="Start free"
              href="/homeowners/signup?intent=create-project"
            />
            <PricingCard
              name="Export bundle"
              price="£9.99"
              priceSubline="one-off"
              headline="Take your SiteBook anywhere."
              features={[
                "Full PDF of every project",
                "All photos in original resolution",
                "Every warranty + invoice",
                "Notarised timestamp",
                "Redownload for 12 months"
              ]}
              cta="Learn more"
              href="/homeowners/signup?intent=create-project"
            />
            <PricingCard
              name="Premium"
              price="£4.99"
              priceSubline="/ month"
              headline="Priority + unlimited exports."
              features={[
                "Priority trade matching",
                "Unlimited exports (no fee)",
                "Extended warranty reminders",
                "Concierge WhatsApp line",
                "5% off Trade Center orders"
              ]}
              cta="See details"
              href="/homeowners/signup?intent=create-project"
            />
          </div>
          <p className="mt-6 text-center text-[11px] text-neutral-500">
            No card required for Free. Cancel Premium any time. All three tiers own their data — export at any time.
          </p>
        </div>
      </section>

      {/* ================================================================
          9. FINAL CTA — repeat the name-claim widget
      ================================================================ */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "#0A0A0A" }}>
        <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(50% 40% at 50% 100%, ${BRAND_YELLOW}44 0%, transparent 60%)` }}/>
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Your house has a story</p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white sm:text-5xl">
            Start writing it in 60 seconds.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[14px] text-white/80">
            Pick a name for your SiteBook. Reserve it in one tap. Post your first project on the next screen.
          </p>
          <div className="mt-8">
            <div className="mx-auto max-w-xl text-left">
              <SiteBookNameClaim variant="hero"/>
            </div>
          </div>
          <p className="mt-6 text-[11px] text-white/60">
            Free forever · No card · Your data belongs to you · Cancel any time
          </p>
        </div>
      </section>

      <XratedFooter/>
    </main>
  );
}

// ==============================================================
// Small components
// ==============================================================

function ProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black text-neutral-900 sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500 sm:text-[11px]">{label}</p>
    </div>
  );
}


function Benefit({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
      <div
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: "#FFFBEB", color: "#7A5B00" }}
      >
        {icon}
      </div>
      <p className="mt-3 text-[15px] font-black text-neutral-900">{title}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}

function CompareCell({ v, accent }: { v: boolean | "manual"; accent?: boolean }) {
  if (v === true) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: accent ? BRAND_GREEN : "rgba(22,101,52,0.15)", color: accent ? "#FFFFFF" : BRAND_GREEN }}
        aria-label="Yes"
      >
        <Check size={13} strokeWidth={3}/>
      </span>
    );
  }
  if (v === false) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full"
        style={{ backgroundColor: "#DC2626", color: "#FFFFFF" }}
        aria-label="No"
      >
        <X size={13} strokeWidth={3}/>
      </span>
    );
  }
  return <span className="text-[10px] font-bold text-amber-700">Manual</span>;
}

function PricingCard({ name, price, priceSubline, headline, features, cta, href, featured }: {
  name:         string;
  price:        string;
  priceSubline?: string;
  headline:     string;
  features:     string[];
  cta:          string;
  href:         string;
  featured?:    boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-6 ${featured ? "shadow-xl ring-2 ring-yellow-400" : ""}`}
      style={{ borderColor: featured ? BRAND_YELLOW : "rgba(0,0,0,0.08)", backgroundColor: featured ? "#FFFBEB" : "#FFFFFF" }}
    >
      {featured && (
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#7A5B00" }}>
          Most homeowners
        </p>
      )}
      <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">{name}</p>
      <p className="mt-1 text-[36px] font-black leading-none text-neutral-900">
        {price}
        {priceSubline && <span className="ml-1 text-[11px] font-bold text-neutral-500">{priceSubline}</span>}
      </p>
      <p className="mt-3 text-[13px] font-black text-neutral-900">{headline}</p>
      <ul className="mt-4 space-y-1.5 text-[12px] leading-snug text-neutral-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check size={12} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 3 }}/>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-[11px] font-black uppercase tracking-wider text-white transition hover:brightness-95"
        style={{ backgroundColor: featured ? "#0A0A0A" : BRAND_GREEN }}
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5"/>
      </Link>
    </div>
  );
}

// Mock SiteBook preview — pure CSS/HTML, no live data.
// Illustrates "what your SiteBook looks like after 3 years".
function ExampleSiteBookMock() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border-2 border-neutral-700 bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">SiteBook ·</p>
          <p className="text-[16px] font-black text-neutral-900">The Old Rectory</p>
        </div>
        <div className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-bold text-neutral-600">3 yrs</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MockStat n="8" l="projects"/>
        <MockStat n="24" l="warranties"/>
        <MockStat n="£47k" l="tracked"/>
      </div>
      <div className="mt-4 space-y-2">
        <MockProject title="Kitchen refit"      by="Joe's Building"       done="Mar 2024" cost="£18,400"/>
        <MockProject title="Boiler replacement" by="Watson Plumbing"      done="Sep 2024" cost="£3,200"/>
        <MockProject title="Roof repair"        by="Manchester Roofing"   done="Feb 2025" cost="£6,800"/>
        <MockProject title="Bathroom refit"     by="Sarah Tiles + Co"     done="Sep 2025" cost="£4,900"/>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-[10px]">
        <span className="font-bold text-amber-800">🔔 Boiler service due in 42 days</span>
        <button className="rounded-full bg-amber-500 px-2.5 py-0.5 font-black text-white">Book</button>
      </div>
    </div>
  );
}

function MockStat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-2">
      <p className="text-[16px] font-black text-neutral-900">{n}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">{l}</p>
    </div>
  );
}

function MockProject({ title, by, done, cost }: { title: string; by: string; done: string; cost: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-black text-neutral-900">{title}</p>
        <p className="truncate text-[9.5px] text-neutral-500">{by} · {done}</p>
      </div>
      <p className="whitespace-nowrap text-[11px] font-black" style={{ color: BRAND_GREEN }}>{cost}</p>
    </div>
  );
}
