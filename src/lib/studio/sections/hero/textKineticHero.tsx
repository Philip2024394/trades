// hero.text_kinetic_1 — Kinetic Typography Hero.
//
// Text-animation-first hero. Six selectable kinetic-typography styles:
//   1. roll-up      — Words slide up from below with stagger (Awwwards standard)
//   2. fall-down    — Letters fall from above with subtle rotation
//   3. wipe-reveal  — Coloured bar wipes across, revealing text underneath
//   4. blur-focus   — Text starts blurred, sharpens into focus
//   5. word-rotate  — One slot cycles through multiple words on loop
//   6. typewriter   — Character-by-character reveal, blinking caret
//
// Pure CSS keyframes. Zero JS libraries. Every animation respects
// prefers-reduced-motion (falls back to a clean final-state render).
//
// Word-rotate syntax: any `{word1|word2|word3}` block in the heading is
// treated as a rotator slot. Text before + after stays static; only
// the pipe-separated words cycle.

"use client";

import Link from "next/link";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import { sectionRootAttrs, treeAttrs } from "@/lib/studio/treeIds";
import type {
  SectionRegistration,
  SectionRendererProps
} from "@/lib/studio/sectionTypes";

type Style =
  | "roll-up"
  | "fall-down"
  | "wipe-reveal"
  | "blur-focus"
  | "word-rotate"
  | "typewriter";

type Speed = "slow" | "normal" | "fast";

type Config = {
  eyebrow: string;
  headingPrefix: string;
  headingRotator: string;
  headingSuffix: string;
  subheading: string;
  animationStyle: Style;
  animationSpeed: Speed;
  loop: boolean;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  surface: "dark" | "cream" | "gradient";
  accentColorMode: "brand" | "hot-pink" | "electric-blue" | "acid-green";
  showScrollHint: boolean;
};

const SPEED_MS: Record<Speed, number> = {
  slow: 1400,
  normal: 900,
  fast: 550
};

const ACCENT_OVERRIDES: Record<Config["accentColorMode"], string | null> = {
  brand: null,
  "hot-pink": "#EC4899",
  "electric-blue": "#3B82F6",
  "acid-green": "#84CC16"
};

