// Xrated Trades — "Share Anywhere" feature page.
// Hero -> 8-tile channel grid (IG, TikTok, FB, WhatsApp, QR for van,
// business cards, email signature, Google Business Profile) ->
// QR code section with placeholder -> "where it spreads" narrative
// with a 70% stat callout -> closing CTA.
// Server-only; matches the /trade-off/pricing design system.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title:
    "Share Anywhere — Xrated Trades. One xratedtrade.com URL across every channel.",
  description:
    "Paste your Xrated link on Instagram, TikTok, Facebook, WhatsApp, your van QR, business cards, email signature and Google Business Profile. One URL, every channel customers find tradies on.",
  alternates: { canonical: "/trade-off/share" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Xrated Trades — One URL. Every channel.",
    description:
      "Your short xratedtrade.com link on every channel customers use to find tradies.",
    url: absolute("/trade-off/share")
  }
};

type Channel = {
  label: string;
  body: string;
  bg: string;
  ink: string;
  icon: "instagram" | "tiktok" | "facebook" | "whatsapp" | "qr" | "card" | "email" | "google";
};

const CHANNELS: Channel[] = [
  {
    label: "Instagram",
    body: "Drop it in your bio. Story stickers too.",
    bg: "linear-gradient(135deg,#F58529 0%,#DD2A7B 45%,#8134AF 75%,#515BD4 100%)",
    ink: "#ffffff",
    icon: "instagram"
  },
  {
    label: "TikTok",
    body: "Add to bio. Pin a 'work I do' video on top.",
    bg: "#0A0A0A",
    ink: "#ffffff",
    icon: "tiktok"
  },
  {
    label: "Facebook",
    body: "Page header link, every post comment, marketplace.",
    bg: "#1877F2",
    ink: "#ffffff",
    icon: "facebook"
  },
  {
    label: "WhatsApp",
    body: "Your status, your profile, every quote message.",
    bg: "#25D366",
    ink: "#ffffff",
    icon: "whatsapp"
  },
  {
    label: "QR code on the van",
    body: "Sticker on the side panel. Scan from the kerb.",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    icon: "qr"
  },
  {
    label: "Business cards",
    body: "Print the URL + a QR. No more 'lost your number'.",
    bg: "#F5F5F5",
    ink: "#0A0A0A",
    icon: "card"
  },
  {
    label: "Email signature",
    body: "Auto-appended on every quote and reply.",
    bg: "#1F2937",
    ink: "#ffffff",
    icon: "email"
  },
  {
    label: "Google Business Profile",
    body: "Website field — beats a 90s WordPress homepage.",
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    icon: "google"
  }
];

