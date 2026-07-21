// /trade-off/every-channel — THE sales page. Answers the two biggest
// prospect questions in one scroll:
//   1. What does your system actually DO for me?
//   2. What does it cost per lead?
//
// Designed to be linked directly to a prospect. Combines:
//   - Global top-platform proof (three-region comparison headline)
//   - Full inventory of connection / project channels
//   - Per-lead cost transparency (1 washer = £0.05-£0.10 per verified
//     WhatsApp lead — 50-500x cheaper than competitors)
//   - Where their presence propagates (Google, own PWA, subdomain,
//     custom domain, Business Card, WhatsApp deep-link)
//   - Tier ladder from Free → The Works with what each unlocks
//
// Route deliberately outside /trade-off (which is the marketing
// landing) so it can be linked from admin outreach + WhatsApp
// without the visitor scrolling past the URL-claim hero.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Globe, Search, Bell, Users, ShoppingBag, Share2, MessageCircle, HandCoins, Pause, Sparkles, HelpCircle, Zap, Smartphone } from "lucide-react";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { REGION_SUMMARIES } from "@/data/comparisonSummary";

export const metadata: Metadata = {
  title:       "Every way you get work. Every cost. | Thenetworkers",
  description: "Every channel your Thenetworkers profile is discovered on, plus what each lead costs. Free tier joins every channel. Verified WhatsApp leads from £0.05 each.",
  robots:      { index: true, follow: true }
};

export const revalidate = 3600;

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";
const BRAND_AMBER  = "#F59E0B";

// ============================================================
// Channel inventory — grouped, with per-lead cost transparency.
// Every row cites the actual cost. "Included" = no per-lead fee.
// "1 washer" = £0.05-£0.10 per verified WhatsApp lead depending
// on washer pack tier (£4.99/50 = £0.10; £49.99/1000 = £0.05).
// ============================================================

type Channel = {
  name:      string;
  what:      string;
  cost:      "free" | "washer" | "tier" | "admin";
  costCopy:  string;
  tier:      string;
};

type ChannelGroup = {
  icon:  React.ReactNode;
  title: string;
  hint:  string;
  channels: Channel[];
};

