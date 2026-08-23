// NEX Master Template 1 · client-side experience stream.
//
// Philip 2026-08-17 · STANDING. Encapsulates the section composition +
// activation-driven mounting so page.tsx stays a thin Server Component
// wrapper. Every append-on-demand chapter lives here.
//
// Layout order (Philip 2026-08-17 · reordered to match the two-journey
// doctrine · Customer A staircase story flows top-to-bottom · Customer
// B parts door sits after the story closes):
//
//   ST-N01  (nav, sticky)
//   ST-H01  (hero)                          · "welcome to the staircase experience"
//   ST-T01  (trust bar)                     · "we're a serious maker"
//   ST-C01  (Staircase Types / Collections) · "what TYPE of staircase?"  → style
//   ST-M01  (Choose Your Wood)              · "what should it be MADE of?" → wood
//
// ST-W01 (Guided Design · 14-node wizard) is deliberately NOT part of
// the passive scroll (Philip 2026-08-18). The wizard now activates ONLY
// from the "Get A Quote" staircase-quote button — surfaced inside the
// Summit chat (ST-CH01) as an optional "Start guided design" chip. This
// keeps the landing-page story fully editorial · the wizard opens only
// when the customer has explicitly committed to a quote conversation.
//   [ST-D01 · Design Your Staircase — future · treads / risers / newels /
//            handrails / balustrades / finishes]
//   ST-AB01 (How It's Made)                 · "here's the process"
//   ST-B01  (Installation across the UK)    · "and we install anywhere"
//   ST-P01  (Staircase Parts & Accessories) · Customer B side door
//   [future append-on-demand sections mount here]
//   ST-F01  (footer)
//
// Adding an append-on-demand chapter (still supported for future
// chapters like Refacing, Stairparts, Finishes, Planner, Consultation):
//   1. Import the section component below.
//   2. Add its key to APPENDABLE (enables deep-link hash support).
//   3. Add its `{isActive("key") && <Reveal><Section /></Reveal>}` slot.
//   4. Add a `<ChapterOpener sectionKey="key" ... />` chip where the
//      user should be invited to continue.

"use client";

import { STN01 } from "./sections/ST-N01";
import { STH01 } from "./sections/ST-H01";
import { STT01 } from "./sections/ST-T01";
import { STC01 } from "./sections/ST-C01";
import { STB01 } from "./sections/ST-B01";
import { STM01 } from "./sections/ST-M01";
import { STAB01 } from "./sections/ST-AB01";
import { STP01 } from "./sections/ST-P01";
import { STF01 } from "./sections/ST-F01";
import { Reveal } from "./Reveal";
import {
  SectionActivationProvider,
  useSectionActivation,
} from "./SectionActivation";
import { StaircaseDesignProvider } from "./StaircaseDesign";
import { MT1_TOKENS as T } from "./tokens";

/** Every appendable section key MT-1 currently knows about. Extend as
 *  new chapters land. Used for URL-hash deep-link auto-activation.
 *
 *  · `materials-all-woods` — expanded complete-catalogue view of every
 *    timber, gated inside ST-M01. Hidden on the normal landing-page
 *    journey · revealed when the customer clicks "View All Woods →".
 *    Deep-link support: `#materials-all-woods` auto-activates on cold
 *    load. Both curated + expanded surfaces share the SAME
 *    `design.wood` state (Philip 2026-08-17).
 *
 *  · `parts-all` — expanded parts catalogue inside ST-P01 (Customer B
 *    commercial gateway per the two-journey doctrine). Hidden on the
 *    normal landing-page journey · revealed when the customer clicks
 *    "View All Parts →". Deep-link support: `#parts-all` auto-activates.
 *    Display-only for Phase 1 · commerce arrives later. */
const APPENDABLE = ["materials-all-woods", "parts-all"] as const;
type AppendableKey = (typeof APPENDABLE)[number];

export function Mt1ExperienceStream() {
  return (
    <SectionActivationProvider deepLinkKeys={APPENDABLE}>
      <StaircaseDesignProvider>
        <ExperienceStream />
      </StaircaseDesignProvider>
    </SectionActivationProvider>
  );
}

