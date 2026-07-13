// /why/trades — the strategic case for trades to join.
//
// Sister page to /why (homeowner-focused). Voice: trades-native,
// direct, no ties or ribbons. Anti-algorithm angle. Every superlative
// converted to a concrete claim we can back — no "world's most
// advanced", no invented numbers. Features labelled honestly as
// LIVE / BETA / PLANNED so we never promise what isn't shipped.

import Link from "next/link";
import {
  ArrowRight,
  Hammer,
  Wrench,
  Store,
  Users,
  MessageCircle,
  Zap,
  Handshake,
  Radio,
  Package,
  Calculator,
  CheckCircle2,
  XCircle,
  Sparkles,
  Info
} from "lucide-react";

export const metadata = {
  title: "For trades · Thenetworkers",
  description:
    "One network. One profile. One community. The UK's construction relationship platform — everything your trade business needs, built by trades for trades."
};

const PALETTE = {
  cream: "#FBF6EC",
  ink: "#1B1A17",
  inkSoft: "rgba(27,26,23,0.72)",
  inkMuted: "rgba(27,26,23,0.55)",
  honey: "#B8860B",
  honeyBright: "#FFB300",
  paperLine: "rgba(184,134,11,0.10)",
  divider: "rgba(27,26,23,0.10)",
  green: "#0F7A3D",
  red: "#8B0F0F"
};