function TextKineticHero({
  instanceId,
  config,
  tokens,
  data
}: SectionRendererProps<Config>) {
  const brandAccent = (tokens["color.accent"] as string) ?? "#FFB300";
  const accent = ACCENT_OVERRIDES[config.accentColorMode] ?? brandAccent;

  const surfaceMap = {
    dark: {
      bg: "linear-gradient(180deg, #0A0A0A 0%, #141414 100%)",
      ink: "#FFFFFF",
      muted: "rgba(255,255,255,0.68)",
      border: "rgba(255,255,255,0.14)"
    },
    cream: {
      bg: "linear-gradient(180deg, #FBFAF6 0%, #F0EBE0 100%)",
      ink: "#1A1512",
      muted: "rgba(26,21,18,0.6)",
      border: "rgba(26,21,18,0.15)"
    },
    gradient: {
      bg:
        "linear-gradient(135deg, #0A0A0A 0%, #1e1b4b 50%, #0A0A0A 100%)",
      ink: "#FFFFFF",
      muted: "rgba(255,255,255,0.72)",
      border: "rgba(255,255,255,0.18)"
    }
  }[config.surface];

  const headingFont = (tokens["font.heading"] as string) ?? "inherit";
  const bodyFont = (tokens["font.body"] as string) ?? "inherit";
  const durationMs = SPEED_MS[config.animationSpeed] ?? SPEED_MS.normal;

  const primaryHref =
    config.primaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.primaryCtaHref;
  const secondaryHref =
    config.secondaryCtaHref === "#whatsapp" && data.whatsappHref
      ? data.whatsappHref
      : config.secondaryCtaHref;

  const uid = instanceId.replace(/[^a-zA-Z0-9]/g, "");

  // Parse the rotator words for word-rotate mode. Pipe-separated,
  // trimmed, empty entries removed. Falls back to a single word if
  // nothing supplied.
  const rotatorWords = (config.headingRotator || "")
    .split("|")
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  return (
    <section
      className="relative isolate w-full overflow-hidden"
      style={{
        background: surfaceMap.bg,
        color: surfaceMap.ink,
        fontFamily: bodyFont
      }}
      {...sectionRootAttrs(instanceId, "hero.text_kinetic_1", "Kinetic Typography Hero")}
    >
      {/* Ambient accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 55% at 50% 40%, ${accent}22 0%, transparent 70%)`
        }}
      />

      <div className="relative mx-auto max-w-5xl px-5 py-24 text-center sm:px-6 sm:py-32">
        {config.eyebrow && (
          <p
            className="mb-6 text-[11px] font-extrabold uppercase tracking-[0.28em]"
            style={{ color: accent }}
            {...treeAttrs(instanceId, "eyebrow", "Eyebrow", "text")}
          >
            {config.eyebrow}
          </p>
        )}

        {/* The animated headline — animation style dispatches to the
            correct renderer below. */}
        <h1
          className="text-5xl font-extrabold leading-[0.95] sm:text-7xl md:text-8xl"
          style={{
            fontFamily: headingFont,
            letterSpacing: "-0.03em"
          }}
          {...treeAttrs(instanceId, "headingPrefix", "Headline", "text")}
        >
          <AnimatedHeadline
            style={config.animationStyle}
            prefix={config.headingPrefix}
            rotatorWords={rotatorWords}
            suffix={config.headingSuffix}
            accent={accent}
            uid={uid}
            loop={config.loop}
          />
        </h1>

        {config.subheading && (
          <p
            className={`kinetic-sub-${uid} mx-auto mt-8 max-w-2xl text-[15px] leading-relaxed sm:text-[18px]`}
            style={{ color: surfaceMap.muted }}
            {...treeAttrs(instanceId, "subheading", "Subheading", "text")}
          >
            {config.subheading}
          </p>
        )}

        <div className={`kinetic-cta-${uid} mt-10 flex flex-wrap items-center justify-center gap-3`}>
          <Link
            href={primaryHref || "#"}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-extrabold uppercase tracking-widest transition active:scale-[0.98]"
            style={{
              background: accent,
              color: "#0A0A0A",
              boxShadow: `0 8px 24px ${accent}55`
            }}
            {...treeAttrs(instanceId, "primaryCtaLabel", "Primary CTA", "button")}
          >
            <span>{config.primaryCtaLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
          {config.secondaryCtaLabel && (
            <Link
              href={secondaryHref || "#"}
              className="inline-flex h-14 items-center justify-center rounded-xl border px-6 text-[13px] font-extrabold uppercase tracking-widest transition hover:brightness-110"
              style={{
                borderColor: surfaceMap.border,
                color: surfaceMap.ink,
                background: "transparent"
              }}
              {...treeAttrs(instanceId, "secondaryCtaLabel", "Secondary CTA", "button")}
            >
              {config.secondaryCtaLabel}
            </Link>
          )}
        </div>

        {config.showScrollHint && (
          <div className={`kinetic-scroll-${uid} mt-16 flex flex-col items-center gap-2`}>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{ color: surfaceMap.muted }}
            >
              Scroll
            </span>
            <div
              className="h-8 w-px"
              style={{
                background: `linear-gradient(180deg, ${accent} 0%, transparent 100%)`
              }}
            />
          </div>
        )}
      </div>

      <style>{buildKeyframes(uid, durationMs, accent, config)}</style>
    </section>
  );
}

// ─── AnimatedHeadline ─────────────────────────────────────────────