export default function ShareAnywherePage() {
  return (
    <main className="bg-white pb-24 md:pb-0">
      <XratedHeader />

      {/* Hero — banner-image background with dark gradient overlay for
          legibility. Same pattern as /trade-off/how and /trade-off/pricing. */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2027,%202026,%2009_47_30%20AM.png"
          alt="Xrated Trades — one URL across every channel customers find tradies on."
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0) 100%)"
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16">
          <p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Share your link
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight text-white drop-shadow sm:text-4xl md:text-5xl">
            One URL.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>Every channel</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-white/85 drop-shadow sm:text-sm">
            Your xratedtrade.com link is built to be shared. Paste it
            everywhere customers actually look for tradies — social profiles,
            stickers on the van, the back of a business card, your email
            sign-off — and let the URL do the selling.
          </p>
        </div>
      </section>

      {/* Section 1 — 8-tile channel grid */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Eight channels. One link.
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          Pick the ones you already use. The link is the same everywhere.
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {CHANNELS.map((ch) => (
            <li
              key={ch.label}
              className="rounded-2xl border border-neutral-200 p-4 transition"
              style={{ background: ch.bg, color: ch.ink }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                <ChannelIcon kind={ch.icon} ink={ch.ink} />
              </div>
              <h3 className="mt-3 text-xs font-extrabold sm:text-sm" style={{ color: ch.ink }}>
                {ch.label}
              </h3>
              <p
                className="mt-1 text-[12px] leading-relaxed"
                style={{ color: ch.ink, opacity: 0.85 }}
              >
                {ch.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Section 2 — QR code feature */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.22em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              The QR code
            </p>
            <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
              A scannable shortcut to your link.
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
              Every Xrated profile auto-generates a printable QR code. Print
              on your van. Stick on toolboxes. Hand out at jobs. Every scan =
              potential customer landing on your photos, reviews and
              WhatsApp button.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-xs text-neutral-700 sm:text-sm">
              <li className="flex items-start gap-2">
                <Tick /> High-resolution PNG, ready for the printer.
              </li>
              <li className="flex items-start gap-2">
                <Tick /> Works without an app — every camera scans it.
              </li>
              <li className="flex items-start gap-2">
                <Tick /> Lands customers on WhatsApp in one tap.
              </li>
            </ul>
          </div>

          {/* Fake QR placeholder — styled checkerboard pattern. */}
          <div className="flex items-center justify-center">
            <div
              className="rounded-2xl border-4 p-4 shadow-lg"
              style={{ borderColor: XRATED_BRAND.accent, background: "#ffffff" }}
              role="img"
              aria-label="QR code placeholder"
            >
              <FakeQr />
              <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                xratedtrade.com/your-name
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — Where it spreads + 70% stat */}
      <section className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-16">
        <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Where it spreads
        </h2>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">
          One link, every channel, every word-of-mouth referral.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
          <div className="order-2 md:order-1">
            <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
              A neighbour asks who did your kitchen. They send a WhatsApp.
              They paste your link in the village group chat. Two of those
              get screenshot into a homeowner's Instagram story. One ends up
              on a private Facebook 'recommend a tradie' thread. By Tuesday
              your link has been in front of two hundred people who never
              met you — every one of them landing on photos, prices and a
              WhatsApp button.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-neutral-700 sm:text-sm">
              That is what one link does. That is why we built Xrated as a
              link, not a directory.
            </p>
          </div>

          {/* 70% stat callout */}
          <div
            className="order-1 rounded-2xl p-6 text-center md:order-2 sm:p-8"
            style={{ background: "#0A0A0A" }}
          >
            <p
              className="text-6xl font-extrabold leading-none sm:text-7xl md:text-8xl"
              style={{ color: XRATED_BRAND.accent }}
            >
              70%
            </p>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-white/70">
              of trade referrals
            </p>
            <p className="mt-1 text-xs text-white/80 sm:text-sm">
              start on social or a chat group — not a search engine.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto mt-12 max-w-5xl px-4 pb-2 sm:px-6">
        <div
          className="overflow-hidden rounded-2xl px-5 py-8 text-center sm:px-10 sm:py-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: XRATED_BRAND.accent }}
          >
            Print it. Paste it. Share it.
          </p>
          <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white sm:text-4xl">
            Get your link in 5 minutes.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-xs text-white/80 sm:text-sm">
            14 days of every premium feature. No card on signup. QR code
            generated automatically.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade-off/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg px-6 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition active:scale-[0.98] sm:text-sm"
              style={{
                background: XRATED_BRAND.accent,
                boxShadow: `0 4px 14px ${XRATED_BRAND.accent}55`
              }}
            >
              Join XratedTrade
            </a>
            <a
              href="/trade-off/pricing"
              className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-6 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See pricing
            </a>
          </div>
        </div>
      </section>

      <XratedFooter />
    </main>
  );
}

function Tick() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
      style={{ background: XRATED_BRAND.accent }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

// Simple inline channel icons — kept lightweight so the server bundle
// does not pull in a full icon library just for this page.
function ChannelIcon({
  kind,
  ink
}: {
  kind: Channel["icon"];
  ink: string;
}) {
  const stroke = ink;
  switch (kind) {
    case "instagram":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill={stroke} />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={stroke} aria-hidden="true">
          <path d="M14 3v8.5a3 3 0 1 1-3-3h.5V6A6 6 0 1 0 17 12V8.2a6.8 6.8 0 0 0 4 1.3V6.5A3.8 3.8 0 0 1 17 3z" />
        </svg>
      );
    case "facebook":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={stroke} aria-hidden="true">
          <path d="M14 9V7a1 1 0 0 1 1-1h2V3h-3a4 4 0 0 0-4 4v2H8v3h2v9h4v-9h2.5l.5-3z" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={stroke} aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.5-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2a.4.4 0 0 0 0-.4l-.6-1.4c-.2-.4-.3-.3-.5-.3h-.4a.8.8 0 0 0-.6.3 2.4 2.4 0 0 0-.7 1.8 4.2 4.2 0 0 0 .9 2.2 9.5 9.5 0 0 0 3.7 3.2 4.2 4.2 0 0 0 2.5.5 2 2 0 0 0 1.3-.9 1.6 1.6 0 0 0 .1-.9c-.1-.1-.2-.2-.4-.3z" />
        </svg>
      );
    case "qr":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM20 14v3M14 20h3v1M20 20v1" />
        </svg>
      );
    case "card":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10h6M7 14h10" />
        </svg>
      );
    case "email":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "google":
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={stroke} aria-hidden="true">
          <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2a9.7 9.7 0 0 0 3-7.3zM12 22a9.5 9.5 0 0 0 6.6-2.4l-3.2-2.5a6 6 0 0 1-9-3.1H3.1V16A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2zM12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2 10 10 0 0 0 3.1 7.4l3.3 2.5A6 6 0 0 1 12 6z" />
        </svg>
      );
  }
}

