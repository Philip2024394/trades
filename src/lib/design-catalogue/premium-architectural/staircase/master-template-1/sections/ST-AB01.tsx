// NEX Design Catalogue · Master Template 1 · Process / Team / Stats (ST-AB01).
//
// Philip 2026-08-17. Placed AFTER ST-M01 and BEFORE ST-F01.
//
// The "OUR STORY · A Legacy of Craftsmanship" framing was replaced on
// 2026-08-17 with an "OUR PROCESS" framing — the workflow story
// (Design → Production → Installation) is honest for any size operation
// while the Legacy story is only truthful for established companies.
// A small joiner or first-year workshop can now use this template
// without shipping fabricated dates or fake tenure.
//
// Layout (mobile-first · four stacked blocks):
//
//   1. PROCESS BLOCK · STEP 01 — "OUR PROCESS · 01 · Let's Design Your
//      Staircase" (Design accent italic). Left copy · centre sub-step
//      timeline (Consultation · Measurement · Materials · 3D Visual) ·
//      right large photo. Grid collapses to a single stacked column
//      below 1024 px.
//
//      NOTE (Philip 2026-08-17): The deeper 02 · Craft and 03 · Install
//      process blocks that briefly lived here were removed on the same
//      day · the 4 team process cards already summarise the workflow ·
//      an extra 2 detail blocks below the cards duplicated the story.
//
//   2. TEAM BLOCK — "THE PEOPLE BEHIND SUMMIT · Passionate Experts,
//      Dedicated to You"
//      4 team member cards (photo · name · role · one-liner · LinkedIn
//      chip). Grid 2 cols mobile → 4 cols ≥1024 px.
//
//   3. STATS BAND — dark navy card, 4 stats in a row (Projects · Years ·
//      UK Wide Service · Client Satisfaction). Icons drawn as inline SVG.
//      2 cols mobile → 4 cols ≥720 px.
//
//   4. BOTTOM CTA — cream chapter-break card, plant-vase illustration
//      blob on the left, "Let's Build Something Beautiful Together"
//      headline (Beautiful italic in accent), body, "Book a Free
//      Consultation →" primary CTA. Stacked mobile → 3-col row ≥720 px.
//
// Data-driven: every list (milestones · team · stats) has a default
// export via STAB01Config so a real company can override.
//
// Scroll target: id="about" so a nav button can jump here via href="#about".

import { MT1_TOKENS as T } from "../tokens";

// ── Data types ────────────────────────────────────────────────────

type Milestone = {
  year: string;
  title: string;
  description: string;
};

// TeamMember was originally 4 named individuals (James · Sophie · Daniel
// · Emily). Philip 2026-08-17 · reframed to 4 process/skill cards
// instead — small operations can't credibly claim 4 named staff, but
// every staircase business genuinely runs the same 4 processes. The
// data shape stays compatible with the person model (name/role/desc)
// so the JSX doesn't need re-writing · a process card sets `name` to
// the process name and leaves `linkedinUrl` undefined so the chip
// stays hidden.
type TeamMember = {
  name: string;
  role: string;
  description: string;
  /** Optional photo. Falls back to a warm gradient placeholder. */
  imageUrl?: string;
  /** LinkedIn chip · rendered ONLY when defined. Process cards omit. */
  linkedinUrl?: string;
};

type StatIcon = "projects" | "years" | "globe" | "star";

type StatItem = {
  icon: StatIcon;
  value: string;
  label: string;
  description: string;
};

// ── Defaults (placeholder company · "Summit") ─────────────────────

// Design sub-steps. Reuses the milestone type: `year` becomes the
// step ordinal (01/02/03/04), `title` the sub-step name.
const DEFAULT_MILESTONES: Milestone[] = [
  {
    year: "01",
    title: "Consultation",
    description:
      "We visit your home to understand your vision, style, and how you use the space.",
  },
  {
    year: "02",
    title: "Measurement",
    description:
      "Precise dimensions of the stairwell, walls, floor structure, and finishes.",
  },
  {
    year: "03",
    title: "Materials",
    description:
      "We help you choose the timber, finish, and hardware that suit your home.",
  },
  {
    year: "04",
    title: "3D Visual",
    description:
      "See a photorealistic render of your staircase before a single board is cut.",
  },
];