function AnimatedHeadline({
  style,
  prefix,
  rotatorWords,
  suffix,
  accent,
  uid,
  loop: _loop
}: {
  style: Style;
  prefix: string;
  rotatorWords: string[];
  suffix: string;
  accent: string;
  uid: string;
  loop: boolean;
}) {
  // Word-rotate: prefix + cycling word slot + suffix
  if (style === "word-rotate" && rotatorWords.length > 0) {
    return (
      <span>
        <span
          className={`kinetic-static-${uid}`}
          style={{ display: "inline-block", marginRight: "0.25em" }}
        >
          {prefix}
        </span>
        <span
          className="relative inline-block align-baseline"
          style={{
            minWidth: "6ch",
            verticalAlign: "baseline"
          }}
        >
          {rotatorWords.map((word, i) => (
            <span
              key={i}
              className={`rotator-word-${uid} rotator-word-${uid}--${i}`}
              style={{
                position: i === 0 ? "relative" : "absolute",
                inset: i === 0 ? undefined : 0,
                display: "inline-block",
                color: accent,
                whiteSpace: "nowrap"
              }}
            >
              {word}
            </span>
          ))}
        </span>
        {suffix && (
          <span
            className={`kinetic-static-${uid}`}
            style={{ display: "inline-block", marginLeft: "0.25em" }}
          >
            {suffix}
          </span>
        )}
      </span>
    );
  }

  // Build the full text for other styles. For non-rotate modes, join
  // prefix + first rotator word + suffix so the merchant's copy still
  // works if they only fill some fields.
  const fullText = [
    prefix,
    rotatorWords.length > 0 ? rotatorWords[0] : "",
    suffix
  ]
    .filter((s) => s && s.length > 0)
    .join(" ");

  // Roll-up: each word slides up from below with stagger.
  if (style === "roll-up") {
    const words = fullText.split(/\s+/).filter((w) => w.length > 0);
    return (
      <span>
        {words.map((word, i) => (
          <span
            key={i}
            className={`roll-word-outer-${uid}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              paddingBottom: "0.1em",
              marginBottom: "-0.1em",
              marginRight: "0.28em",
              verticalAlign: "baseline"
            }}
          >
            <span
              className={`roll-word-${uid}`}
              style={{
                display: "inline-block",
                animationDelay: `${i * 60}ms`
              }}
            >
              {word}
            </span>
          </span>
        ))}
      </span>
    );
  }

  // Fall-down: characters fall from above with rotation.
  if (style === "fall-down") {
    let letterIndex = 0;
    const words = fullText.split(/(\s+)/);
    return (
      <span>
        {words.map((chunk, wordI) => {
          if (/^\s+$/.test(chunk)) {
            return <span key={wordI}>&nbsp;</span>;
          }
          return (
            <span key={wordI} style={{ display: "inline-block", whiteSpace: "nowrap" }}>
              {[...chunk].map((ch) => {
                const idx = letterIndex++;
                return (
                  <span
                    key={idx}
                    className={`fall-char-${uid}`}
                    style={{
                      display: "inline-block",
                      animationDelay: `${idx * 35}ms`
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    );
  }

  // Wipe-reveal: text sits underneath, a coloured bar wipes across
  // revealing it.
  if (style === "wipe-reveal") {
    const words = fullText.split(/\s+/).filter((w) => w.length > 0);
    return (
      <span>
        {words.map((word, i) => (
          <span
            key={i}
            className={`wipe-word-${uid}`}
            style={{
              position: "relative",
              display: "inline-block",
              marginRight: "0.28em",
              animationDelay: `${i * 120}ms`
            }}
          >
            {word}
          </span>
        ))}
      </span>
    );
  }

  // Blur-focus: text de-blurs into focus.
  if (style === "blur-focus") {
    const words = fullText.split(/\s+/).filter((w) => w.length > 0);
    return (
      <span>
        {words.map((word, i) => (
          <span
            key={i}
            className={`blur-word-${uid}`}
            style={{
              display: "inline-block",
              marginRight: "0.28em",
              animationDelay: `${i * 90}ms`
            }}
          >
            {word}
          </span>
        ))}
      </span>
    );
  }

  // Typewriter: character-by-character reveal with a caret.
  if (style === "typewriter") {
    return (
      <span
        className={`typewriter-${uid}`}
        style={{ display: "inline-block", whiteSpace: "nowrap" }}
      >
        {fullText}
        <span
          className={`caret-${uid}`}
          style={{
            display: "inline-block",
            width: "0.08em",
            height: "0.85em",
            background: accent,
            marginLeft: "0.05em",
            verticalAlign: "middle"
          }}
        />
      </span>
    );
  }

  // Fallback — plain static render.
  return <span>{fullText}</span>;
}

// ─── Keyframes builder ────────────────────────────────────────────

function buildKeyframes(
  uid: string,
  ms: number,
  accent: string,
  config: Config
): string {
  const style = config.animationStyle;
  const loop = config.loop;
  const iteration = loop ? "infinite" : "1";

  // Base cubic-bezier that feels premium
  const easeOut = "cubic-bezier(0.16, 1, 0.3, 1)";
  const easeInOut = "cubic-bezier(0.65, 0, 0.35, 1)";

  const parts: string[] = [];

  // Roll-up
  if (style === "roll-up") {
    parts.push(`
      @keyframes roll-word-${uid} {
        from { transform: translateY(105%); }
        to { transform: translateY(0); }
      }
      .roll-word-${uid} {
        animation: roll-word-${uid} ${ms}ms ${easeOut} both;
        will-change: transform;
      }
      ${loop ? `
      @keyframes roll-word-loop-${uid} {
        0% { transform: translateY(105%); }
        25% { transform: translateY(0); }
        75% { transform: translateY(0); }
        100% { transform: translateY(-105%); }
      }
      .roll-word-${uid} { animation: roll-word-loop-${uid} ${ms * 6}ms ${easeInOut} infinite; }
      ` : ""}
    `);
  }

  // Fall-down
  if (style === "fall-down") {
    parts.push(`
      @keyframes fall-char-${uid} {
        0% {
          transform: translateY(-140%) rotate(-8deg);
          opacity: 0;
        }
        60% {
          opacity: 1;
          transform: translateY(10%) rotate(2deg);
        }
        80% { transform: translateY(-3%) rotate(-1deg); }
        100% { transform: translateY(0) rotate(0); opacity: 1; }
      }
      .fall-char-${uid} {
        animation: fall-char-${uid} ${ms}ms ${easeOut} both;
        will-change: transform;
      }
    `);
  }

  // Wipe-reveal
  if (style === "wipe-reveal") {
    parts.push(`
      @keyframes wipe-word-${uid} {
        0% { color: transparent; }
        40% { color: transparent; }
        100% { color: inherit; }
      }
      @keyframes wipe-bar-${uid} {
        0% { left: 0; right: 100%; opacity: 1; }
        40% { left: 0; right: 0; opacity: 1; }
        41% { left: 0; right: 0; opacity: 1; }
        70% { left: 100%; right: 0; opacity: 1; }
        100% { left: 100%; right: 0; opacity: 0; }
      }
      .wipe-word-${uid} {
        animation: wipe-word-${uid} ${ms}ms linear both;
      }
      .wipe-word-${uid}::before {
        content: "";
        position: absolute;
        top: 0.05em;
        bottom: 0.05em;
        background: ${accent};
        animation: wipe-bar-${uid} ${ms}ms ${easeInOut} both;
        pointer-events: none;
      }
    `);
  }

  // Blur-focus
  if (style === "blur-focus") {
    parts.push(`
      @keyframes blur-word-${uid} {
        0% { filter: blur(16px); opacity: 0; transform: scale(1.06); }
        60% { opacity: 1; }
        100% { filter: blur(0); opacity: 1; transform: scale(1); }
      }
      .blur-word-${uid} {
        animation: blur-word-${uid} ${ms}ms ${easeOut} both;
        will-change: filter, opacity, transform;
      }
    `);
  }

  // Word-rotate — each word occupies the same slot, cycling on delay
  if (style === "word-rotate") {
    const wordCount = Math.max(
      1,
      (config.headingRotator || "").split("|").filter((w) => w.trim()).length
    );
    const cycleMs = ms * 2 * wordCount;
    const percentPer = 100 / wordCount;
    parts.push(`
      @keyframes rotator-cycle-${uid} {
        0% { opacity: 0; transform: translateY(60%) rotateX(-40deg); }
        4% { opacity: 1; transform: translateY(0) rotateX(0); }
        ${percentPer - 4}% { opacity: 1; transform: translateY(0) rotateX(0); }
        ${percentPer}% { opacity: 0; transform: translateY(-60%) rotateX(40deg); }
        100% { opacity: 0; transform: translateY(-60%) rotateX(40deg); }
      }
      .rotator-word-${uid} {
        animation: rotator-cycle-${uid} ${cycleMs}ms ${easeInOut} ${iteration};
        transform-origin: center;
        backface-visibility: hidden;
      }
      ${Array.from({ length: wordCount }, (_, i) => `
        .rotator-word-${uid}--${i} {
          animation-delay: ${(cycleMs / wordCount) * i}ms;
        }
      `).join("")}
    `);
  }

  // Typewriter
  if (style === "typewriter") {
    parts.push(`
      @keyframes typewriter-reveal-${uid} {
        from { max-width: 0; }
        to { max-width: 100%; }
      }
      @keyframes caret-blink-${uid} {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      .typewriter-${uid} {
        overflow: hidden;
        display: inline-block;
        animation: typewriter-reveal-${uid} ${ms * 3}ms steps(40, end) ${iteration};
        max-width: 100%;
      }
      .caret-${uid} {
        animation: caret-blink-${uid} 900ms step-end infinite;
      }
    `);
  }

  // Common subheading + CTA fade-in (a bit after the headline finishes)
  const subDelay = style === "typewriter" ? ms * 3 : ms + 200;
  parts.push(`
    @keyframes kinetic-fade-${uid} {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .kinetic-sub-${uid} {
      animation: kinetic-fade-${uid} ${ms}ms ${easeOut} ${subDelay}ms both;
    }
    .kinetic-cta-${uid} {
      animation: kinetic-fade-${uid} ${ms}ms ${easeOut} ${subDelay + 150}ms both;
    }
    .kinetic-scroll-${uid} {
      animation: kinetic-fade-${uid} ${ms}ms ${easeOut} ${subDelay + 300}ms both;
      opacity: 0.7;
    }
  `);

  // Reduced motion — everything renders in final state
  parts.push(`
    @media (prefers-reduced-motion: reduce) {
      .roll-word-${uid},
      .fall-char-${uid},
      .wipe-word-${uid},
      .blur-word-${uid},
      .rotator-word-${uid},
      .typewriter-${uid},
      .caret-${uid},
      .kinetic-sub-${uid},
      .kinetic-cta-${uid},
      .kinetic-scroll-${uid} {
        animation: none !important;
        transform: none !important;
        opacity: 1 !important;
        filter: none !important;
        max-width: none !important;
        color: inherit !important;
        overflow: visible !important;
      }
      .wipe-word-${uid}::before {
        display: none !important;
      }
      .rotator-word-${uid}:not(.rotator-word-${uid}--0) {
        display: none !important;
      }
    }
  `);

  return parts.join("\n");
}

// ─── Registration ─────────────────────────────────────────────────

const registration: SectionRegistration<Config> = {
  id: "hero.text_kinetic_1",
  name: "Kinetic Typography Hero",
  version: "1.0.0",
  library: "hero",
  description:
    "Text-animation-first hero. Six selectable kinetic-typography styles: roll-up, fall-down, wipe-reveal, blur-focus, word-rotate, typewriter. Zero JS, pure CSS.",
  editableFields: [
    { key: "eyebrow", label: "Eyebrow", type: { kind: "text", maxLength: 60 }, default: "Local · Insured · Guaranteed", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "headingPrefix", label: "Headline — prefix (static)", type: { kind: "text", maxLength: 60 }, default: "Your", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "headingRotator", label: "Headline — rotator (pipe-separated)", type: { kind: "text", maxLength: 200 }, default: "plumber|electrician|carpenter|roofer|painter", priority: "text", group: "Copy", description: "Pipe-separated words that cycle in the middle of the headline. For non-rotate styles, only the first word is used." },
    { key: "headingSuffix", label: "Headline — suffix (static)", type: { kind: "text", maxLength: 60 }, default: "in Leeds.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "subheading", label: "Subheading", type: { kind: "text", maxLength: 240, multiline: true }, default: "One number. One trade. Real work, real prices, quoted on WhatsApp before the kettle boils.", priority: "text", aiPromptable: true, group: "Copy" },
    { key: "primaryCtaLabel", label: "Primary CTA label", type: { kind: "text", maxLength: 30 }, default: "WhatsApp quote", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "primaryCtaHref", label: "Primary CTA link", type: { kind: "link" }, default: "#whatsapp", group: "CTAs" },
    { key: "secondaryCtaLabel", label: "Secondary CTA label", type: { kind: "text", maxLength: 30 }, default: "See our work", priority: "button", aiPromptable: true, group: "CTAs" },
    { key: "secondaryCtaHref", label: "Secondary CTA link", type: { kind: "link" }, default: "#projects", group: "CTAs" },
    {
      key: "animationStyle",
      label: "Text animation",
      type: {
        kind: "select",
        options: [
          { value: "roll-up", label: "Roll up (words slide up)" },
          { value: "fall-down", label: "Fall down (letters drop from top)" },
          { value: "wipe-reveal", label: "Wipe reveal (coloured bar wipe)" },
          { value: "blur-focus", label: "Blur to focus" },
          { value: "word-rotate", label: "Word rotator (cycles the rotator field)" },
          { value: "typewriter", label: "Typewriter (character reveal + caret)" }
        ]
      },
      default: "roll-up",
      group: "Animation"
    },
    {
      key: "animationSpeed",
      label: "Animation speed",
      type: {
        kind: "select",
        options: [
          { value: "slow", label: "Slow (1.4s)" },
          { value: "normal", label: "Normal (0.9s)" },
          { value: "fast", label: "Fast (0.55s)" }
        ]
      },
      default: "normal",
      group: "Animation"
    },
    { key: "loop", label: "Loop animation forever", type: { kind: "boolean" }, default: false, group: "Animation", description: "When on: roll-up and word-rotate cycle continuously. Other styles play once then stay in final state." },
    {
      key: "surface",
      label: "Surface",
      type: {
        kind: "select",
        options: [
          { value: "dark", label: "Onyx (dark)" },
          { value: "cream", label: "Cream (light)" },
          { value: "gradient", label: "Midnight gradient" }
        ]
      },
      default: "dark",
      group: "Layout"
    },
    {
      key: "accentColorMode",
      label: "Accent colour",
      type: {
        kind: "select",
        options: [
          { value: "brand", label: "Brand (from theme)" },
          { value: "hot-pink", label: "Hot pink" },
          { value: "electric-blue", label: "Electric blue" },
          { value: "acid-green", label: "Acid green" }
        ]
      },
      default: "brand",
      group: "Layout"
    },
    { key: "showScrollHint", label: "Show 'Scroll' hint at bottom", type: { kind: "boolean" }, default: true, group: "Layout" }
  ],
  animations: ["roll-up", "fall-down", "wipe-reveal", "blur-focus", "word-rotate", "typewriter"],
  aiPrompts: {
    explain: "Explain when the Kinetic Typography hero converts best.",
    improve: "Suggest which animation style fits this trade.",
    rewrite: "Rewrite the headline for kinetic delivery.",
    suggestAlternative: "Which hero would work for a merchant who wants a quieter aesthetic?",
    score: "Score this hero on the six standard axes."
  },
  thumbnail: "",
  telemetryTags: ["hero", "typography", "animation", "kinetic"],
  bestForVerticals: ["*"],
  defaultConfig: () => ({
    eyebrow: "Local · Insured · Guaranteed",
    headingPrefix: "Your",
    headingRotator: "plumber|electrician|carpenter|roofer|painter",
    headingSuffix: "in Leeds.",
    subheading: "One number. One trade. Real work, real prices, quoted on WhatsApp before the kettle boils.",
    primaryCtaLabel: "WhatsApp quote",
    primaryCtaHref: "#whatsapp",
    secondaryCtaLabel: "See our work",
    secondaryCtaHref: "#projects",
    animationStyle: "roll-up",
    animationSpeed: "normal",
    loop: false,
    surface: "dark",
    accentColorMode: "brand",
    showScrollHint: true
  }),
  renderer: TextKineticHero
};

sectionRegistry.register(registration);