export default function WhyTradesPage() {
  return (
    <main
      className="relative min-h-screen"
      style={{ backgroundColor: PALETTE.cream, color: PALETTE.ink }}
    >
      {/* Paper-rule background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent 47px, ${PALETTE.paperLine} 48px)`,
          backgroundSize: "100% 48px",
          opacity: 0.5
        }}
      />

      {/* Header */}
      <div className="relative mx-auto max-w-[1100px] px-5 py-5 md:px-10 md:py-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honey }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: PALETTE.honeyBright }}
            />
            Thenetworkers
          </Link>
          <nav className="flex items-center gap-4 text-[13px] font-semibold">
            <Link
              href="/why"
              className="hidden underline-offset-4 hover:underline sm:inline"
              style={{ color: PALETTE.ink }}
            >
              For homeowners
            </Link>
            <Link
              href="/join/start"
              className="rounded-full px-4 py-1.5"
              style={{
                backgroundColor: PALETTE.honeyBright,
                color: PALETTE.ink
              }}
            >
              Join free
            </Link>
          </nav>
        </div>
      </div>

      <div className="relative mx-auto max-w-[900px] px-5 pb-24 md:px-10">
        {/* Hero */}
        <section className="pt-6 md:pt-10">
          <p
            className="text-[12px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honey }}
          >
            Why join as a Trade
          </p>
          <h1 className="mt-4 text-[38px] font-black leading-[1.0] tracking-tight md:text-[64px]">
            One network.<br />
            One profile.<br />
            <span style={{ color: PALETTE.honey }}>
              One community.
            </span>
          </h1>
          <p
            className="mt-6 max-w-[58ch] text-[16px] leading-[1.6] md:text-[18px]"
            style={{ color: PALETTE.inkSoft }}
          >
            The UK&apos;s trade network — not a marketplace where you list
            and disappear, but a relationship platform where every customer,
            follower, endorsement, comment, and completed job compounds
            over time. Buying and selling are two things that happen here.
            Belonging is the rest.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/join/start"
              className="group inline-flex min-h-[56px] items-center gap-3 rounded-full pl-6 pr-4 text-[15px] font-black shadow-lg"
              style={{
                backgroundColor: PALETTE.honeyBright,
                color: PALETTE.ink
              }}
            >
              Get my free app
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
                style={{ backgroundColor: PALETTE.ink, color: PALETTE.cream }}
                aria-hidden
              >
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <span
              className="text-[13px] font-semibold"
              style={{ color: PALETTE.inkMuted }}
            >
              3 minutes · No card required
            </span>
          </div>
        </section>

        {/* The old playbook is dead */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="The old playbook is dead">
            You&apos;re competing against algorithms
          </SectionHeading>

          <div className="mt-8 space-y-4">
            <HonestyRow
              icon={<XCircle className="h-5 w-5" />}
              title="A website that no-one finds"
              body="You built or paid for a site, then waited. Google put it on page 8 behind three directories and a Yell listing. Traffic never came. Sound familiar?"
            />
            <HonestyRow
              icon={<XCircle className="h-5 w-5" />}
              title="Social posts that hit 4 people"
              body="Instagram and TikTok throttle organic reach for anyone who isn't already big. Facebook prioritises paid. You post a finished bathroom, it gets 12 views, none of them customers."
            />
            <HonestyRow
              icon={<XCircle className="h-5 w-5" />}
              title="Directory sites that sell your lead five times"
              body="You pay for a lead. So do four other trades. The homeowner is now getting rung by five vans. You quote against everyone. Race to the bottom."
            />
          </div>

          <p
            className="mt-6 rounded-2xl border p-4 text-[13px] leading-[1.55]"
            style={{
              borderColor: PALETTE.divider,
              backgroundColor: "rgba(184,134,11,0.06)",
              color: PALETTE.inkSoft
            }}
          >
            <Info
              className="mr-1.5 inline h-4 w-4 align-text-bottom"
              style={{ color: PALETTE.honey }}
              aria-hidden
            />
            None of the above is a made-up problem. It&apos;s how the internet
            currently works for tradespeople. We didn&apos;t invent a new
            enemy — we built a different route around one you already know.
          </p>
        </section>

        {/* What we built instead */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="What we built instead">
            The route that doesn&apos;t rely on luck
          </SectionHeading>

          <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
            <FeatureCard
              status="live"
              icon={<Hammer className="h-5 w-5" />}
              title="Your own app · free forever"
              body="Not a listing on someone else's site. Your own live page at yourname.theconstructionnotebook.com — with photos, services, WhatsApp button. Drop the link in your Instagram, TikTok, Facebook bio and every social visitor becomes a WhatsApp enquiry."
            />
            <FeatureCard
              status="live"
              icon={<Radio className="h-5 w-5" />}
              title="The Yard"
              body="A live feed for trades only. Post 'I'm available Wed–Fri in Manchester', 'need a plasterer for a two-day skim', 'tools for sale'. Traffic runs through it daily. No algorithm decides who sees you — every trade in your region does."
            />
            <FeatureCard
              status="live"
              icon={<Users className="h-5 w-5" />}
              title="Trade Circle"
              body="Endorse the sparky, joiner, plumber you actually rate. Get endorsed back. Your Circle appears on your profile, their Circle appears on theirs — one honest network of trades who vouch for each other, at scale."
            />
            <FeatureCard
              status="beta"
              icon={<Handshake className="h-5 w-5" />}
              title="Direct project alerts"
              body="Homeowners submit projects with a postcode and a trade. We route those directly to matched trades in the area — not a lead we sell five times, one clean match. Free tier gets 3/month, paid tiers get uncapped."
            />
            <FeatureCard
              status="live"
              icon={<Store className="h-5 w-5" />}
              title="App Warehouse"
              body="Calculators, checkout forms, quote generators, plant-hire panels — construction-specific apps you install into your profile in one click. Bricks-per-square-metre, paint-per-wall, gravel-per-driveway. Free apps and paid apps."
            />
            <FeatureCard
              status="planned"
              icon={<Package className="h-5 w-5" />}
              title="Discounted trade supplies"
              body="A back-office panel in your dashboard where trade discounts near you show up automatically. Never miss a Travis Perkins or Screwfix trade offer that expires Friday. We&apos;re wiring this in — not shipped yet."
            />
          </div>

          <p
            className="mt-6 rounded-2xl border p-4 text-[13px] leading-[1.55]"
            style={{
              borderColor: PALETTE.divider,
              backgroundColor: "rgba(184,134,11,0.06)",
              color: PALETTE.inkSoft
            }}
          >
            <Info
              className="mr-1.5 inline h-4 w-4 align-text-bottom"
              style={{ color: PALETTE.honey }}
              aria-hidden
            />
            <b>Live</b> means it&apos;s shipped and you can use it today.
            <b> Beta</b> means it works but we&apos;re still tuning it.
            <b> Planned</b> means we&apos;re building it. We tell you the
            difference so you know exactly what you&apos;re signing up for.
          </p>
        </section>

        {/* Free vs Pro */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="Free vs Pro">
            The honest ladder
          </SectionHeading>

          <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
            <TierCard
              tone="free"
              tier="Free forever"
              price="£0"
              cadence="per month"
              blurb="Everything you need to have a real presence, take enquiries, and post to The Yard."
              rows={[
                { on: true, label: "Your own live app + custom URL" },
                { on: true, label: "WhatsApp direct button" },
                { on: true, label: "The Yard — post + reply" },
                { on: true, label: "Trade Circle endorsements" },
                { on: true, label: "3 project matches per month" },
                { on: false, label: "Video attachments on posts" },
                { on: false, label: "Multi-audience Yard broadcasts" },
                { on: false, label: "App Warehouse — Pro apps" },
                { on: false, label: "Priority in project matches" }
              ]}
            />
            <TierCard
              tone="pro"
              tier="Pro"
              price="From £14.99"
              cadence="per month · cancel any time"
              blurb="Every feature unlocked. For trades who want the calculator suite, video, uncapped matches, and priority placement."
              rows={[
                { on: true, label: "Everything in Free" },
                { on: true, label: "Video attachments on Yard posts" },
                { on: true, label: "Broadcast to up to 3 trade audiences" },
                { on: true, label: "Uncapped project matches" },
                { on: true, label: "All calculator apps" },
                { on: true, label: "Priority placement in matches" },
                { on: true, label: "Verified badge (with checks)" },
                { on: true, label: "Custom domain support" },
                { on: true, label: "First-look at planned features" }
              ]}
            />
          </div>
        </section>

        {/* Setup flow */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="Setup takes five minutes">
            How you go live today
          </SectionHeading>

          <div className="mt-8 grid gap-4 md:gap-5">
            <FlowStep
              n="01"
              icon={<Wrench className="h-5 w-5" />}
              title="Tell us your trade"
              body="Business name, primary trade, city. We verify against Companies House. Three fields, no card."
            />
            <FlowStep
              n="02"
              icon={<Sparkles className="h-5 w-5" />}
              title="Upload 3-6 photos + a short blurb"
              body="What you do, how customers find you, one line about what makes you worth calling. Your app goes live at yourname.theconstructionnotebook.com the moment you hit save."
            />
            <FlowStep
              n="03"
              icon={<MessageCircle className="h-5 w-5" />}
              title="Drop the link in your bios"
              body="Copy your app URL. Paste it into your Instagram, TikTok, and Facebook bios. Every social visitor now taps through to your WhatsApp button. Nothing else changes about how you post."
            />
            <FlowStep
              n="04"
              icon={<Zap className="h-5 w-5" />}
              title="Start posting in The Yard"
              body="Post that you&apos;re available. Reply when someone needs a hand. Endorse the trades you actually rate. Traffic runs through The Yard daily — you don&apos;t need to hunt for it."
            />
          </div>
        </section>

        {/* The claim block */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="What we don&apos;t promise">
            No lies. No spin.
          </SectionHeading>

          <div className="mt-8 space-y-4">
            <HonestyRow
              icon={<CheckCircle2 className="h-5 w-5" />}
              positive
              title="We don&apos;t promise you leads"
              body="Nobody honest can. What we promise: a place to actually be seen, a network of other trades, and tools that put you a WhatsApp tap away from anyone who lands on your app."
            />
            <HonestyRow
              icon={<CheckCircle2 className="h-5 w-5" />}
              positive
              title="We don&apos;t take a commission on your work"
              body="You quote what you quote. The homeowner pays you direct. We don&apos;t skim, we don&apos;t hold funds, we don&apos;t take a booking fee. Ever."
            />
            <HonestyRow
              icon={<CheckCircle2 className="h-5 w-5" />}
              positive
              title="You own your data — leave any time with it"
              body="Every photo, every review, every enquiry log. Export it whenever you want. Take your reputation with you if you decide Thenetworkers isn&apos;t for you."
            />
          </div>
        </section>

        {/* Bottom CTA */}
        <section
          className="mt-16 rounded-3xl border p-6 md:mt-24 md:p-10"
          style={{
            borderColor: PALETTE.divider,
            backgroundColor: "#ffffff"
          }}
        >
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-[520px]">
              <h2 className="text-[26px] font-black leading-tight tracking-tight md:text-[34px]">
                Ready to stop feeding the algorithm?
              </h2>
              <p
                className="mt-3 text-[15px] leading-[1.55]"
                style={{ color: PALETTE.inkSoft }}
              >
                Get your app. Drop the link in your bios. Post to The
                Yard. The rest is on you — but the tools are here and
                most of them are free.
              </p>
            </div>
            <Link
              href="/join/start"
              className="group inline-flex min-h-[56px] items-center gap-3 rounded-full pl-6 pr-4 text-[15px] font-black shadow-lg"
              style={{
                backgroundColor: PALETTE.honeyBright,
                color: PALETTE.ink
              }}
            >
              Get my free app
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
                style={{ backgroundColor: PALETTE.ink, color: PALETTE.cream }}
                aria-hidden
              >
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  children
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p
        className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: PALETTE.honey }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[26px] font-black leading-tight tracking-tight md:text-[36px]">
        {children}
      </h2>
    </>
  );
}

function HonestyRow({
  icon,
  title,
  body,
  positive
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  positive?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-2xl border bg-white p-5"
      style={{ borderColor: PALETTE.divider }}
    >
      <div
        className="shrink-0"
        style={{ color: positive ? PALETTE.green : PALETTE.red }}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold">{title}</h3>
        <p
          className="mt-1 text-[14px] leading-[1.55]"
          style={{ color: PALETTE.inkSoft }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
  status
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  status: "live" | "beta" | "planned";
}) {
  const badge =
    status === "live"
      ? { label: "Live", bg: PALETTE.green, fg: "#ffffff" }
      : status === "beta"
        ? { label: "Beta", bg: PALETTE.honey, fg: PALETTE.cream }
        : { label: "Planned", bg: "rgba(27,26,23,0.12)", fg: PALETTE.ink };
  return (
    <article
      className="rounded-2xl border bg-white p-5 md:p-6"
      style={{ borderColor: PALETTE.divider }}
    >
      <div className="flex items-start justify-between gap-3">
        <span style={{ color: PALETTE.honey }} aria-hidden>
          {icon}
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]"
          style={{ backgroundColor: badge.bg, color: badge.fg }}
        >
          {badge.label}
        </span>
      </div>
      <h3 className="mt-3 text-[17px] font-bold leading-tight md:text-[19px]">
        {title}
      </h3>
      <p
        className="mt-2 text-[14px] leading-[1.55] md:text-[15px]"
        style={{ color: PALETTE.inkSoft }}
      >
        {body}
      </p>
    </article>
  );
}

function TierCard({
  tone,
  tier,
  price,
  cadence,
  blurb,
  rows
}: {
  tone: "free" | "pro";
  tier: string;
  price: string;
  cadence: string;
  blurb: string;
  rows: Array<{ on: boolean; label: string }>;
}) {
  const isFree = tone === "free";
  return (
    <article
      className="rounded-2xl border p-6"
      style={{
        borderColor: isFree ? PALETTE.divider : PALETTE.ink,
        backgroundColor: isFree ? "#ffffff" : PALETTE.ink,
        color: isFree ? PALETTE.ink : PALETTE.cream
      }}
    >
      <div
        className="text-[11px] font-extrabold uppercase tracking-[0.20em]"
        style={{ color: isFree ? PALETTE.honey : PALETTE.honeyBright }}
      >
        {tier}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[36px] font-black leading-none md:text-[42px]">
          {price}
        </span>
        <span
          className="text-[12px] font-semibold"
          style={{
            color: isFree ? PALETTE.inkMuted : "rgba(251,246,236,0.65)"
          }}
        >
          {cadence}
        </span>
      </div>
      <p
        className="mt-3 text-[13px] leading-[1.55]"
        style={{
          color: isFree ? PALETTE.inkSoft : "rgba(251,246,236,0.78)"
        }}
      >
        {blurb}
      </p>
      <ul className="mt-5 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2">
            {r.on ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{
                  color: isFree ? PALETTE.green : PALETTE.honeyBright
                }}
                aria-hidden
              />
            ) : (
              <XCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                style={{
                  color: isFree
                    ? PALETTE.inkMuted
                    : "rgba(251,246,236,0.35)"
                }}
                aria-hidden
              />
            )}
            <span
              className="text-[13px]"
              style={{
                color: r.on
                  ? isFree
                    ? PALETTE.ink
                    : PALETTE.cream
                  : isFree
                    ? PALETTE.inkMuted
                    : "rgba(251,246,236,0.5)"
              }}
            >
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FlowStep({
  n,
  icon,
  title,
  body
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article
      className="rounded-2xl border bg-white p-5 md:p-6"
      style={{ borderColor: PALETTE.divider }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold"
          style={{
            backgroundColor: PALETTE.ink,
            color: PALETTE.honeyBright
          }}
        >
          {n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ color: PALETTE.honey }} aria-hidden>
              {icon}
            </span>
            <h3 className="text-[17px] font-bold leading-tight md:text-[19px]">
              {title}
            </h3>
          </div>
          <p
            className="mt-2 text-[14px] leading-[1.55] md:text-[15px]"
            style={{ color: PALETTE.inkSoft }}
          >
            {body}
          </p>
        </div>
      </div>
    </article>
  );
}