// Decorative fake QR — a 7x7 grid of squares with the three corner
// markers, just enough to read as 'a QR code' without rendering a
// real scannable one (we generate the real one in the dashboard).
function FakeQr() {
  // Pre-baked checker pattern so the dots are stable across renders.
  const pattern: number[][] = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ];
  const dotsRow1 = [1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1];
  const dotsRow2 = [0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0];
  const dotsRow3 = [1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1];

  return (
    <div
      className="grid h-44 w-44 grid-cols-11 grid-rows-11 gap-[2px] sm:h-52 sm:w-52"
      style={{ background: "#ffffff" }}
      aria-hidden="true"
    >
      {/* Top-left finder */}
      {pattern.flatMap((row, r) =>
        row.map((cell, c) => (
          <span
            key={`tl-${r}-${c}`}
            style={{
              gridRow: r + 1,
              gridColumn: c + 1,
              background: cell ? "#0A0A0A" : "#ffffff"
            }}
          />
        ))
      )}
      {/* Top-right finder */}
      {pattern.flatMap((row, r) =>
        row.map((cell, c) => (
          <span
            key={`tr-${r}-${c}`}
            style={{
              gridRow: r + 1,
              gridColumn: c + 5,
              background: cell ? "#0A0A0A" : "#ffffff"
            }}
          />
        ))
      )}
      {/* Bottom-left finder */}
      {pattern.flatMap((row, r) =>
        row.map((cell, c) => (
          <span
            key={`bl-${r}-${c}`}
            style={{
              gridRow: r + 5,
              gridColumn: c + 1,
              background: cell ? "#0A0A0A" : "#ffffff"
            }}
          />
        ))
      )}
      {/* Scatter rows in the middle for visual noise */}
      {dotsRow1.map((cell, c) => (
        <span
          key={`m1-${c}`}
          style={{
            gridRow: 5,
            gridColumn: c + 1,
            background: cell ? "#0A0A0A" : "#ffffff"
          }}
        />
      ))}
      {dotsRow2.map((cell, c) => (
        <span
          key={`m2-${c}`}
          style={{
            gridRow: 6,
            gridColumn: c + 1,
            background: cell ? "#0A0A0A" : "#ffffff"
          }}
        />
      ))}
      {dotsRow3.map((cell, c) => (
        <span
          key={`m3-${c}`}
          style={{
            gridRow: 7,
            gridColumn: c + 1,
            background: cell ? "#0A0A0A" : "#ffffff"
          }}
        />
      ))}
    </div>
  );
}