// 4 process cards (Philip 2026-08-17) · replaces the earlier named
// staff list · every staircase business genuinely runs these four
// processes regardless of team size, so this stays honest for a solo
// joiner or a 20-person workshop. `linkedinUrl` is intentionally
// omitted · the JSX hides the chip when undefined.
const DEFAULT_TEAM: TeamMember[] = [
  {
    name: "Design",
    role: "Consultation & 3D visual",
    description:
      "Understanding your vision, measuring precisely, and producing a 3D render so you approve the staircase before a single board is cut.",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2004_05_52%20PM.png",
  },
  {
    name: "Craftsmanship",
    role: "Workshop & joinery",
    description:
      "Timber selection, precision machining, hand joinery, and workshop finishing — every joint made to tolerance by the same team that will install it.",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2004_00_53%20PM.png",
  },
  {
    name: "Installation",
    role: "Site fit & handover",
    description:
      "Careful site preparation, precise on-site fitting, and a full handover so you know exactly what you have.",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2004_03_01%20PM.png",
  },
  {
    name: "Aftercare",
    role: "Support & warranty",
    description:
      "Ongoing care advice, warranty support, and service long after the install day.",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2004_09_18%20PM.png",
  },
];

const DEFAULT_STATS: StatItem[] = [
  {
    icon: "projects",
    value: "500+",
    label: "Projects Completed",
    description: "Across residential and commercial spaces.",
  },
  {
    icon: "years",
    value: "15+",
    label: "Years Experience",
    description: "Decades of expertise and knowledge.",
  },
  {
    icon: "globe",
    value: "UK Wide",
    label: "Service",
    description: "Proudly serving clients across the UK.",
  },
  {
    icon: "star",
    value: "98%",
    label: "Client Satisfaction",
    description: "Our clients love the results we deliver.",
  },
];

// ── Config ────────────────────────────────────────────────────────