const CHANNEL_GROUPS: ChannelGroup[] = [
  {
    icon:  <Globe size={20} strokeWidth={2.2}/>,
    title: "Direct discovery",
    hint:  "Customers find you first — your profile is the destination",
    channels: [
      { name: "Your own live URL",              what: "thenetworkers.app/{yourslug} — permanent, brandable",             cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Custom domain",                  what: "Point yourbrand.co.uk / .com at your profile",                    cost: "tier",    costCopy: "In Business tier",tier: "Business+" },
      { name: "Subdomain",                      what: "{yourslug}.thenetworkers.app auto-live from Day 1",               cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Own installable PWA",            what: "Your customers install YOUR branded app to their home screen",    cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Business Card modal + QR",       what: "One-tap WhatsApp share, printable QR for your van",               cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "WhatsApp deep-link",             what: "wa.me/ button on every page of your profile",                     cost: "free",    costCopy: "Included",       tier: "All tiers" }
    ]
  },
  {
    icon:  <Search size={20} strokeWidth={2.2}/>,
    title: "Search + SEO",
    hint:  "Google sends you traffic — 10,800+ pages indexed on your behalf",
    channels: [
      { name: "10,800 city × trade landings",   what: "Every UK city × every trade indexed on Google",                   cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "108 trade-category pages",       what: "Dedicated hub per trade — you appear in your category",           cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "100 city landing pages",         what: "Dedicated hub per city — you appear if you serve it",             cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "LocalBusiness + Service schema", what: "Rich results on Google — stars, service list, phone",             cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "/find directory search",         what: "Trade + city + postcode filter — your profile in results",        cost: "free",    costCopy: "Included",       tier: "All tiers" }
    ]
  },
  {
    icon:  <Bell size={20} strokeWidth={2.2}/>,
    title: "Project beacons",
    hint:  "Homeowners push work TO you — WhatsApp lead the moment they claim",
    channels: [
      { name: "Homeowner beacon (2h SLA)",      what: "Homeowner posts a job — nearest trades notified, first to claim wins", cost: "washer", costCopy: "1 washer per verified lead", tier: "Free tier includes 10/mo" },
      { name: "Push notification on claim",     what: "Native mobile alert on your PWA the moment a lead lands",         cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Missed-lead cascade",            what: "Unclaimed leads roll to more trades automatically",               cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "/find/beacon customer ping",     what: "Customer pings 3 nearest trades in one tap",                      cost: "washer",  costCopy: "1 washer per verified lead", tier: "Free tier includes 10/mo" },
      { name: "5-slot beacon fanout",           what: "Business-tier merchants get priority in beacon distribution",     cost: "tier",    costCopy: "In Business tier", tier: "Business+" }
    ]
  },
  {
    icon:  <Users size={20} strokeWidth={2.2}/>,
    title: "Community + your canteen",
    hint:  "Real trades talking, your live feed",
    channels: [
      { name: "The Yard feed",                  what: "Post work, questions, replies — full trade community",            cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Boosted Yard posts",             what: "Priority placement in the feed — pay washers to promote",         cost: "washer",  costCopy: "~5 washers per day boost", tier: "Paid tiers" },
      { name: "Your canteen page",              what: "Live community hub for YOUR customers — feed + shop",             cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Trade Circle carousel",          what: "Cross-trade discovery — appear on complementary trade profiles",   cost: "tier",    costCopy: "In Pro tier",    tier: "Pro+" }
    ]
  },
  {
    icon:  <ShoppingBag size={20} strokeWidth={2.2}/>,
    title: "Marketplace + install leads",
    hint:  "Product PDPs generate fitter leads",
    channels: [
      { name: "Trade Center product PDPs",      what: "Customers browse merchant products — you appear as fitter",       cost: "free",    costCopy: "Included",       tier: "All tiers" },
      { name: "Install leads inbox",            what: "Shoppers pick you as their fitter at PDP checkout",               cost: "washer",  costCopy: "1 washer per verified lead", tier: "Free tier includes 10/mo" },
      { name: "AI Visualiser lead",             what: "Customer uploads room photo → AI suggests trades → your WhatsApp",cost: "washer",  costCopy: "1 washer per verified lead", tier: "Pro tier · 5 uses/mo" },
      { name: "Product carousels",              what: "Cross-trade discovery via product pages",                          cost: "free",    costCopy: "Included",       tier: "All tiers" }
    ]
  },
  {
    icon:  <Share2 size={20} strokeWidth={2.2}/>,
    title: "Cross-merchant referrals",
    hint:  "Trades hand you work — network effects",
    channels: [
      { name: "Materials Network",              what: "Merchants refer you supply jobs when their kit is ordered",       cost: "washer",  costCopy: "1 washer per verified lead", tier: "Free tier includes 10/mo" },
      { name: "Inspiration image → 3 trades",   what: "Customer taps an image, 3 nearest matching trades routed",        cost: "washer",  costCopy: "1 washer per verified lead", tier: "Free tier includes 10/mo" },
      { name: "Featured Placements",            what: "Top-of-feed slots managed by our admin team",                     cost: "admin",   costCopy: "Application-based", tier: "All tiers eligible" },
      { name: "Merchant-to-merchant invites",   what: "Refer a merchant with ?mref=yourslug — 50 free washers on join",  cost: "free",    costCopy: "+50 washers per successful referral", tier: "All tiers" }
    ]
  }
];

const totalChannels = CHANNEL_GROUPS.reduce((n, g) => n + g.channels.length, 0);

export default function EveryChannelPage() {
  return (
    <main className="min-h-screen pb-24" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Link href="/trade-off" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-neutral-600 hover:text-neutral-900">
          <ArrowLeft size={13} strokeWidth={2.4}/>
          Back to Thenetworkers
        </Link>

        {/* Hero */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            The whole scorecard
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-[1.05] text-neutral-900 sm:text-4xl md:text-5xl">
            Every way you get work.{" "}
            <span style={{ color: BRAND_YELLOW }}>Every cost.</span>{" "}
            One page.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-700 sm:text-base">
            {totalChannels} live channels your Thenetworkers profile is discovered on. Transparent price per verified WhatsApp lead. Global top-scored platform (UK · USA · Australia — see charts). Free tier joins every channel from day one.
          </p>
        </div>

        {/* Global proof strip — condensed 3-region headline */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {REGION_SUMMARIES.map((r) => {
            const usCount = r.rows.filter((row) => row.us === true).length;
            return (
              <Link
                key={r.key}
                href={r.reportHref}
                className="group rounded-2xl border p-4 transition hover:border-neutral-900"
                style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none">{r.flag}</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                    {r.regionLabel} · {r.competitors.length} competitors surveyed
                  </p>
                </div>
                <p className="mt-2 text-[22px] font-black leading-tight text-neutral-900">
                  {usCount} of {r.rows.length}
                </p>
                <p className="text-[12px] font-bold text-neutral-700">
                  features live on Networkers
                </p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN }}>
                  See full report →
                </p>
              </Link>
            );
          })}
        </div>

        {/* Headline cost bombshell */}
        <div className="mt-8 rounded-2xl border p-6 sm:p-8" style={{ borderColor: BRAND_YELLOW, backgroundColor: "#FFFBEB" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7A5B00]">
            Per-lead cost — the number that matters
          </p>
          <p className="mt-2 text-[24px] font-black leading-tight text-neutral-900 sm:text-[32px]">
            <span style={{ color: BRAND_GREEN }}>£0.05–£0.10</span> per verified WhatsApp lead.
          </p>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
            1 washer = 1 verified customer WhatsApp — the customer has typed their name, contact, and job details before you&rsquo;re charged.
            Washer packs from £4.99 (50 washers · £0.10 each) down to £49.99 (1,000 washers · £0.05 each).
            Free tier includes 10 washers/month, forever.
          </p>
          {/* Verified-only sub-bullet — differentiator vs Bark
              (charges credits on connect) + Angi (charges when the lead
              is sent, even if the customer never replies). */}
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border p-3" style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#ECFDF5" }}>
            <Check size={16} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/>
            <p className="text-[12px] leading-snug text-neutral-800">
              <span className="font-black">Washer only charges on VERIFIED.</span> The customer must type their name, WhatsApp number, and job details before your washer is debited. If they ghost, no charge — unlike Bark (charges on connect) or Angi (charges on lead-send even if the customer never replies).
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CompCostChip label="Checkatrade UK"  price="£5–£40 / lead"/>
            <CompCostChip label="MyBuilder UK"    price="£5–£50 / lead"/>
            <CompCostChip label="Angi USA"        price="$15–$120 / lead"/>
            <CompCostChip label="Hipages AU"      price="A$30–A$80 / lead"/>
          </div>
          <p className="mt-4 text-[11px] leading-snug text-neutral-500">
            Verified competitor pricing 2026-07-18 from each platform&rsquo;s public docs. See{" "}
            <Link href="/trade-off/compare-platforms" className="underline">UK</Link>,{" "}
            <Link href="/trade-off/us/compare-platforms" className="underline">USA</Link> and{" "}
            <Link href="/trade-off/au/compare-platforms" className="underline">Australia</Link> full reports.
          </p>
        </div>

        {/* Section — What a verified lead looks like. Visual proof of
            the abstract "verified WhatsApp lead" claim. CSS mockup —
            no photo dependencies, no rights issues. */}
        <div className="mt-12 grid grid-cols-1 items-center gap-8 sm:grid-cols-2 sm:gap-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
              What a lead actually looks like
            </p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
              The customer arrives on your WhatsApp already qualified.
            </h2>
            <ul className="mt-4 space-y-2 text-[13px] leading-snug text-neutral-700">
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>Real name (typed by them, not scraped)</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>WhatsApp number verified via wa.me click-through</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>Job type + postcode + timeline pre-filled</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>Budget bracket where the customer offered one</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>Photos of the job if they attached any</span></li>
            </ul>
            <p className="mt-4 text-[12px] leading-snug text-neutral-600">
              No lead-swapping. No 8 tradies fighting over one message. Direct-to-you, first-come-first-quote. If they don&rsquo;t reply, you don&rsquo;t pay.
            </p>
          </div>
          {/* WhatsApp-style mockup — pure CSS/HTML, no image asset */}
          <div className="relative mx-auto w-full max-w-[320px]">
            <div className="overflow-hidden rounded-[28px] border-4 border-neutral-900 bg-white shadow-2xl">
              {/* WhatsApp header */}
              <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-black text-white">SK</div>
                <div>
                  <p className="text-[13px] font-bold text-white">Sarah K.</p>
                  <p className="text-[10px] text-white/70">online · via Thenetworkers</p>
                </div>
              </div>
              {/* Chat body */}
              <div className="space-y-2 bg-[#ECE5DD] px-3 py-4">
                <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-[#DCF8C6] px-3 py-2 shadow-sm">
                  <p className="text-[11.5px] font-black text-neutral-900">New lead via Thenetworkers 🔔</p>
                  <div className="mt-2 space-y-1 text-[11px] leading-snug text-neutral-800">
                    <p><span className="font-black">Name:</span> Sarah K.</p>
                    <p><span className="font-black">Area:</span> M1 5EQ · Manchester city centre</p>
                    <p><span className="font-black">Trade needed:</span> Bathroom fitting</p>
                    <p><span className="font-black">Timeline:</span> Next 3-4 weeks</p>
                    <p><span className="font-black">Budget:</span> £3-5k range</p>
                    <p className="pt-1 italic text-neutral-600">&ldquo;Small en-suite. Tiles + toilet + basin. Photo attached.&rdquo;</p>
                  </div>
                  <p className="mt-1.5 text-right text-[9px] text-neutral-500">14:22 ✓✓</p>
                </div>
              </div>
              {/* WhatsApp input */}
              <div className="flex items-center gap-2 bg-white px-3 py-2">
                <div className="flex-1 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] text-neutral-400">Reply to Sarah...</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#075E54]">
                  <MessageCircle size={14} strokeWidth={2.4} className="text-white"/>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              A real lead · 1 washer · £0.05–£0.10
            </p>
          </div>
        </div>

        {/* Section — What happens AFTER the lead. The critical trust
            differentiator: Networkers stays OUT of the money loop. */}
        <div className="mt-14 rounded-2xl border p-6 sm:p-8" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            After the lead
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            You own the customer.{" "}
            <span style={{ color: BRAND_GREEN }}>We never touch the money.</span>
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] text-neutral-700 sm:text-sm">
            Once the lead lands, Networkers steps out. You quote directly, invoice directly, take payment directly. Unlike Checkatrade / Angi / Hipages we do <span className="font-black text-neutral-900">not</span> insert ourselves between you and your customer — no commission, no held funds, no dispute-management-as-a-service.
          </p>
          <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { n: 1, title: "Customer lands in WhatsApp",  body: "With their name, postcode, job details and any photos pre-filled by the beacon form. You reply on your normal WhatsApp." },
              { n: 2, title: "You quote + invoice direct",  body: "Your quote, your terms, your invoice. Use your existing tools — we don't force a payment provider on you." },
              { n: 3, title: "You keep 100% of the job",    body: "No commission. No skim. No held funds. The relationship is yours — we're the introducer, not the middleman." }
            ].map((step) => (
              <li key={step.n} className="relative rounded-xl border p-4" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFBEB" }}>
                <span className="absolute -top-3 left-4 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
                  {step.n}
                </span>
                <p className="mt-1 text-[13px] font-black text-neutral-900">{step.title}</p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-neutral-700">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border p-3" style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#ECFDF5" }}>
            <HandCoins size={16} strokeWidth={2.4} style={{ color: BRAND_GREEN, marginTop: 2 }}/>
            <p className="text-[12px] leading-snug text-neutral-800">
              <span className="font-black">Zero regulated activity.</span> We are never the counterparty, publisher-of-record, fund-holder, credit reference agency, insurer, or financial adviser. You are the tradesperson, the customer is your customer, and we introduce.
            </p>
          </div>
        </div>

        {/* Section — How the beacon ranks you. Anti-Checkatrade weapon:
            no auction, no pay-to-win. Everything the ranking uses is
            earned, not bought. */}
        <div className="mt-14 rounded-2xl border p-6 sm:p-8" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            How we rank you
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            No auction. No pay-to-win.{" "}
            <span style={{ color: BRAND_GREEN }}>Just the customer&rsquo;s best match.</span>
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] text-neutral-700 sm:text-sm">
            When a beacon fires, the customer sees the nearest trades in this specific ranking. You cannot buy a higher position. Business-tier merchants get a larger slot fanout (5 vs 3) but the rank-order itself is earned.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Distance",         desc: "Nearest to the job postcode wins. Local first." },
              { title: "Response time",    desc: "Historical speed to first WhatsApp reply. Fast responders climb." },
              { title: "Recent reviews",   desc: "Verified reviews from the last 90 days weigh heavier than old ones." },
              { title: "Trade match",      desc: "Exact-trade match beats adjacent-trade match. Bathroom fitter beats general builder for bathroom jobs." }
            ].map((f) => (
              <div key={f.title} className="rounded-xl border p-4" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
                <p className="text-[12px] font-black uppercase tracking-wider" style={{ color: BRAND_GREEN }}>{f.title}</p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-neutral-700">{f.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-snug text-neutral-500">
            What&rsquo;s NOT in the ranking: how much you spend with us, how long you&rsquo;ve been a customer, whether you bought an ad, whether you upgraded your tier. This is the rule.
          </p>
        </div>

        {/* Channel inventory — the meat */}
        <div className="mt-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            Every channel
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            {totalChannels} live surfaces your profile is discovered on.
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] text-neutral-700 sm:text-sm">
            Grouped by how the customer reaches you. Cost per channel is explicit — if it says &ldquo;Included&rdquo; there is <span className="font-black text-neutral-900">no per-lead charge</span>. If it says &ldquo;1 washer&rdquo; the customer has verified themselves via WhatsApp before you&rsquo;re billed.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {CHANNEL_GROUPS.map((g) => (
              <div key={g.title} className="rounded-2xl border p-5 shadow-sm" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "#FFFBEB", color: "#7A5B00" }}>
                    {g.icon}
                  </span>
                  <div>
                    <p className="text-[15px] font-black text-neutral-900">{g.title}</p>
                    <p className="text-[11px] text-neutral-600">{g.hint}</p>
                  </div>
                </div>
                <ul className="mt-4 divide-y" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  {g.channels.map((c) => (
                    <li key={c.name} className="grid grid-cols-[1fr_auto] gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-[13px] font-black text-neutral-900">{c.name}</p>
                        <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-600">{c.what}</p>
                      </div>
                      <div className="text-right">
                        <CostBadge type={c.cost} label={c.costCopy}/>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {c.tier}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Section — Own-branded PWA. Philip specifically flagged the
            "template company app" angle. Visual mockup of the
            merchant's own installable app on a phone home screen. */}
        <div className="mt-14 grid grid-cols-1 items-center gap-8 sm:grid-cols-2 sm:gap-10">
          {/* Phone home-screen mockup */}
          <div className="relative mx-auto order-2 w-full max-w-[300px] sm:order-1">
            <div className="overflow-hidden rounded-[36px] border-[6px] border-neutral-900 bg-gradient-to-br from-orange-200 via-pink-200 to-purple-300 p-4 shadow-2xl">
              {/* Status bar */}
              <div className="flex items-center justify-between text-[9px] font-bold text-white">
                <span>14:22</span>
                <div className="flex items-center gap-1">
                  <span>••••</span><span>◱</span><span>▮</span>
                </div>
              </div>
              {/* App grid — highlighted app is the merchant's */}
              <div className="mt-8 grid grid-cols-4 gap-4">
                {[
                  { label: "Messages", bg: "#22C55E", icon: "💬" },
                  { label: "Mail",     bg: "#3B82F6", icon: "✉️" },
                  { label: "Photos",   bg: "#EC4899", icon: "🌸" },
                  { label: "Camera",   bg: "#404040", icon: "📷" },
                  { label: "Maps",     bg: "#10B981", icon: "🗺️" },
                  { label: "Weather",  bg: "#0EA5E9", icon: "☁️" },
                  { label: "Clock",    bg: "#0A0A0A", icon: "⏰" },
                  { label: "Settings", bg: "#71717A", icon: "⚙️" }
                ].map((app) => (
                  <div key={app.label} className="flex flex-col items-center gap-1">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg shadow-md" style={{ backgroundColor: app.bg }}>
                      {app.icon}
                    </div>
                    <span className="text-[8px] font-medium text-white/90">{app.label}</span>
                  </div>
                ))}
                {/* MERCHANT'S APP — highlighted with subtle glow */}
                <div className="relative flex flex-col items-center gap-1">
                  <div
                    className="networkers-tick-heartbeat flex h-11 w-11 items-center justify-center rounded-xl text-[10px] font-black text-neutral-900 shadow-lg ring-2 ring-white"
                    style={{ backgroundColor: BRAND_YELLOW }}
                    aria-label="Merchant's own branded app icon"
                  >
                    M&nbsp;P
                  </div>
                  <span className="text-[8px] font-black text-white">Mike&rsquo;s</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/40 text-lg">📞</div>
                  <span className="text-[8px] font-medium text-white/90">Phone</span>
                </div>
              </div>
              {/* Home indicator */}
              <div className="mx-auto mt-8 h-1 w-24 rounded-full bg-white/60"/>
            </div>
            <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              Your app · your logo · your colour · your home screen
            </p>
          </div>
          <div className="order-1 sm:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
              Your own installable app
            </p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
              A branded PWA your customers install{" "}
              <span style={{ color: BRAND_YELLOW }}>to their home screen.</span>
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
              Not our app with your name on it. YOUR app. Your logo. Your colour palette. Your service list. Your booking form. Your reviews. Installed on the customer&rsquo;s phone home screen — one tap to reach you, forever.
            </p>
            <ul className="mt-4 space-y-2 text-[13px] leading-snug text-neutral-700">
              <li className="flex items-start gap-2"><Smartphone size={14} strokeWidth={2.4} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>iOS + Android + desktop — one PWA, everywhere</span></li>
              <li className="flex items-start gap-2"><Sparkles size={14} strokeWidth={2.4} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>Push notifications for reviews, replies, beacon leads</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>No app-store review process. Install from your URL.</span></li>
              <li className="flex items-start gap-2"><Check size={14} strokeWidth={3} style={{ color: BRAND_GREEN, marginTop: 2 }}/><span>Available from the Free tier. Not gated behind Pro.</span></li>
            </ul>
          </div>
        </div>

        {/* Tier ladder */}
        <div className="mt-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            What each tier unlocks
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            From free forever to unlimited leads.
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] text-neutral-700 sm:text-sm">
            Every tier joins every channel. Tier only changes the washer allowance (verified-lead volume) + a few premium tools.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TierCard name="Free"         price="£0"      washers="10 / mo"     highlight="Your URL, PWA, every channel access — forever"          featured={false}/>
            <TierCard name="Starter"      price="£9.99"   washers="50 / mo"     highlight="Unlimited products + all 20 UK material calculators"     featured={false}/>
            <TierCard name="Professional" price="£14.99"  washers="200 / mo"    highlight="AI Visualiser 5 uses/mo + Analytics"                     featured={true}/>
            <TierCard name="Business"     price="£24.99"  washers="1,000 / mo"  highlight="Custom domain + 5-slot beacon + multi-user"              featured={false}/>
            <TierCard name="The Works"    price="£39.99"  washers="Unlimited"   highlight="Merchant Pro bundle + priority everything"               featured={false}/>
          </div>

          <p className="mt-4 text-[11px] leading-snug text-neutral-500">
            Annual pricing available at ~2 months free. Full breakdown at{" "}
            <Link href="/trade-off/pricing" className="underline">/trade-off/pricing</Link>.
            Washer packs top-up any tier: £4.99/50 · £14.99/200 · £49.99/1,000.
          </p>
        </div>

        {/* Section — Setup time + done-for-you. Handles the "I'm not
            tech-savvy" objection for older tradies. */}
        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border p-6" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
            <div className="flex items-center gap-2.5">
              <Zap size={20} strokeWidth={2.2} style={{ color: BRAND_YELLOW }}/>
              <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Self-serve</p>
            </div>
            <p className="mt-3 text-[22px] font-black leading-tight text-neutral-900">5-minute setup.</p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-neutral-700">
              Type your slug. Add your WhatsApp + logo + 3 photos. Publish. Every field has a help tooltip and you can skip anything and come back later.
            </p>
            <Link href="/trade-off/signup" className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-sm hover:brightness-95" style={{ backgroundColor: BRAND_GREEN }}>
              Start free →
            </Link>
          </div>
          <div className="rounded-2xl border p-6" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FBF6EC" }}>
            <div className="flex items-center gap-2.5">
              <HandCoins size={20} strokeWidth={2.2} style={{ color: BRAND_AMBER }}/>
              <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">Done for you</p>
            </div>
            <p className="mt-3 text-[22px] font-black leading-tight text-neutral-900">We build it for you.</p>
            <p className="mt-1.5 text-[12.5px] leading-snug text-neutral-700">
              Send us your WhatsApp, logo and photos on WhatsApp — we build your profile end-to-end. £297 essentials · £597 with photography edit · £997 with services + gallery + testimonial content. 3–5 day SLA.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-neutral-700 shadow-sm">£297</span>
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-neutral-700 shadow-sm">£597</span>
              <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-neutral-700 shadow-sm">£997</span>
            </div>
          </div>
        </div>

        {/* Section — Cancel / pause / no-lock-in. Removes the
            "am I trapped?" anxiety that kills signups everywhere else. */}
        <div className="mt-6 rounded-2xl border-2 p-6" style={{ borderColor: "rgba(22,101,52,0.30)", backgroundColor: "#ECFDF5" }}>
          <div className="flex items-start gap-3">
            <Pause size={22} strokeWidth={2.4} style={{ color: BRAND_GREEN, marginTop: 2 }}/>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#166534]">
                No lock-in · Pause any time
              </p>
              <p className="mt-2 text-[16px] font-black text-neutral-900 sm:text-[18px]">
                Free tier is free forever. Paid tiers pause any time from the dashboard.
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-700">
                No 12-month contracts (unlike Checkatrade + TrustATrader). No cancellation fees.
                Your URL stays live and your customers keep finding you even on a paused plan — you just stop getting the paid features and washer allowance until you resume.
                Cancel means cancel — no &ldquo;are you sure&rdquo; loops. Your data stays exportable for 90 days.
              </p>
            </div>
          </div>
        </div>

        {/* Section — FAQ. Bluntest six questions we get, two-sentence
            answers. Kills the last objections before the CTA. */}
        <div className="mt-14">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
            The blunt questions
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            Straight answers.
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { q: "Am I locked in?",                          a: "No. Free tier is free forever with no card. Paid tiers pause any time from the dashboard — no contract, no cancellation fee." },
              { q: "What if I get zero leads?",                a: "You keep your URL, PWA, canteen and full profile for free forever. If a paid tier isn't earning its keep for you, pause it. We don't hold your presence hostage." },
              { q: "Who owns my customers?",                   a: "You do. Networkers introduces the customer to your WhatsApp then steps out. We don't hold funds, take commission, or manage the transaction." },
              { q: "Do you take a commission on jobs?",        a: "No. Not on the first job. Not on the tenth. Not on any tier. Our revenue is the washer packs + optional tier subscription — that's it." },
              { q: "Can I use my own domain?",                 a: "Yes on the Business tier (£24.99/mo) — point your own .co.uk or .com at your profile. Free / Starter / Pro tiers get thenetworkers.app/{yourslug} + a free subdomain." },
              { q: "What if a lead is a time-waster?",         a: "Report it in the dashboard — we refund the washer if the lead was fake / ghosted / clearly out-of-scope. Our verified-only charge model is designed to prevent this in the first place." }
            ].map((item) => (
              <div key={item.q} className="rounded-2xl border p-5" style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFFFFF" }}>
                <div className="flex items-start gap-2.5">
                  <HelpCircle size={16} strokeWidth={2.4} style={{ color: BRAND_YELLOW, marginTop: 2 }}/>
                  <p className="text-[13px] font-black text-neutral-900">{item.q}</p>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-neutral-700">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-14 rounded-2xl border-2 p-8 text-center" style={{ borderColor: BRAND_GREEN, backgroundColor: "#ECFDF5" }}>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#166534]">
            Ready to join every channel
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
            Free forever. Every channel. No card. Start in 60 seconds.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-neutral-700">
            Type your slug. Get your own URL, PWA, canteen, Yard access, beacon eligibility. Upgrade only when you want more washers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full px-6 text-[12px] font-black uppercase tracking-wider text-white transition hover:brightness-95"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              Join Networkers — free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </Link>
            <Link
              href="/trade-off"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 text-[12px] font-bold uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-50"
            >
              See the full comparison charts
            </Link>
          </div>
        </div>
      </section>

      <XratedFooter/>
    </main>
  );
}

function CostBadge({ type, label }: { type: Channel["cost"]; label: string }) {
  const styles: Record<Channel["cost"], { bg: string; text: string }> = {
    free:   { bg: "rgba(22,101,52,0.10)",  text: BRAND_GREEN },
    washer: { bg: "rgba(245,158,11,0.15)", text: "#B45309" },
    tier:   { bg: "rgba(255,179,0,0.15)",  text: "#7A5B00" },
    admin:  { bg: "rgba(0,0,0,0.06)",      text: "#404040" }
  };
  const s = styles[type];
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {label}
    </span>
  );
}

function CompCostChip({ label, price }: { label: string; price: string }) {
  return (
    <div className="rounded-lg bg-white/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-black text-neutral-900">{price}</p>
    </div>
  );
}

function TierCard({ name, price, washers, highlight, featured }: { name: string; price: string; washers: string; highlight: string; featured: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${featured ? "ring-2 ring-yellow-400" : ""}`}
      style={{
        borderColor: "rgba(0,0,0,0.08)",
        backgroundColor: featured ? "#FFFBEB" : "#FFFFFF"
      }}
    >
      {featured && (
        <p className="mb-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: BRAND_AMBER }}>
          Most popular
        </p>
      )}
      <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">{name}</p>
      <p className="mt-1 text-[22px] font-black text-neutral-900">
        {price}<span className="text-[11px] font-bold text-neutral-500"> / mo</span>
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-neutral-700">
        <Check size={12} strokeWidth={3} style={{ color: BRAND_GREEN }}/>
        {washers}
      </p>
      <p className="mt-3 text-[11.5px] leading-snug text-neutral-600">{highlight}</p>
    </div>
  );
}