function ExperienceStream() {
  // Reserved for future append-on-demand chapters (Refacing, Stairparts,
  // Finishes, Consultation, Planner). Currently unused since Gallery
  // was merged into ST-C01 on 2026-08-17.
  //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { isActive } = useSectionActivation();

  return (
    <>
      {/* Core scroll · always mounted · establishes the master language.
          Order reflects the two-journey doctrine (see file header). */}
      <STN01 />
      <STH01 />
      <Reveal>
        <STT01 />
      </Reveal>
      <Reveal>
        <STC01 />
      </Reveal>
      <Reveal>
        <STM01 />
      </Reveal>
      {/* [ST-D01 · Design Your Staircase slot · future selectors:
          treads / risers / newels / handrails / balustrades / finishes.
          Reads/writes StaircaseDesign fields already declared in state.] */}
      {/* AB01 split so B01 (Installation banner) slides in between
          team cards and stats (Philip 2026-08-17). Team's Installation
          process card is the natural cue for "and here's where we can
          install" · putting B01 immediately after strengthens the
          narrative. Continuation instance renders cta only · stats
          band moved further down to sit just above the footer as the
          final proof-point band (Philip 2026-08-17). */}
      <Reveal>
        <STAB01 parts={["story", "team"]} />
      </Reveal>
      <Reveal>
        <STB01 />
      </Reveal>
      <Reveal>
        <STAB01 parts={["cta"]} />
      </Reveal>
      <Reveal>
        <STP01 />
      </Reveal>
      <Reveal>
        <STAB01 parts={["stats"]} />
      </Reveal>

      {/* Append-on-demand chapters land here as they ship. Pattern:
       *   {!isActive("key") && <ChapterOpener sectionKey="key" ... />}
       *   {isActive("key") && <Reveal><SectionX /></Reveal>}
       */}

      <Reveal>
        <STF01 />
      </Reveal>
    </>
  );
}

/** Chapter-end call-to-continue. Renders the same visual language as the
 *  chapter-break CTA cards in ST-M01 / ST-G01, so it reads as part of
 *  the continuous experience — never as a separate "menu". Clicking
 *  activates the target section and smooth-scrolls to it. */
function ChapterOpener({
  sectionKey,
  eyebrow,
  title,
  body,
  ctaLabel,
}: {
  sectionKey: AppendableKey;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
}) {
  const { activate } = useSectionActivation();

  return (
    <section
      className="mt1-opener"
      aria-label={`Open ${title}`}
      data-testid={`mt1-opener-${sectionKey}`}
    >
      <div className="mt1-opener-inner">
        <div className="mt1-opener-eyebrow">{eyebrow}</div>
        <h3 className="mt1-opener-title">{title}</h3>
        <p className="mt1-opener-body">{body}</p>
        <button
          type="button"
          className="mt1-opener-cta"
          onClick={() => activate(sectionKey)}
        >
          {ctaLabel} <span aria-hidden>→</span>
        </button>
      </div>

      <style jsx>{`
        .mt1-opener {
          background: ${T.color.surface};
          padding: clamp(40px, 6vw, 72px) 16px;
          font-family: ${T.font.sans};
        }
        .mt1-opener-inner {
          max-width: 720px;
          margin: 0 auto;
          background: ${T.color.surfaceSoft};
          border-radius: 16px;
          padding: clamp(24px, 4vw, 36px);
          text-align: center;
        }
        .mt1-opener-eyebrow {
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${T.color.accent};
        }
        .mt1-opener-title {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3.6vw, 28px);
          font-weight: 400;
          margin: 8px 0 10px;
          color: ${T.color.ink};
          line-height: 1.15;
        }
        .mt1-opener-body {
          margin: 0 auto 18px;
          max-width: 520px;
          font-size: 13.5px;
          color: ${T.color.inkMuted};
          line-height: 1.55;
        }
        .mt1-opener-cta {
          padding: 12px 20px;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          border-radius: ${T.radius.button};
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 140ms;
        }
        .mt1-opener-cta:hover,
        .mt1-opener-cta:focus-visible {
          background: ${T.color.accentDeep};
        }
      `}</style>
    </section>
  );
}
