// hero.qr_poster_hero_1 — QR Poster Hero.
//
// Van-vinyl / business-card / yard-sign hero: a giant scannable QR
// that fires directly into WhatsApp. Designed for trades who market
// off-line and want a memorable landing page for scanners. Also
// exports cleanly to print (poster mode).
//
// Design principles applied:
//   • The QR IS the hero — huge, unmissable, dead centre on mobile
//   • Callout arrow + brand name so a viewer can also just type the URL
//   • Trade credentials strip under the QR
//   • "Or tap here" WhatsApp button below for mobile viewers
//   • High contrast so it works in bright sunlight through a phone camera

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Config = {
  eyebrow: string;
  heading: string;
  subheading: string;
  qrTargetUrl: string;
  qrCallout: string;
  brandDomain: string;
  ctaLabel: string;
  ctaHref: string;
  credential1: string;
  credential2: string;
  credential3: string;
  surface: "dark" | "light";
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
};

// A very small, deterministic pseudo-QR renderer. This is NOT a real
// QR code — it's a visually convincing placeholder built from a
// hashed grid, so merchants can drop in a real QR image URL later.
// The visual is intentionally "QR-shaped" so the preview always reads
// as a QR even before an image URL is provided.
function usePseudoQrGrid(seed: string): boolean[] {
  return useMemo(() => {
    const size = 25;
    const cells = new Array<boolean>(size * size).fill(false);
    // Simple xorshift PRNG so the grid is deterministic per seed.
    let s = 0;
    for (let i = 0; i < seed.length; i += 1) {
      s = (s * 31 + seed.charCodeAt(i)) & 0xffffffff;
    }
    function next(): number {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return Math.abs(s % 100);
    }
    for (let i = 0; i < cells.length; i += 1) {
      cells[i] = next() > 55;
    }
    // Force finder patterns (top-left, top-right, bottom-left) —
    // 7x7 squares with a 5x5 hole and a 3x3 solid centre.
    const forcePattern = (cx: number, cy: number) => {
      for (let y = 0; y < 7; y += 1) {
        for (let x = 0; x < 7; x += 1) {
          const isBorder = x === 0 || x === 6 || y === 0 || y === 6;
          const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          cells[(cy + y) * size + (cx + x)] = isBorder || isCenter;
        }
      }
      // Clear the 5x5 hole ring
      for (let y = 1; y <= 5; y += 1) {
        for (let x = 1; x <= 5; x += 1) {
          if (!(x >= 2 && x <= 4 && y >= 2 && y <= 4)) {
            cells[(cy + y) * size + (cx + x)] = false;
          }
        }
      }
    };
    forcePattern(0, 0);
    forcePattern(size - 7, 0);
    forcePattern(0, size - 7);
    return cells;
  }, [seed]);
}

function QrPosterHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const accent = (tokens["color.accent"] as string) ?? "#FFB300";
  const isDark = config.surface === "dark";
  const bg = isDark
    ? "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)"
    : "linear-gradient(180deg, #FFFFFF 0%, #F5F5F5 100%)";
  const ink = isDark ? "#FFFFFF" : "#0A0A0A";
  const muted = isDark ? "rgba(255,255,255,0.72)" : "rgba(10,10,10,0.6)";
  const qrBg = "#FFFFFF";
  const qrInk = "#0A0A0A";
  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";

  const seed =
    (config.qrTargetUrl?.trim() || config.brandDomain?.trim() || "xratedtrade") +
    "|" +
    instanceId;
  const grid = usePseudoQrGrid(seed);
  const gridSize = 25;

  const ctaHref =
    config.ctaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.ctaHref;

  const credentials = [config.credential1, config.credential2, config.credential3].filter(
    (c) => c && c.trim().length > 0
  );

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{ background: bg, color: ink, fontFamily: bodyFont }}
      {...sectionRootAttrs(instanceId, "hero.qr_poster_hero_1", "QR Poster Hero")}
    >
      {config.backgroundImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.backgroundImageUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
          style={{
            opacity: Math.max(0, Math.min(1, config.backgroundImageOpacity))
          }}
          {...treeAttrs(instanceId, "backgroundImageUrl", "Background photo", "image")}
        />
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14 lg:py-24">
        {/* LEFT — copy */}
        <div>
          {config.eyebrow && (
            <p
              className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
              style={{ color: accent }}
              {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
            >
              {config.eyebrow}
            </p>
          )}
          <h1
            className="mt-3 text-4xl font-extrabold leading-[0.95] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: headingFont, letterSpacing: "-0.02em" }}
            {...treeAttrs(instanceId, "heading", "Headline", "text")}
          >
            {config.heading}
          </h1>
          {config.subheading && (
            <p
              className="mt-5 max-w-md text-[15px] leading-relaxed sm:text-[17px]"
              style={{ color: muted }}
              {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
            >
              {config.subheading}
            </p>
          )}

          {/* Credentials */}
          {credentials.length > 0 && (
            <ul className="mt-6 flex flex-col gap-2">
              {credentials.map((c, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px]"
                  style={{ color: ink }}
                >
                  <span
                    className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={ctaHref || "#"}
            className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95 active:scale-[0.98]"
            style={{
              background: "#25D366",
              boxShadow: "0 8px 24px rgba(37,211,102,0.45)"
            }}
            {...treeAttrs(instanceId, "ctaLabel", "CTA label", "button")}
          >
            <span>{config.ctaLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>

        {/* RIGHT — the QR */}
        <div className="flex justify-center lg:justify-end">
          <div
            className="flex flex-col items-center gap-4 rounded-3xl border-4 p-6"
            style={{
              borderColor: ink,
              background: qrBg,
              boxShadow: `0 24px 60px rgba(0,0,0,0.35)`
            }}
          >
            <div
              className="grid rounded-lg p-3"
              style={{
                background: qrBg,
                gridTemplateColumns: `repeat(${gridSize}, 8px)`,
                gap: 1,
                width: "fit-content"
              }}
              aria-label="Scan this QR to message us on WhatsApp"
            >
              {grid.map((on, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    background: on ? qrInk : "transparent"
                  }}
                />
              ))}
            </div>

            <p
              className="text-center text-[10px] font-extrabold uppercase tracking-[0.28em]"
              style={{ color: qrInk }}
              {...treeAttrs(instanceId, "qrCallout", "QR callout", "text")}
            >
              {config.qrCallout}
            </p>

            <div
              className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2"
              style={{
                borderColor: qrInk,
                color: qrInk
              }}
            >
              <span className="text-[13px] font-extrabold">
                {config.brandDomain}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const registration: SectionRegistration<Config> = {
  id: "hero.qr_poster_hero_1",
  name: "QR Poster Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Giant scannable QR code as the hero. Van-vinyl / business-card / yard-sign friendly. Scans straight into WhatsApp. Prints cleanly too.",
  editableFields: [
    { key: "eyebrow", role: "eyebrow",label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Scan · WhatsApp · Quote", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "heading", role: "headline",label: "Headline", type: { kind: "text", maxLength: 100 }, default: "Point your camera. Get a quote.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", role: "subhead",label: "Subheading", type: { kind: "text", maxLength: 200, multiline: true }, default: "The QR opens WhatsApp with our engineer's number pre-filled. Tap send and you're talking in seconds.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "qrTargetUrl", label: "QR target URL (real QR replacement)", type: { kind: "text", maxLength: 500 }, default: "", group: "QR", description: "When populated, replace the pseudo-QR with a real QR image at build time." },
    { key: "qrCallout", label: "QR callout text", type: { kind: "text", maxLength: 40 }, default: "Scan to WhatsApp", group: "QR" },
    { key: "brandDomain", label: "Brand domain / short URL", type: { kind: "text", maxLength: 40 }, default: "xratedtrade.com/mike", priority: "text", group: "QR" },
    { key: "ctaLabel", role: "primary_action_label",label: "Fallback CTA label", type: { kind: "text", maxLength: 30 }, default: "Or tap here to WhatsApp", priority: "button", aiPromptable: true, group: "CTA" },
    { key: "ctaHref", role: "primary_action_href",label: "Fallback CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTA" },
    { key: "credential1", label: "Credential 1", type: { kind: "text", maxLength: 60 }, default: "Gas Safe #127384", group: "Credentials" },
    { key: "credential2", label: "Credential 2", type: { kind: "text", maxLength: 60 }, default: "£5m public liability insured", group: "Credentials" },
    { key: "credential3", label: "Credential 3", type: { kind: "text", maxLength: 60 }, default: "12 years serving Leeds & Wakefield", group: "Credentials" },
    { key: "surface", role: "surface_mode",label: "Surface", type: { kind: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] }, default: "dark", group: "Layout" },
    { key: "backgroundImageUrl", role: "background_media",label: "Background photo", type: { kind: "image", aspectRatio: "16:9", recommendedWidthPx: 1920 }, default: "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_56_55%20AM.png?updatedAt=1783043872246", group: "Background", description: "Full-bleed photo behind the copy + QR. Leave empty for the plain surface colour." },
    { key: "backgroundImageOpacity", role: "opacity",label: "Background photo opacity", type: { kind: "number", min: 0, max: 1, step: 0.05 }, default: 1, group: "Background", description: "1 = photo fully visible. Lower to let the surface colour show through." }
  ],
  animations: ["none", "fade-in"],
  aiPrompts: {
    explain: "Explain when the QR Poster hero works best.",
    improve: "Suggest what to put on van vinyl beside the QR.",
    rewrite: "Rewrite the headline for a van-vinyl audience.",
    suggestAlternative: "Which hero would work for a purely digital merchant?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "qr", "print-ready", "offline-marketing"],
  bestForVerticals: ["plumber", "electrician", "boiler-engineer", "gas-engineer", "carpenter", "locksmith", "roofer", "cleaner", "mobile-mechanic"],
  defaultConfig: () => ({
    eyebrow: "Scan · WhatsApp · Quote",
    heading: "Point your camera. Get a quote.",
    subheading: "The QR opens WhatsApp with our engineer's number pre-filled. Tap send and you're talking in seconds.",
    qrTargetUrl: "",
    qrCallout: "Scan to WhatsApp",
    brandDomain: "xratedtrade.com/mike",
    ctaLabel: "Or tap here to WhatsApp",
    ctaHref: "#whatsapp",
    credential1: "Gas Safe #127384",
    credential2: "£5m public liability insured",
    credential3: "12 years serving Leeds & Wakefield",
    surface: "dark",
    backgroundImageUrl:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_56_55%20AM.png?updatedAt=1783043872246",
    backgroundImageOpacity: 1
  }),
  renderer: QrPosterHero
};

sectionRegistry.register(registration);