export type STAB01Config = {
  /** Which of the AB01 sub-blocks to render, in order. Defaults to all
   *  four ["story","team","stats","cta"]. Splitting AB01 lets B01
   *  (Installation banner) slide in between team and stats:
   *
   *    <STAB01 parts={["story", "team"]} />
   *    <STB01 />
   *    <STAB01 parts={["stats", "cta"]} />
   *
   *  The `id="about"` scroll target is only rendered when `story` is
   *  in the parts array (avoids duplicate ids on the page). */
  parts?: Array<"story" | "team" | "stats" | "cta">;
  /** Small eyebrow above the process headline · defaults to "OUR PROCESS · 01".
   *  When Production (02) and Installation (03) blocks land they'll use the
   *  same eyebrow pattern with the next ordinal. */
  storyEyebrow?: string;
  /** Headline is composed as `{lead} {accent} {tail}` so the italic accent
   *  can sit in the middle of the phrase — e.g. "Let's Design Your Staircase"
   *  puts "Design" in italic accent while "Let's" / "Your Staircase" stay
   *  regular. Any part may be an empty string. */
  storyHeadlineLead?: string;
  storyHeadlineAccent?: string;
  storyHeadlineTail?: string;
  storyBody?: string[];
  milestones?: Milestone[];
  storyImageUrl?: string;

  teamEyebrow?: string;
  teamHeadlineLead?: string;
  teamHeadlineAccent?: string;
  teamBody?: string;
  team?: TeamMember[];

  stats?: StatItem[];

  ctaHeadlineLead?: string;
  ctaHeadlineAccent?: string;
  ctaHeadlineTail?: string;
  ctaBody?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

// ── Component ─────────────────────────────────────────────────────

export function STAB01(props: STAB01Config = {}) {
  const parts = props.parts ?? ["story", "team", "stats", "cta"];
  const showStory = parts.includes("story");
  const showTeam = parts.includes("team");
  const showStats = parts.includes("stats");
  const showCta = parts.includes("cta");
  const isContinuation = !showStory;

  const storyEyebrow = props.storyEyebrow ?? "OUR PROCESS · 01";
  const storyHeadlineLead = props.storyHeadlineLead ?? "Let's";
  const storyHeadlineAccent = props.storyHeadlineAccent ?? "Design";
  const storyHeadlineTail = props.storyHeadlineTail ?? "Your Staircase";
  const storyBody = props.storyBody ?? [
    "The design step turns your vision into a workable plan. On-site consultation, precise measurement, material choice, and a 3D visual — so you can approve the finished staircase before we cut a single board.",
  ];
  const milestones = props.milestones ?? DEFAULT_MILESTONES;
  // Design step · large image restored (Philip 2026-08-17). This is the
  // ONLY large image for Step 01 · Craft (02) and Install (03) each
  // have their own images set below.
  const storyImageUrl =
    props.storyImageUrl ??
    "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2003_57_28%20PM.png";

  // Build (02) and Install (03) deep process blocks were removed on
  // 2026-08-17 · the 4 team process cards (Design · Craftsmanship ·
  // Installation · Aftercare) that sit right after the Design image
  // already summarise the whole workflow · deeper blocks below the
  // team cards were redundant.

  const teamEyebrow = props.teamEyebrow ?? "THE PEOPLE BEHIND SUMMIT";
  const teamHeadlineLead = props.teamHeadlineLead ?? "Our Skilled";
  const teamHeadlineAccent = props.teamHeadlineAccent ?? "Staircase Team";
  const teamBody =
    props.teamBody ??
    "Our team of designers, craftsmen, and project specialists work closely with you to bring your vision to life with care, precision, and integrity.";
  const team = props.team ?? DEFAULT_TEAM;

  const stats = props.stats ?? DEFAULT_STATS;

  const ctaHeadlineLead = props.ctaHeadlineLead ?? "Ready to design";
  const ctaHeadlineAccent = props.ctaHeadlineAccent ?? "your";
  const ctaHeadlineTail = props.ctaHeadlineTail ?? "staircase?";
  const ctaBody =
    props.ctaBody ??
    "Every project starts with a 20-minute design conversation — on site or by video. No pressure, no obligation, just an honest sense of what's possible in your space.";
  const ctaLabel = props.ctaLabel ?? "Book a design conversation";
  const ctaHref = props.ctaHref ?? "#chat";

  const sectionExtraProps = showStory
    ? { id: "about", "aria-labelledby": "mt1-ab01-story-title" }
    : { "aria-label": "About us — continued" };

  return (
    <section
      className={`mt1-ab01 ${isContinuation ? "mt1-ab01--continuation" : ""}`}
      {...sectionExtraProps}
    >
      <div className="mt1-ab01-inner">
        {/* ── 1 · STORY BLOCK ───────────────────────────────── */}
        {showStory && (
          <div className="mt1-ab01-story">
            <div className="mt1-ab01-story-copy">
              <h2 id="mt1-ab01-story-title" className="mt1-ab01-headline">
                {storyHeadlineLead}
                {storyHeadlineLead ? " " : ""}
                <span className="mt1-ab01-headline-accent mt1-ab01-headline-italic">
                  {storyHeadlineAccent}
                </span>
                {storyHeadlineTail ? " " : ""}
                {storyHeadlineTail}
              </h2>
              <div aria-hidden className="mt1-ab01-rule" />
              {storyBody.map((p, i) => (
                <p key={i} className="mt1-ab01-body">
                  {p}
                </p>
              ))}
            </div>

            {/* Photo now carries the 4 process sub-steps as an OVERLAY
                (Philip 2026-08-17) · removed the separate centre timeline
                column · grid drops from 3-col to 2-col at desktop so the
                photo takes more of the width. Overlay uses a gradient
                scrim at the bottom for text contrast; milestones sit in
                a 2×2 grid inside so all four fit on the image itself. */}
            <div className="mt1-ab01-story-photo">
              <div
                className="mt1-ab01-story-photo-img"
                style={
                  storyImageUrl
                    ? {
                        backgroundImage: `url(${storyImageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                      }
                    : undefined
                }
                aria-hidden
              />
              <div className="mt1-ab01-photo-overlay" aria-hidden>
                <div className="mt1-ab01-photo-milestones">
                  {milestones.map((m) => (
                    <div key={m.year} className="mt1-ab01-photo-milestone">
                      <div className="mt1-ab01-photo-milestone-year">{m.year}</div>
                      <div className="mt1-ab01-photo-milestone-title">
                        {m.title}
                      </div>
                      <div className="mt1-ab01-photo-milestone-desc">
                        {m.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Screen-reader copy of the milestones · the visual overlay
                  is aria-hidden because it sits over the photo · the SR
                  needs a plain list. */}
              <ol className="mt1-ab01-photo-sr">
                {milestones.map((m) => (
                  <li key={m.year}>
                    <span>Step {m.year} · {m.title}.</span> {m.description}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* ── 2 · TEAM BLOCK · sits AFTER the Design large image
            (Philip 2026-08-17). Places the 4 process/skill cards
            (Design · Craftsmanship · Installation · Aftercare) as a
            summary of what the team does, BEFORE the deeper 02/03
            process blocks that walk through the workflow. */}
        {showTeam && (
          <>
            <div className="mt1-ab01-team-head">
              <div className="mt1-ab01-team-copy">
                <div className="mt1-ab01-eyebrow">{teamEyebrow}</div>
                <h2 className="mt1-ab01-headline">
                  {teamHeadlineLead}
                  <br />
                  <span className="mt1-ab01-headline-accent mt1-ab01-headline-italic">
                    {teamHeadlineAccent}
                  </span>
                </h2>
              </div>
              <p className="mt1-ab01-team-body">{teamBody}</p>
            </div>

            <div className="mt1-ab01-team-grid">
              {team.map((m) => (
                <article key={m.name} className="mt1-ab01-member">
                  <div
                    className="mt1-ab01-member-photo"
                    style={
                      m.imageUrl
                        ? {
                            backgroundImage: `url(${m.imageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                          }
                        : undefined
                    }
                    aria-hidden
                  />
                  <div className="mt1-ab01-member-body">
                    <div className="mt1-ab01-member-name">{m.name}</div>
                    <div className="mt1-ab01-member-role">{m.role}</div>
                    <div className="mt1-ab01-member-desc">{m.description}</div>
                    {m.linkedinUrl && (
                      <a
                        href={m.linkedinUrl}
                        className="mt1-ab01-member-linkedin"
                        aria-label={`${m.name} on LinkedIn`}
                      >
                        <LinkedInGlyph />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {/* ── 3 · STATS BAND ─────────────────────────────────── */}
        {showStats && (
          <div className="mt1-ab01-stats" role="list">
            {stats.map((s) => (
              <div key={s.label} className="mt1-ab01-stat" role="listitem">
                <div className="mt1-ab01-stat-icon" aria-hidden>
                  <StatIconSvg kind={s.icon} />
                </div>
                <div className="mt1-ab01-stat-body">
                  <div className="mt1-ab01-stat-value">{s.value}</div>
                  <div className="mt1-ab01-stat-label">{s.label}</div>
                  <div className="mt1-ab01-stat-desc">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 4 · BOTTOM CTA ─────────────────────────────────── */}
        {showCta && (
          <div className="mt1-ab01-cta">
            <div className="mt1-ab01-cta-vase" aria-hidden />
            <div className="mt1-ab01-cta-copy">
              <h3 className="mt1-ab01-cta-title">
                {ctaHeadlineLead}{" "}
                <span className="mt1-ab01-headline-accent mt1-ab01-headline-italic">
                  {ctaHeadlineAccent}
                </span>{" "}
                {ctaHeadlineTail}
              </h3>
              <p className="mt1-ab01-cta-body">{ctaBody}</p>
            </div>
            <a href={ctaHref} className="mt1-ab01-cta-btn">
              {ctaLabel} <span aria-hidden>→</span>
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        /* ── Section shell · mobile-first ──────────────────────────── */
        .mt1-ab01 {
          background: ${T.color.surface};
          padding: ${T.spacing.sectionPaddingBlock} 16px;
          font-family: ${T.font.sans};
          scroll-margin-top: 80px;
        }
        /* Continuation variant · rendered when B01 is inserted between
           team and stats · trims the top padding so the split reads as
           one continuous section, not two loosely-spaced ones. */
        .mt1-ab01.mt1-ab01--continuation {
          padding-top: clamp(8px, 1.5vw, 24px);
        }
        /* First block inside the continuation drops its own top margin
           so it hugs the trimmed section padding. */
        .mt1-ab01--continuation .mt1-ab01-inner > *:first-child {
          margin-top: 0;
        }
        .mt1-ab01-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ── Shared typography ────────────────────────────────────── */
        .mt1-ab01-eyebrow {
          font-size: 11px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: ${T.color.accent};
          font-weight: 600;
        }
        .mt1-ab01-headline {
          margin: 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: ${T.color.ink};
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.15;
          letter-spacing: -0.01em;
        }
        .mt1-ab01-headline-accent {
          color: ${T.color.ink};
          font-style: italic;
        }
        .mt1-ab01-headline-italic {
          color: ${T.color.accent};
        }
        .mt1-ab01-rule {
          width: 48px;
          height: 3px;
          background: ${T.color.accent};
          border-radius: 2px;
          margin: 16px 0 20px;
        }
        .mt1-ab01-body {
          font-size: 14px;
          color: ${T.color.inkMuted};
          line-height: 1.65;
          margin: 0 0 14px;
        }
        .mt1-ab01-body:last-child {
          margin-bottom: 0;
        }

        /* ── 1. Process step block · single-col mobile · 3-col ≥1024 */
        .mt1-ab01-story {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
        }
        @media (min-width: 1024px) {
          .mt1-ab01-story {
            /* 2-col at desktop: copy | photo-with-overlay · previously
               3-col with a separate timeline column · sub-steps are now
               overlaid on the photo itself. */
            grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
            gap: 36px;
            align-items: start;
          }
        }

        /* Story photo · overlays the 4 process sub-steps on the image */
        .mt1-ab01-story-photo {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
        }
        .mt1-ab01-story-photo-img {
          width: 100%;
          aspect-ratio: 4 / 5;
          border-radius: 12px;
          background: linear-gradient(160deg, #6b4a2c 0%, #3a2617 60%, #22150c 100%);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        @media (min-width: 1024px) {
          .mt1-ab01-story-photo-img {
            /* Slightly taller on desktop so the overlay's 2×2 milestone
               grid has room to breathe on the bottom half. */
            aspect-ratio: 4 / 5;
          }
        }
        /* Bottom-scrim overlay · gradient reveals the photo at top and
           darkens at bottom so the light overlay text stays readable. */
        .mt1-ab01-photo-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: clamp(14px, 2vw, 22px);
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0) 32%,
            rgba(0, 0, 0, 0.55) 62%,
            rgba(0, 0, 0, 0.82) 100%
          );
          color: #fff;
          pointer-events: none;
        }
        .mt1-ab01-photo-milestones {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(12px, 1.6vw, 18px);
        }
        .mt1-ab01-photo-milestone {
          color: #fff;
        }
        .mt1-ab01-photo-milestone-year {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 26px;
          height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          background: ${T.color.accent};
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
        }
        .mt1-ab01-photo-milestone-title {
          margin-top: 8px;
          font-family: ${T.font.serif};
          font-size: clamp(14px, 1.5vw, 17px);
          line-height: 1.15;
          color: #fff;
        }
        .mt1-ab01-photo-milestone-desc {
          margin-top: 4px;
          font-size: clamp(11px, 1.1vw, 12.5px);
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.82);
        }
        /* Visually hidden screen-reader list · keeps the overlay text
           accessible without duplicating the visual milestones. */
        .mt1-ab01-photo-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        /* ── 2. Team block ────────────────────────────────────────── */
        .mt1-ab01-team-head {
          margin-top: clamp(48px, 6vw, 72px);
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          align-items: end;
        }
        @media (min-width: 1024px) {
          .mt1-ab01-team-head {
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
        }
        .mt1-ab01-team-body {
          margin: 0;
          font-size: 14px;
          color: ${T.color.inkMuted};
          line-height: 1.65;
        }
        .mt1-ab01-team-grid {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (min-width: 1024px) {
          .mt1-ab01-team-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
        }

        .mt1-ab01-member {
          background: ${T.color.surfaceCard};
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid ${T.color.hairline};
          display: flex;
          flex-direction: column;
        }
        .mt1-ab01-member-photo {
          width: 100%;
          aspect-ratio: 4 / 3;
          background: linear-gradient(150deg, #d6c1a5 0%, #a78562 60%, #6f4f2e 100%);
        }
        .mt1-ab01-member-body {
          padding: 14px 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .mt1-ab01-member-name {
          font-family: ${T.font.serif};
          font-size: 16px;
          color: ${T.color.ink};
          font-weight: 500;
        }
        .mt1-ab01-member-role {
          font-size: 12px;
          color: ${T.color.accent};
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .mt1-ab01-member-desc {
          margin-top: 4px;
          font-size: 12px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
        }
        .mt1-ab01-member-linkedin {
          align-self: flex-start;
          margin-top: 10px;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: ${T.color.accent};
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          transition: background 140ms;
        }
        .mt1-ab01-member-linkedin:hover {
          background: ${T.color.accentDeep};
        }

        /* ── 3. Dark stats band ───────────────────────────────────── */
        .mt1-ab01-stats {
          margin-top: clamp(48px, 6vw, 72px);
          background: #12192b;
          border-radius: 14px;
          padding: 24px;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        @media (min-width: 720px) {
          .mt1-ab01-stats {
            grid-template-columns: repeat(4, 1fr);
            padding: 28px 32px;
            gap: 24px;
          }
        }
        .mt1-ab01-stat {
          display: grid;
          grid-template-columns: 36px 1fr;
          gap: 12px;
          align-items: start;
          color: #fff;
        }
        .mt1-ab01-stat-icon {
          width: 36px;
          height: 36px;
          color: ${T.color.accent};
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .mt1-ab01-stat-icon :global(svg) {
          width: 24px;
          height: 24px;
          stroke: currentColor;
          fill: none;
          stroke-width: 1.6;
        }
        .mt1-ab01-stat-value {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3vw, 26px);
          color: #fff;
          line-height: 1;
        }
        .mt1-ab01-stat-label {
          margin-top: 2px;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.92);
          font-weight: 600;
        }
        .mt1-ab01-stat-desc {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.62);
          line-height: 1.55;
        }

        /* ── 4. Bottom CTA ────────────────────────────────────────── */
        .mt1-ab01-cta {
          margin-top: clamp(40px, 5vw, 56px);
          background: ${T.color.surfaceSoft};
          border-radius: 16px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: center;
          text-align: center;
        }
        @media (min-width: 720px) {
          .mt1-ab01-cta {
            padding: 28px 32px;
            grid-template-columns: auto 1fr auto;
            gap: 28px;
            text-align: left;
          }
        }
        .mt1-ab01-cta-vase {
          width: 110px;
          height: 110px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 30% 35%, #f2ede1 0%, #e2d6bd 45%, #b09a75 100%);
          justify-self: center;
        }
        .mt1-ab01-cta-copy {
          display: grid;
          gap: 8px;
        }
        .mt1-ab01-cta-title {
          margin: 0;
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3.6vw, 30px);
          color: ${T.color.ink};
          line-height: 1.15;
          font-weight: 400;
        }
        .mt1-ab01-cta-body {
          margin: 0;
          font-size: 13.5px;
          color: ${T.color.inkMuted};
          line-height: 1.55;
        }
        .mt1-ab01-cta-btn {
          justify-self: center;
          padding: 12px 20px;
          background: ${T.color.accent};
          color: #fff;
          border-radius: ${T.radius.button};
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 140ms;
        }
        @media (min-width: 720px) {
          .mt1-ab01-cta-btn {
            justify-self: end;
          }
        }
        .mt1-ab01-cta-btn:hover {
          background: ${T.color.accentDeep};
        }
      `}</style>
    </section>
  );
}

// ── Inline SVG icons ──────────────────────────────────────────────

function StatIconSvg({ kind }: { kind: StatIcon }) {
  switch (kind) {
    case "projects":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 12 L12 4 L20 12" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10 V20 H18 V10" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20 V14 H14 V20" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "years":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="9" cy="9" r="3" />
          <path d="M3 20c1-4 3-6 6-6s5 2 6 6" strokeLinecap="round" />
          <circle cx="17" cy="10" r="2.5" />
          <path d="M14 20c.7-3 2-4.5 4-4.5s3 1 4 3" strokeLinecap="round" />
        </svg>
      );
    case "globe":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12 H20 M12 4 A11 11 0 0 1 12 20 A11 11 0 0 1 12 4" strokeLinecap="round" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24">
          <path
            d="M12 3 L14.5 9 L21 9.5 L16 14 L17.5 20.5 L12 17 L6.5 20.5 L8 14 L3 9.5 L9.5 9 Z"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5 2.5 2.5 0 0 1 4.98 3.5ZM3 10h4v11H3V10Zm7 0h3.8v1.6h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-4.85c0-1.15-.02-2.63-1.75-2.63-1.75 0-2.02 1.25-2.02 2.55V21h-4V10Z" />
    </svg>
  );
}
