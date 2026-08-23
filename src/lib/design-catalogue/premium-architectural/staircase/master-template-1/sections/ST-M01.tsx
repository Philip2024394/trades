// NEX Design Catalogue · Master Template 1 · Materials section (ST-M01).
//
// Philip 2026-08-17. Placed AFTER ST-B01 ("Installation service Across
// the UK") and BEFORE ST-F01 in the page composition.
//
// CHOOSE-YOUR-WOOD rework (Philip 2026-08-17 · Phase 1 architecture):
// The "Choose Your Wood" surface is the beginning of the customer's
// staircase configuration journey. Cards are interactive · clicking a
// wood writes to the shared StaircaseDesign state (`design.wood = slug`)
// so downstream sections can read it. A detail panel expands INLINE
// below the grid when a wood is selected · uses only fields we have
// verified data for (hardness / origin / story slots stay hidden until
// authoritative content is provided · never fabricated). "View All
// Woods →" anchors to `#materials-all-woods` — a Compare Woods sub-
// section below the detail panel.
//
// Layout (mobile-first):
//   • Centred header · eyebrow "CHOOSE YOUR WOOD" + serif headline
//     "Every staircase begins with the character of its timber."
//   • Wood grid: 2 cols mobile, 4 cols ≥640 px, 4 cols + right sidebar
//     ≥1024 px. Each card is a button — click writes to design state.
//   • Wood detail panel · appears inline below the grid ONLY when a
//     wood is selected. Renders name · description · large visual (uses
//     the swatch until a per-wood staircase render lands) · "close" +
//     "view all woods" nav. Hardness / origin / story slots are wired
//     but conditionally hidden pending authoritative data.
//   • "The Beauty of Natural Wood" panel below (unchanged).
//   • `#materials-all-woods` Compare Woods grid below (all 8 in a
//     larger 2-col comparison layout).
//   • "Staircase Parts & Accessories" head + 8-tile parts row.
//   • Two chapter-break CTAs at the bottom (unchanged).
//
// Scroll targets: id="materials" (whole section), id="materials-all-
// woods" (Compare Woods anchor at the bottom of the wood block).
//
// NOT FABRICATED · pending data:
//   • Per-wood staircase renders (same geometry, 8 woods) — Phase 4
//   • Hardness / durability / stability ratings — verified data pending
//   • Popularity signal — needs authoritative source
//   • Origin / story copy — pending

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MT1_TOKENS as T } from "../tokens";
import { useStaircaseDesign } from "../StaircaseDesign";
import { useSectionActivation } from "../SectionActivation";

/** Wood card · extended for the Choose-Your-Wood experience. Every
 *  optional field defaults to undefined so the rendering code hides its
 *  slot cleanly — no placeholder / no fabrication. When authoritative
 *  data lands, populating a field simply reveals its UI slot. */
type WoodCard = {
  /** Canonical slug written to StaircaseDesign state · e.g. "oak". */
  slug: string;
  name: string;
  /** Short one-liner shown on the compact card and in the detail head. */
  description: string;
  /** Close-up grain swatch · used on the compact card AND as the large
   *  visual in the detail panel until a per-wood staircase render lands.
   *  When `staircaseImageUrl` is set, the detail panel uses that instead. */
  imageUrl?: string;
  /** Per-wood full-staircase render · Phase 4 asset · same camera and
   *  geometry across every wood so customers compare timber not layout.
   *  When present, becomes the large visual in the detail panel. */
  staircaseImageUrl?: string;
  /** Fallback tone for placeholder gradients. */
  tone: string;

  /** Curated primary selection · shown in the top "Choose Your Wood"
   *  grid. Un-flagged woods appear ONLY in the expanded "Explore All
   *  Woods" catalogue that reveals after the customer clicks "View
   *  All Woods →". This is information hierarchy, not tiering — every
   *  wood is available; the curated set just leads the journey. */
  featured?: boolean;

  // ── Phase 3 fields · populated only when authoritative data exists.
  // ── Never fabricate any of these. UI hides each slot when undefined.

  /** Natural colour description · e.g. "Warm honey to pale gold". */
  colour?: string;
  /** Grain character · e.g. "Open, straight". */
  grain?: string;
  /** Origin sentence · verified sourcing statement. */
  origin?: string;
  /** Two-sentence emotional story about the timber. */
  story?: string;
  /** Popularity signal · only set when an authoritative source
   *  (customer selection volume / claim data / sales) supports it. */
  popularity?: "featured" | "popular";
  /** Technical ratings 1-5 · SET ONLY when the measurement + scale is
   *  defined and defensible. Do NOT map subjective descriptors like
   *  "hard" to a star count. */
  hardness?: 1 | 2 | 3 | 4 | 5;
  durability?: 1 | 2 | 3 | 4 | 5;
  stability?: 1 | 2 | 3 | 4 | 5;

  // ── Qualitative attributes for the full-detail flip view (Philip
  // ── 2026-08-17). Use conservative descriptors, never invented
  // ── Janka numbers or fabricated specifics.

  /** Timber classification. */
  type?: "hardwood" | "softwood";
  /** Qualitative hardness grade · not a Janka number. */
  hardnessGrade?: "Very hard" | "Hard" | "Medium" | "Soft";
  /** Where the staircase is suited. */
  suitability?: "domestic" | "commercial" | "both";
  /** Everyday wear characteristic. */
  scratchResistance?: "Highly resistant" | "Resistant" | "Moderate" | "Marks easily";
  /** Off-the-shelf availability. Standard-stock timbers have a wide
   *  parts range on the shelf (Oak · Pine · Knotty Pine). Limited
   *  timbers ship largely as bespoke / to-order (Ash · Walnut · Maple
   *  · Cherry · Mahogany · Teak). */
  availability?: "standard-stock" | "limited";

  /** Species character narrative · 1-2 sentences of editorial writing
   *  that anchor the wood's personality (colour, grain, patina). Never
   *  fabricated species facts · use conservative descriptors that a
   *  reasonable timber merchant would agree with. */
  character?: string;
  /** Design pairings · short comma-separated list of staircase styles
   *  this timber traditionally suits. Editorial suggestion, not a
   *  restriction · the customer can pair any wood with any style. */
  pairings?: string;
};

// Real wood swatch photography · Philip 2026-08-17. Each URL is a
// close-up grain shot supplied via ImageKit. Placeholders (`tone`)
// retained as a defensive fallback if an image ever fails to load.
// Phase 3 fields (colour · grain · origin · story · popularity ·
// hardness · durability · stability) are intentionally absent — the
// UI hides those slots until authoritative data is added here. Do
// not fabricate.
const DEFAULT_WOODS: WoodCard[] = [
  {
    slug: "oak",
    name: "Oak",
    description: "Timeless strength with classic natural grain.",
    tone: "#D4B896",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasd.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_32_03%20PM.png",
    featured: true,
    type: "hardwood",
    hardnessGrade: "Very hard",
    suitability: "both",
    scratchResistance: "Resistant",
    availability: "standard-stock",
    origin: "European Oak",
    character:
      "The default timber of British staircase making. Warm honey tones that deepen with age, an open grain that reads confidently at any scale, and the structural integrity to carry a flight for generations.",
    pairings: "Traditional · Modern · Bespoke",
  },
  {
    slug: "ash",
    name: "Ash",
    description: "Light tones with beautiful straight grain.",
    tone: "#E8D4B0",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasdsd.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_33_28%20PM.png",
    featured: true,
    type: "hardwood",
    hardnessGrade: "Hard",
    suitability: "both",
    scratchResistance: "Resistant",
    availability: "limited",
    origin: "European Ash",
    character:
      "Pale, uniform, and unmistakably clean. Ash brings light into a stairwell where oak would darken it — its straight grain and blond tone suit modern interiors that prize calm over ornament.",
    pairings: "Modern · Scandinavian · Minimalist",
  },
  {
    slug: "walnut",
    name: "Walnut",
    description: "Rich, dark tones for a luxurious finish.",
    tone: "#6B4423",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasd.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_32_34%20PM.png",
    featured: true,
    type: "hardwood",
    hardnessGrade: "Hard",
    suitability: "domestic",
    scratchResistance: "Moderate",
    availability: "limited",
    origin: "American / European Walnut",
    character:
      "The luxury timber. Chocolate browns with occasional purple heartwood, a subtle chatoyance in the light, and a grain that reads as intention. Reserved for staircases that want to be looked at.",
    pairings: "Modern · Contemporary · Statement",
  },
  {
    slug: "pine",
    name: "Pine",
    description: "Natural charm with rustic character.",
    tone: "#E4C89A",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasdsddsasdasdsd.png",
    featured: true,
    type: "softwood",
    hardnessGrade: "Soft",
    suitability: "domestic",
    scratchResistance: "Marks easily",
    availability: "standard-stock",
    origin: "European / Scandinavian Pine",
    character:
      "The workhorse softwood. Pale, warm and honest — pine takes stain beautifully and paints even better, which makes it the go-to for cottage staircases and painted flights alike.",
    pairings: "Traditional · Cottage · Painted",
  },
  {
    slug: "maple",
    name: "Maple",
    description: "Smooth, fine grain with subtle elegance.",
    tone: "#EAD9BA",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasdsdds.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_33_00%20PM.png",
    type: "hardwood",
    hardnessGrade: "Very hard",
    suitability: "both",
    scratchResistance: "Highly resistant",
    availability: "limited",
    origin: "North American Maple",
    character:
      "Fine, tight, and almost porcelain-smooth in figure. Maple is what you choose when you want the surface to disappear and the shape of the staircase itself to carry the room.",
    pairings: "Modern · Contemporary · Commercial",
  },
  {
    slug: "cherry",
    name: "Cherry",
    description: "Warm hues that deepen over time.",
    tone: "#C97D5F",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasdsddsasd.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_49_02%20PM.png",
    type: "hardwood",
    hardnessGrade: "Medium",
    suitability: "domestic",
    scratchResistance: "Moderate",
    availability: "limited",
    origin: "American Cherry",
    character:
      "Cherry ages like nothing else. Fresh, it's a warm salmon-pink; within a few years it deepens to a rich amber that quietly pulls sunlight across a room. Choose it if you want a staircase that gets better with time.",
    pairings: "Traditional · Period · Bespoke",
  },
  {
    slug: "mahogany",
    name: "Mahogany",
    description: "Deep reddish tones with lasting durability.",
    tone: "#75331E",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasdsddsasdasd.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_34_37%20PM.png",
    type: "hardwood",
    hardnessGrade: "Hard",
    suitability: "both",
    scratchResistance: "Resistant",
    availability: "limited",
    origin: "Central / South American Mahogany",
    character:
      "The classical staircase timber. Deep reddish-brown with a straight, understated grain, mahogany is the finish you see in the great English houses — dense, stable, and quietly formal.",
    pairings: "Traditional · Period · Formal",
  },
  {
    slug: "knotty-pine",
    name: "Knotty Pine",
    description: "Distinctive knots for a unique look.",
    tone: "#D9AF7C",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdasdasdsddsasdasdsdsd.png",
    staircaseImageUrl:
      "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2007_37_07%20PM.png",
    type: "softwood",
    hardnessGrade: "Soft",
    suitability: "domestic",
    scratchResistance: "Marks easily",
    availability: "standard-stock",
    origin: "European Pine (knotty grade)",
    character:
      "Character over correctness. Knotty pine wears its imperfections as design features — every knot is a signature, ideal for cottage, coastal, and rustic staircases that thrive on warmth over polish.",
    pairings: "Cottage · Coastal · Rustic",
  },
];

// Parts extracted to ST-P01 on 2026-08-17 per the two-journey doctrine.
// ST-M01 is now Customer A's staircase / wood / design journey ONLY.
// Parts (Newels · Handrails · Balusters · Treads · Risers · Stringers ·
// T&G Sheeting · Paneling) live in ST-P01, which is Customer B's
// commercial parts gateway. Do not re-add parts here.

export type STM01Config = {
  /** Small tracked-uppercase eyebrow above the section headline. */
  sectionEyebrow?: string;
  /** Large serif section headline · centred. */
  sectionHeadline?: string;
  /** Supporting one-liner below the section headline. */
  sectionSupport?: string;
  woods?: WoodCard[];
  sampleCtaHref?: string;
  consultationCtaHref?: string;
};

export function STM01(props: STM01Config = {}) {
  const sectionEyebrow = props.sectionEyebrow ?? "CHOOSE YOUR WOOD";
  const sectionHeadline =
    props.sectionHeadline ?? "Every staircase begins with the character of its timber.";
  const sectionSupport = props.sectionSupport;

  const woods = props.woods ?? DEFAULT_WOODS;
  // Curated primary set for the top "Choose Your Wood" grid · falls
  // back to the full list if nothing is flagged so the section stays
  // usable if a caller ships woods without featured flags. The full
  // list feeds the gated "Explore All Woods" catalogue below.
  const featuredWoods = woods.some((w) => w.featured)
    ? woods.filter((w) => w.featured)
    : woods;
  const { design, set } = useStaircaseDesign();
  const { isActive, activate } = useSectionActivation();
  const catalogueActive = isActive("materials-all-woods");

  const selectedSlug = design.wood;
  const selectedWood = woods.find((w) => w.slug === selectedSlug) ?? null;

  // View-mode flip pattern (Philip 2026-08-17). ST-M01 has 3 mutually-
  // exclusive faces the section can present:
  //   - "featured":  eyebrow + curated 4 + "View All Wood Materials →"
  //   - "catalogue": ← Back + "All Wood Materials" + all 8 prominent cards
  //   - "detail":    ← Back + selected wood image left + rich details right
  //
  // A face swap animates in via `mt1-m01-flip-in` for the flip feel.
  // `priorMode` tracks where a detail view was entered from, so Back
  // returns to the correct face.
  //
  // Selection authority stays on `design.wood` (StaircaseDesign). View
  // mode is purely local UI state — never persisted, never written to
  // shared design state.
  type ViewMode = "featured" | "catalogue" | "detail";
  const [viewMode, setViewMode] = useState<ViewMode>("featured");
  const [priorMode, setPriorMode] = useState<"featured" | "catalogue">(
    "featured",
  );

  // Deep-link support: cold-load with #materials-all-woods opens the
  // catalogue face after hydration. Consumed ONCE via a ref so clicking
  // "← Back" doesn't get re-forced back into catalogue (the
  // SectionActivation state persists across the session and would
  // otherwise re-trigger this effect on every viewMode change).
  const deepLinkConsumed = useRef(false);
  useEffect(() => {
    if (deepLinkConsumed.current) return;
    if (catalogueActive) {
      deepLinkConsumed.current = true;
      setViewMode("catalogue");
      setPriorMode("catalogue");
    }
  }, [catalogueActive]);

  const openCatalogueView = useCallback(() => {
    activate("materials-all-woods");
    setViewMode("catalogue");
    setPriorMode("catalogue");
  }, [activate]);

  const openDetail = useCallback(
    (slug: string, from: "featured" | "catalogue") => {
      set("wood", slug);
      setPriorMode(from);
      setViewMode("detail");
    },
    [set],
  );

  const backFromDetail = useCallback(() => {
    setViewMode(priorMode);
  }, [priorMode]);

  const backToFeatured = useCallback(() => {
    setViewMode("featured");
    setPriorMode("featured");
  }, []);

  const sampleCtaHref = props.sampleCtaHref ?? "#chat";
  const consultationCtaHref = props.consultationCtaHref ?? "#chat";

  return (
    <section id="materials" className="mt1-m01" aria-labelledby="mt1-m01-headline">
      <div className="mt1-m01-inner">
        {/* Section header · adapts per view mode. In featured mode it
            keeps the marketing eyebrow + headline. In catalogue mode it
            becomes a Back-nav header. In detail mode it hides — the
            detail face carries its own header inside. */}
        {viewMode === "featured" && (
          <div className="mt1-m01-section-head">
            <div className="mt1-m01-section-eyebrow">{sectionEyebrow}</div>
            <h2 id="mt1-m01-headline" className="mt1-m01-section-headline">
              {sectionHeadline}
            </h2>
          </div>
        )}

        {viewMode === "catalogue" && (
          <div
            className="mt1-m01-section-head mt1-m01-section-head--nav"
            id="materials-all-woods"
          >
            <button
              type="button"
              className="mt1-m01-back"
              onClick={backToFeatured}
              aria-label="Back to Wood Materials"
            >
              <span aria-hidden>←</span> Back
            </button>
            <h2 id="mt1-m01-headline" className="mt1-m01-section-headline">
              All Wood Materials
            </h2>
            <div className="mt1-m01-back-spacer" aria-hidden />
          </div>
        )}

        {viewMode === "detail" && selectedWood && (
          <div className="mt1-m01-section-head mt1-m01-section-head--nav">
            <button
              type="button"
              className="mt1-m01-back"
              onClick={backFromDetail}
              aria-label={
                priorMode === "catalogue"
                  ? "Back to all wood materials"
                  : "Back to Wood Materials"
              }
            >
              <span aria-hidden>←</span> Back
            </button>
            <h2 id="mt1-m01-headline" className="mt1-m01-section-headline">
              {selectedWood.name}
            </h2>
            <div className="mt1-m01-back-spacer" aria-hidden />
          </div>
        )}

        {/* Flip stage · exactly ONE face renders at a time. The React
            `key` on the mounted face plus the mt1-m01-flip-in keyframe
            gives the flip-in animation on every mode transition without
            requiring true 3D backface swapping. */}
        <div className="mt1-m01-stage" data-mode={viewMode}>
          {viewMode === "featured" && (
            <div className="mt1-m01-face" key="face-featured">
              <div className="mt1-m01-head">
                <h2 className="mt1-m01-title">Wood Materials</h2>
                <button
                  type="button"
                  className="mt1-m01-viewall mt1-m01-viewall-btn"
                  onClick={openCatalogueView}
                  aria-controls="materials-all-woods"
                >
                  View All Wood Materials <span aria-hidden>→</span>
                </button>
              </div>
              <div
                className="mt1-m01-grid"
                role="radiogroup"
                aria-label="Choose your wood"
              >
                {featuredWoods.map((w) => {
                  const isSelected = w.slug === selectedSlug;
                  return (
                    <button
                      key={w.slug}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Open ${w.name} detail`}
                      onClick={() => openDetail(w.slug, "featured")}
                      className={`mt1-m01-card ${isSelected ? "is-selected" : ""}`}
                    >
                      <div
                        className="mt1-m01-swatch"
                        style={{
                          background: w.imageUrl
                            ? `url(${w.imageUrl}) center/cover no-repeat`
                            : `linear-gradient(140deg, ${w.tone} 0%, ${w.tone} 55%, rgba(0,0,0,0.15) 100%)`,
                        }}
                        aria-hidden
                      />
                      {isSelected && (
                        <span className="mt1-m01-selected-dot" aria-hidden>
                          ✓
                        </span>
                      )}
                      <div className="mt1-m01-card-body">
                        <div className="mt1-m01-card-name">{w.name}</div>
                        <div className="mt1-m01-card-desc">{w.description}</div>
                        <span aria-hidden className="mt1-m01-card-arrow">→</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "catalogue" && (
            <div className="mt1-m01-face" key="face-catalogue">
              <div
                className="mt1-m01-compare-grid"
                role="radiogroup"
                aria-label="Explore and choose a wood"
              >
                {woods.map((w) => {
                  const isSelected = w.slug === selectedSlug;
                  return (
                    <button
                      key={w.slug}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Open ${w.name} detail`}
                      onClick={() => openDetail(w.slug, "catalogue")}
                      className={`mt1-m01-compare-card ${isSelected ? "is-selected" : ""}`}
                    >
                      <div
                        className="mt1-m01-compare-swatch"
                        style={{
                          background: w.imageUrl
                            ? `url(${w.imageUrl}) center/cover no-repeat`
                            : `linear-gradient(140deg, ${w.tone} 0%, ${w.tone} 55%, rgba(0,0,0,0.15) 100%)`,
                        }}
                        aria-hidden
                      />
                      <div className="mt1-m01-compare-body">
                        <div className="mt1-m01-compare-name">{w.name}</div>
                        <div className="mt1-m01-compare-desc">
                          {w.description}
                        </div>
                        <span
                          className={`mt1-m01-compare-status ${isSelected ? "is-selected" : ""}`}
                          aria-hidden
                        >
                          {isSelected ? "✓ Selected" : "Open"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "detail" && selectedWood && (
            <div className="mt1-m01-face" key={`face-detail-${selectedWood.slug}`}>
              <WoodDetailFull wood={selectedWood} />
            </div>
          )}
        </div>

        {/* Bottom chapter-break CTAs · shown only in featured mode so
            catalogue and detail faces read as focused single-purpose
            surfaces. */}
        {viewMode === "featured" && (
          <div className="mt1-m01-bottom">
            {/* Banner card · Request material samples · full-bleed image
                container with text overlay bottom-left + brown accent
                button bottom-right (Philip 2026-08-17). */}
            <a
              href={sampleCtaHref}
              className="mt1-m01-cta-banner mt1-m01-cta-banner--samples"
              aria-label="Request material samples"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mt1-m01-cta-banner-img"
                src="https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2008_00_54%20PM.png"
                alt=""
                aria-hidden
                loading="lazy"
              />
              <div className="mt1-m01-cta-banner-scrim" aria-hidden />
              <div className="mt1-m01-cta-banner-body">
                <div className="mt1-m01-cta-banner-copy">
                  <h4 className="mt1-m01-cta-banner-title">
                    Feel the wood in your hand
                  </h4>
                  <p className="mt1-m01-cta-banner-text">
                    Request a curated set of samples delivered to your door.
                  </p>
                </div>
                <span className="mt1-m01-cta-banner-btn" aria-hidden>
                  Request samples <span>→</span>
                </span>
              </div>
            </a>

            {/* Banner card · Not sure which timber? · full-bleed banner
                image + button lower-right. */}
            <a
              href={consultationCtaHref}
              className="mt1-m01-cta-banner mt1-m01-cta-banner--consult"
              aria-label="Book a design conversation"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mt1-m01-cta-banner-img"
                src="https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2017,%202026,%2008_11_39%20PM.png"
                alt=""
                aria-hidden
                loading="lazy"
              />
              <div className="mt1-m01-cta-banner-scrim" aria-hidden />
              <div className="mt1-m01-cta-banner-body">
                <div className="mt1-m01-cta-banner-copy">
                  <h4 className="mt1-m01-cta-banner-title">
                    Not sure which timber?
                  </h4>
                  <p className="mt1-m01-cta-banner-text">
                    Talk it through with a staircase specialist.
                  </p>
                </div>
                <span className="mt1-m01-cta-banner-btn" aria-hidden>
                  Book conversation <span>→</span>
                </span>
              </div>
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        /* ── Section shell · mobile-first ──────────────────────────── */
        .mt1-m01 {
          background: ${T.color.surface};
          padding: ${T.spacing.sectionPaddingBlock} 16px;
          font-family: ${T.font.sans};
          scroll-margin-top: 80px;
        }
        .mt1-m01-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ── Centred section header · matches ST-C01 pattern ─────── */
        .mt1-m01-section-head {
          text-align: center;
          margin: 0 0 clamp(28px, 4.5vw, 44px);
        }
        .mt1-m01-section-eyebrow {
          font-size: 11px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: ${T.color.accent};
          font-weight: 600;
        }
        .mt1-m01-section-headline {
          margin: 12px 0 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: ${T.color.ink};
          font-size: clamp(30px, 4.4vw, 52px);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }

        /* ── Section head (title + view-all link) ────────────────── */
        .mt1-m01-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin: 0 0 20px;
        }
        .mt1-m01-head-parts {
          margin-top: 44px;
        }
        .mt1-m01-title {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3.8vw, 28px);
          font-weight: 400;
          color: ${T.color.ink};
          margin: 0;
        }
        .mt1-m01-viewall {
          font-size: 13px;
          color: ${T.color.accent};
          text-decoration: none;
          white-space: nowrap;
          font-weight: 500;
        }
        /* Button-styled variant · used when the link needs to trigger
           an activation handler instead of a scroll anchor. Resets
           the browser button chrome so it reads identically to the
           anchor version. */
        .mt1-m01-viewall-btn {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          padding: 0;
          font-family: inherit;
          cursor: pointer;
        }
        .mt1-m01-viewall-btn:focus-visible {
          outline: 2px solid ${T.color.accent};
          outline-offset: 4px;
          border-radius: 4px;
        }
        .mt1-m01-viewall:hover {
          color: ${T.color.accentDeep};
        }

        /* ── Woods grid · standalone full-width block ────────────────
           Previous 2-col wrap (grid + beauty aside side-by-side) removed
           on 2026-08-17 · placed the detail below the taller wrap column
           instead of directly under the grid. Now: grid → detail →
           beauty as three siblings in strict vertical order. */
        .mt1-m01-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        @media (min-width: 640px) {
          .mt1-m01-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
        }

        /* ── Wood card · <button> reset + interactive states ─────── */
        .mt1-m01-card {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 0;
          padding: 6px;
          margin: -6px;
          text-align: left;
          font: inherit;
          color: inherit;
          cursor: pointer;
          border-radius: 14px;
          position: relative;
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 220ms ease, background 220ms ease;
        }
        .mt1-m01-card:hover,
        .mt1-m01-card:focus-visible {
          transform: translateY(-2px);
          background: rgba(181, 143, 94, 0.06);
          outline: none;
        }
        .mt1-m01-card:focus-visible {
          box-shadow: 0 0 0 2px ${T.color.accent};
        }
        .mt1-m01-card.is-selected {
          background: rgba(181, 143, 94, 0.08);
          box-shadow: 0 0 0 2px ${T.color.accent};
        }
        .mt1-m01-selected-dot {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px -2px rgba(181, 143, 94, 0.55);
          z-index: 2;
        }
        .mt1-m01-swatch {
          aspect-ratio: 1;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .mt1-m01-card-body {
          padding: 10px 2px 0;
          position: relative;
        }
        .mt1-m01-card-name {
          font-size: 14px;
          font-weight: 600;
          color: ${T.color.ink};
          line-height: 1.2;
        }
        .mt1-m01-card-desc {
          font-size: 12px;
          color: ${T.color.inkMuted};
          line-height: 1.4;
          margin-top: 4px;
          padding-right: 22px;
        }
        .mt1-m01-card-arrow {
          position: absolute;
          right: 2px;
          bottom: 2px;
          color: ${T.color.accent};
          font-size: 14px;
          line-height: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-card,
          .mt1-m01-card:hover,
          .mt1-m01-card:focus-visible {
            transition: none;
            transform: none;
          }
        }

        /* ── Section-head nav variant · back button + centred title +
           spacer so title stays optically centred. */
        .mt1-m01-section-head--nav {
          display: grid;
          grid-template-columns: minmax(60px, 1fr) auto minmax(60px, 1fr);
          align-items: center;
          gap: 12px;
          text-align: center;
        }
        .mt1-m01-section-head--nav .mt1-m01-section-headline {
          margin: 0;
          text-align: center;
        }
        /* Section-head Back button · brown accent (Philip 2026-08-17)
           to match the brand accent used on primary CTAs and the
           in-image Back button in WoodDetailFull. */
        .mt1-m01-back {
          justify-self: start;
          appearance: none;
          -webkit-appearance: none;
          background: ${T.color.accent};
          border: 0;
          border-radius: ${T.radius.button};
          padding: 9px 16px;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #fff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: background 140ms, transform 140ms,
            box-shadow 140ms;
          box-shadow: 0 6px 16px -8px rgba(181, 143, 94, 0.5);
        }
        .mt1-m01-back:hover,
        .mt1-m01-back:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateY(-1px);
          outline: none;
        }
        .mt1-m01-back-spacer {
          display: block;
        }

        /* ── Flip stage · exactly one face rendered at a time. Each
           face enters via mt1-m01-flip-in for the flip feel (subtle
           3D perspective rotate + fade in). React keys per face force
           remount + re-run the keyframe. */
        .mt1-m01-stage {
          perspective: 1400px;
          margin-top: clamp(4px, 1vw, 12px);
        }
        .mt1-m01-face {
          animation: mt1-m01-flip-in 380ms cubic-bezier(0.22, 1, 0.36, 1)
            both;
          transform-origin: center top;
          will-change: transform, opacity;
        }
        @keyframes mt1-m01-flip-in {
          from {
            opacity: 0;
            transform: perspective(1400px) rotateY(-10deg) translateX(20px);
          }
          to {
            opacity: 1;
            transform: perspective(1400px) rotateY(0) translateX(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-face { animation: none; }
        }

        /* WoodDetailFull CSS moved into its own <style jsx> block
           inside the WoodDetailFull function · styled-jsx scopes rules
           to the component that OWNS the style tag, not to sub-
           components rendered in the same file. Bug fix 2026-08-17. */

        /* ── Compare Woods anchor grid (id="materials-all-woods") ── */
        .mt1-m01-compare {
          scroll-margin-top: 80px;
          margin-top: clamp(48px, 6vw, 72px);
        }
        .mt1-m01-compare-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 640px) {
          .mt1-m01-compare-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
          }
        }
        @media (min-width: 1024px) {
          .mt1-m01-compare-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .mt1-m01-compare-card {
          appearance: none;
          -webkit-appearance: none;
          background: ${T.color.surfaceCard};
          border: 1px solid ${T.color.hairline};
          border-radius: 14px;
          padding: 12px;
          text-align: left;
          font: inherit;
          color: inherit;
          cursor: pointer;
          display: grid;
          grid-template-columns: 88px 1fr;
          gap: 14px;
          align-items: center;
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 220ms ease, border-color 220ms ease;
        }
        @media (min-width: 1024px) {
          .mt1-m01-compare-card {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .mt1-m01-compare-swatch {
            aspect-ratio: 1;
          }
        }
        .mt1-m01-compare-swatch {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .mt1-m01-compare-card:hover,
        .mt1-m01-compare-card:focus-visible {
          transform: translateY(-2px);
          border-color: ${T.color.accent};
          outline: none;
        }
        .mt1-m01-compare-card.is-selected {
          border-color: ${T.color.accent};
          box-shadow: 0 0 0 1px ${T.color.accent};
        }
        .mt1-m01-compare-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .mt1-m01-compare-name {
          font-family: ${T.font.serif};
          font-size: 17px;
          color: ${T.color.ink};
          font-weight: 500;
        }
        .mt1-m01-compare-desc {
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
        }
        .mt1-m01-compare-status {
          margin-top: 8px;
          font-size: 12px;
          font-weight: 600;
          color: ${T.color.accent};
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-compare-card,
          .mt1-m01-compare-card:hover,
          .mt1-m01-compare-card:focus-visible {
            transition: none;
            transform: none;
          }
        }

        /* Beauty of Natural Wood extracted to its own standalone chapter
           between ST-C01 and ST-M01 · see BeautyOfNaturalWood.tsx. */

        /* ── Bottom chapter-break banner CTAs ─────────────────────
           Two full-bleed banner cards side-by-side on desktop. Each
           uses a supplied image as the container background · text
           overlay bottom-left · brown accent button bottom-right ·
           whole card is clickable (the <a> wraps everything). Scrim
           gradient ensures text legibility over any image.
           Philip 2026-08-17 · replaced the old text-cards + decorative
           corner-image pattern. */
        .mt1-m01-bottom {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          margin-top: 40px;
        }
        @media (min-width: 720px) {
          .mt1-m01-bottom {
            grid-template-columns: 1fr 1fr;
          }
        }
        .mt1-m01-cta-banner {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
          min-height: 260px;
          border-radius: 16px;
          overflow: hidden;
          text-decoration: none;
          color: #fff;
          box-shadow: 0 12px 30px -18px rgba(15, 12, 8, 0.32);
          transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 200ms ease;
          isolation: isolate;
        }
        @media (min-width: 720px) {
          .mt1-m01-cta-banner {
            aspect-ratio: 3 / 2;
            min-height: 300px;
          }
        }
        .mt1-m01-cta-banner:hover,
        .mt1-m01-cta-banner:focus-visible {
          transform: translateY(-3px);
          box-shadow: 0 22px 44px -20px rgba(15, 12, 8, 0.45);
          outline: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-cta-banner,
          .mt1-m01-cta-banner:hover {
            transition: none;
            transform: none;
          }
        }
        .mt1-m01-cta-banner-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          z-index: 1;
          transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .mt1-m01-cta-banner:hover .mt1-m01-cta-banner-img,
        .mt1-m01-cta-banner:focus-visible .mt1-m01-cta-banner-img {
          transform: scale(1.03);
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-cta-banner-img,
          .mt1-m01-cta-banner:hover .mt1-m01-cta-banner-img {
            transition: none;
            transform: none;
          }
        }
        .mt1-m01-cta-banner-scrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(15, 12, 8, 0.78) 0%,
            rgba(15, 12, 8, 0.5) 30%,
            rgba(15, 12, 8, 0.15) 65%,
            rgba(15, 12, 8, 0) 100%
          );
          z-index: 2;
          pointer-events: none;
        }
        .mt1-m01-cta-banner-body {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 3;
          padding: clamp(18px, 2.6vw, 28px);
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
        }
        .mt1-m01-cta-banner-copy {
          flex: 1;
          min-width: 0;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55),
            0 1px 3px rgba(0, 0, 0, 0.4);
        }
        .mt1-m01-cta-banner-title {
          margin: 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: #fff;
          font-size: clamp(18px, 2.4vw, 24px);
          line-height: 1.15;
          letter-spacing: -0.005em;
        }
        .mt1-m01-cta-banner-text {
          margin: 6px 0 0;
          font-size: 12.5px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.88);
          max-width: 34ch;
        }
        .mt1-m01-cta-banner-btn {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: ${T.color.accent};
          color: #fff;
          border-radius: 999px;
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: 0.02em;
          box-shadow: 0 8px 20px -8px rgba(0, 0, 0, 0.5);
          transition: background 140ms, transform 140ms;
        }
        .mt1-m01-cta-banner:hover .mt1-m01-cta-banner-btn,
        .mt1-m01-cta-banner:focus-visible .mt1-m01-cta-banner-btn {
          background: ${T.color.accentDeep};
        }
      `}</style>
    </section>
  );
}

/** Full-face wood detail · takes over the whole ST-M01 stage when the
 *  section is in `viewMode === "detail"`. Full-bleed image (the
 *  staircase rendered in this wood) with a bottom-anchored text
 *  overlay sitting on the image's plain lower area (Philip 2026-08-17).
 *
 *  Uses `staircaseImageUrl` when available (Phase 4 asset — same
 *  geometry across every wood so customers compare timber not layout),
 *  falls back to the close-up `imageUrl` grain swatch until those
 *  renders exist. A dark gradient scrim at the image bottom guarantees
 *  overlay legibility regardless of what's in the image's lower area.
 *
 *  Only qualitative attributes render — nothing fabricated. */
function WoodDetailFull({ wood }: { wood: WoodCard }) {
  const heroSrc = wood.staircaseImageUrl ?? wood.imageUrl;

  // Request More Details · single action button on the overlay ·
  // opens the owner-chat overlay pre-filled with the wood's image
  // as an attachment + starter message "Hi, I would like to know
  // more about this staircase in {Wood} please." Editable, mock
  // send with a confirmation state.
  const [requestOpen, setRequestOpen] = useState(false);
  const openRequest = useCallback(() => setRequestOpen(true), []);
  const closeRequest = useCallback(() => setRequestOpen(false), []);
  const suitabilityShort =
    wood.suitability === "both"
      ? "Domestic + commercial"
      : wood.suitability === "domestic"
        ? "Domestic"
        : wood.suitability === "commercial"
          ? "Commercial"
          : null;
  const typeLabel =
    wood.type === "hardwood"
      ? "Hardwood"
      : wood.type === "softwood"
        ? "Softwood"
        : null;
  const availabilityLabel =
    wood.availability === "standard-stock"
      ? "Standard stock"
      : wood.availability === "limited"
        ? "Limited / bespoke"
        : null;

  return (
    <article
      className="mt1-m01-detailfull"
      role="region"
      aria-labelledby="mt1-m01-detailfull-name"
    >
      {heroSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="mt1-m01-detailfull-hero"
          src={heroSrc}
          alt=""
          aria-hidden
          loading="lazy"
        />
      ) : (
        <div
          className="mt1-m01-detailfull-hero mt1-m01-detailfull-hero--fallback"
          style={{
            background: `linear-gradient(140deg, ${wood.tone} 0%, ${wood.tone} 55%, rgba(0,0,0,0.15) 100%)`,
          }}
          aria-hidden
        />
      )}

      {/* Corner + bottom scrims · subtle darken behind the text so the
          overlay stays legible over the staircase image itself. Zero
          box, zero glass container · just enough gradient shadow to
          preserve WCAG contrast. */}
      <div className="mt1-m01-detailfull-scrim-tr" aria-hidden />
      <div className="mt1-m01-detailfull-scrim-bt" aria-hidden />

      {/* Top-right overlay · identifies the timber. Sits over the
          staircase image itself · minimal chrome, just text with a
          soft text-shadow safety net. */}
      <div className="mt1-m01-detailfull-topright">
        <div className="mt1-m01-detailfull-tr-eyebrow">
          {[typeLabel, availabilityLabel, wood.origin]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <h3
          id="mt1-m01-detailfull-name"
          className="mt1-m01-detailfull-tr-name"
        >
          {wood.name}
        </h3>
      </div>

      {/* Bottom overlay · character quote + facts + actions. Sits on
          the image's plain lower area · text-only, no container. */}
      <div className="mt1-m01-detailfull-bottom">
        {wood.character && (
          <p className="mt1-m01-detailfull-character">{wood.character}</p>
        )}

        <ul className="mt1-m01-detailfull-facts">
          {wood.hardnessGrade && (
            <li>
              <span className="mt1-m01-detailfull-fact-key">Hardness</span>
              <span className="mt1-m01-detailfull-fact-val">
                {wood.hardnessGrade}
              </span>
            </li>
          )}
          {suitabilityShort && (
            <li>
              <span className="mt1-m01-detailfull-fact-key">Suited for</span>
              <span className="mt1-m01-detailfull-fact-val">
                {suitabilityShort}
              </span>
            </li>
          )}
          {wood.scratchResistance && (
            <li>
              <span className="mt1-m01-detailfull-fact-key">Wear</span>
              <span className="mt1-m01-detailfull-fact-val">
                {wood.scratchResistance}
              </span>
            </li>
          )}
          {wood.pairings && (
            <li>
              <span className="mt1-m01-detailfull-fact-key">Pairings</span>
              <span className="mt1-m01-detailfull-fact-val">
                {wood.pairings}
              </span>
            </li>
          )}
        </ul>

        <div className="mt1-m01-detailfull-actions">
          <button
            type="button"
            onClick={openRequest}
            className="mt1-m01-detailfull-request"
            aria-haspopup="dialog"
            aria-expanded={requestOpen}
          >
            Request more details <span aria-hidden>→</span>
          </button>
        </div>
      </div>

      {/* Owner-chat overlay · portalled to document.body so it escapes
          the <Reveal> containing block (transform + will-change) that
          would otherwise trap fixed-position elements inside a section
          box (same bug pattern as the ProductLightbox portal). */}
      {requestOpen && heroSrc && (
        <OwnerChatOverlay
          wood={wood}
          imageSrc={heroSrc}
          onClose={closeRequest}
        />
      )}

      {/* CSS lives INSIDE WoodDetailFull because styled-jsx scopes to
          the component that owns the <style jsx> tag · rules in the
          parent STM01's block do NOT apply to elements this component
          renders. Bug fix 2026-08-17 (Philip diagnosis: layout was
          all-unstyled default HTML because the parent's rules never
          reached these class selectors). */}
      <style jsx>{`
        .mt1-m01-detailfull {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 5;
          min-height: 520px;
          border-radius: 24px;
          overflow: hidden;
          background: ${T.color.surfaceSoft};
          box-shadow: 0 24px 60px -30px rgba(15, 12, 8, 0.4);
          isolation: isolate;
        }
        @media (min-width: 720px) {
          .mt1-m01-detailfull {
            aspect-ratio: 3 / 4;
            min-height: 620px;
          }
        }
        @media (min-width: 1024px) {
          .mt1-m01-detailfull {
            aspect-ratio: 16 / 9;
            min-height: 640px;
          }
        }
        .mt1-m01-detailfull-hero {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center bottom;
          z-index: 1;
          display: block;
        }
        .mt1-m01-detailfull-hero--fallback {
          object-position: center;
        }
        .mt1-m01-detailfull-scrim-tr {
          position: absolute;
          top: 0;
          right: 0;
          width: 70%;
          height: 42%;
          background: radial-gradient(
            ellipse at top right,
            rgba(0, 0, 0, 0.55) 0%,
            rgba(0, 0, 0, 0.3) 40%,
            rgba(0, 0, 0, 0) 72%
          );
          z-index: 2;
          pointer-events: none;
        }
        .mt1-m01-detailfull-scrim-bt {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 55%;
          background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.78) 0%,
            rgba(0, 0, 0, 0.55) 30%,
            rgba(0, 0, 0, 0.18) 70%,
            rgba(0, 0, 0, 0) 100%
          );
          z-index: 2;
          pointer-events: none;
        }
        .mt1-m01-detailfull-topright {
          position: absolute;
          top: clamp(16px, 2.4vw, 32px);
          right: clamp(16px, 2.4vw, 32px);
          z-index: 3;
          max-width: min(70%, 420px);
          text-align: right;
          color: #fff;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55),
            0 1px 3px rgba(0, 0, 0, 0.45);
          pointer-events: none;
        }
        .mt1-m01-detailfull-tr-eyebrow {
          font-size: clamp(10px, 1vw, 11.5px);
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }
        .mt1-m01-detailfull-tr-name {
          margin: 8px 0 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: #fff;
          font-size: clamp(30px, 4.4vw, 56px);
          line-height: 1;
          letter-spacing: -0.01em;
        }
        /* Bottom overlay · sits at the image's plain lower area · was
           previously reserving ~84px for the Ask NEX FAB (removed
           2026-08-17) · now sits directly at the image footer. On
           mobile the offset is even tighter so the overlay hugs the
           image bottom, giving the staircase itself more visible
           height above (Philip 2026-08-17). */
        .mt1-m01-detailfull-bottom {
          position: absolute;
          left: clamp(20px, 3vw, 44px);
          right: clamp(20px, 3vw, 44px);
          bottom: clamp(16px, 2vw, 32px);
          z-index: 3;
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: clamp(8px, 1.2vw, 16px);
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55),
            0 1px 3px rgba(0, 0, 0, 0.4);
        }
        @media (max-width: 720px) {
          .mt1-m01-detailfull-bottom {
            left: 16px;
            right: 16px;
            bottom: 14px;
            gap: 8px;
          }
        }
        @media (min-width: 1024px) {
          .mt1-m01-detailfull-bottom {
            max-width: 820px;
          }
        }
        .mt1-m01-detailfull-character {
          margin: 0;
          max-width: 60ch;
          font-family: ${T.font.serif};
          font-style: italic;
          font-size: clamp(13px, 1.5vw, 17px);
          line-height: 1.45;
          color: rgba(255, 255, 255, 0.94);
        }
        .mt1-m01-detailfull-facts {
          list-style: none;
          margin: 4px 0 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 22px;
        }
        .mt1-m01-detailfull-facts li {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.92);
          line-height: 1.4;
        }
        .mt1-m01-detailfull-fact-key {
          display: inline-flex;
          align-items: center;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10.5px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.65);
        }
        .mt1-m01-detailfull-fact-key::after {
          content: "·";
          margin-left: 8px;
          color: rgba(255, 255, 255, 0.4);
        }
        .mt1-m01-detailfull-fact-val {
          color: #fff;
          font-weight: 500;
        }
        .mt1-m01-detailfull-actions {
          margin-top: 8px;
          display: flex;
        }
        /* Single "Request more details" primary action · brown accent
           pill, prominent · replaces the old Order sample + Deselect +
           Back + Ask NEX cluster. Opens the owner-chat overlay. */
        .mt1-m01-detailfull-request {
          appearance: none;
          -webkit-appearance: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 14px 26px;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          border-radius: 999px;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          box-shadow: 0 14px 32px -12px rgba(0, 0, 0, 0.55),
            0 2px 6px rgba(0, 0, 0, 0.2);
          transition: background 160ms, transform 160ms,
            box-shadow 160ms;
        }
        .mt1-m01-detailfull-request:hover,
        .mt1-m01-detailfull-request:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateY(-2px);
          box-shadow: 0 18px 40px -14px rgba(0, 0, 0, 0.6),
            0 3px 8px rgba(0, 0, 0, 0.24);
          outline: none;
        }
      `}</style>
    </article>
  );
}

/** Owner-chat overlay · portalled to document.body so it escapes any
 *  parent transform / will-change containing block (Reveal wrapper).
 *
 *  Opens with a pre-filled first message bubble containing the wood
 *  staircase image + starter text ("Hi, I would like to know more
 *  about this staircase in {wood} please."). The customer can edit
 *  the text or send as-is · Send transitions to a sent-confirmation
 *  state (mock lead capture · real messaging backend arrives later).
 *
 *  CSS lives in this component's own <style jsx> block per styled-jsx
 *  scoping doctrine. */
function OwnerChatOverlay({
  wood,
  imageSrc,
  onClose,
}: {
  wood: WoodCard;
  imageSrc: string;
  onClose: () => void;
}) {
  const initialText = `Hi, I would like to know more about this staircase in ${wood.name} please.`;
  const [text, setText] = useState(initialText);
  const [sent, setSent] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;
      // Mock send · in production this hooks into a real messaging
      // backend or a Formspree-style lead endpoint. For the template
      // preview we flip to a confirmation state.
      setSent(true);
    },
    [text],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="mt1-m01-owner-chat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mt1-m01-owner-chat-title"
      onClick={onClose}
    >
      <div
        className="mt1-m01-owner-chat-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mt1-m01-owner-chat-head">
          <div className="mt1-m01-owner-chat-title-wrap">
            <div className="mt1-m01-owner-chat-eyebrow">Message the team</div>
            <h3
              id="mt1-m01-owner-chat-title"
              className="mt1-m01-owner-chat-title"
            >
              About your {wood.name} staircase
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt1-m01-owner-chat-close"
            aria-label="Close message panel"
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="mt1-m01-owner-chat-thread">
          <article className="mt1-m01-owner-chat-bubble">
            <div className="mt1-m01-owner-chat-bubble-attachment">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={`${wood.name} staircase render`}
                loading="lazy"
              />
              <span className="mt1-m01-owner-chat-bubble-caption">
                {wood.name} staircase
              </span>
            </div>
            {!sent ? (
              <form
                className="mt1-m01-owner-chat-form"
                onSubmit={handleSubmit}
              >
                <label
                  className="mt1-m01-owner-chat-label"
                  htmlFor="mt1-m01-owner-chat-text"
                >
                  Your message
                </label>
                <textarea
                  id="mt1-m01-owner-chat-text"
                  className="mt1-m01-owner-chat-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={3}
                  autoFocus
                />
                <div className="mt1-m01-owner-chat-actions">
                  <button
                    type="submit"
                    className="mt1-m01-owner-chat-send"
                    disabled={!text.trim()}
                  >
                    Send message <span aria-hidden>→</span>
                  </button>
                  <p className="mt1-m01-owner-chat-hint">
                    The team typically replies within 24 hours.
                  </p>
                </div>
              </form>
            ) : (
              <div className="mt1-m01-owner-chat-sent">
                <div className="mt1-m01-owner-chat-sent-tick" aria-hidden>
                  ✓
                </div>
                <div>
                  <h4 className="mt1-m01-owner-chat-sent-title">
                    Message sent
                  </h4>
                  <p className="mt1-m01-owner-chat-sent-body">
                    Thanks — the team will be in touch about your {wood.name}{" "}
                    staircase shortly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt1-m01-owner-chat-sent-close"
                >
                  Close
                </button>
              </div>
            )}
          </article>
        </div>
      </div>

      <style jsx>{`
        .mt1-m01-owner-chat {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(15, 12, 8, 0.72);
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(16px, 3vw, 40px);
          animation: mt1-m01-owner-chat-fade 220ms ease-out;
        }
        @keyframes mt1-m01-owner-chat-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-owner-chat {
            animation: none;
          }
        }
        .mt1-m01-owner-chat-panel {
          width: 100%;
          max-width: 640px;
          max-height: calc(100vh - clamp(32px, 6vw, 80px));
          background: ${T.color.surface};
          border-radius: 20px;
          box-shadow: 0 40px 100px -30px rgba(0, 0, 0, 0.55);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: mt1-m01-owner-chat-lift 260ms
            cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes mt1-m01-owner-chat-lift {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-m01-owner-chat-panel {
            animation: none;
          }
        }
        .mt1-m01-owner-chat-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: clamp(20px, 3vw, 28px) clamp(20px, 3vw, 28px) 14px;
          border-bottom: 1px solid ${T.color.hairline};
        }
        .mt1-m01-owner-chat-title-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .mt1-m01-owner-chat-eyebrow {
          font-size: 10.5px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          font-weight: 600;
          color: ${T.color.accent};
        }
        .mt1-m01-owner-chat-title {
          margin: 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: ${T.color.ink};
          font-size: clamp(18px, 2.2vw, 22px);
          line-height: 1.15;
        }
        .mt1-m01-owner-chat-close {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${T.color.accent};
          border: 0;
          border-radius: 50%;
          color: #fff;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 6px 16px -8px rgba(181, 143, 94, 0.5);
          transition: background 140ms, transform 140ms;
        }
        .mt1-m01-owner-chat-close:hover,
        .mt1-m01-owner-chat-close:focus-visible {
          background: ${T.color.accentDeep};
          transform: scale(1.06);
          outline: none;
        }
        .mt1-m01-owner-chat-thread {
          padding: clamp(20px, 3vw, 28px);
          overflow-y: auto;
          background: ${T.color.surfaceSoft};
        }
        .mt1-m01-owner-chat-bubble {
          background: ${T.color.surfaceCard};
          border: 1px solid ${T.color.hairline};
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 6px 20px -12px rgba(15, 12, 8, 0.2);
        }
        .mt1-m01-owner-chat-bubble-attachment {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          background: ${T.color.surfaceSoft};
        }
        .mt1-m01-owner-chat-bubble-attachment img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .mt1-m01-owner-chat-bubble-caption {
          position: absolute;
          left: 12px;
          bottom: 10px;
          padding: 4px 10px;
          background: rgba(15, 12, 8, 0.72);
          -webkit-backdrop-filter: blur(6px);
          backdrop-filter: blur(6px);
          border-radius: 999px;
          color: #fff;
          font-size: 11px;
          letter-spacing: 0.06em;
          font-weight: 600;
        }
        .mt1-m01-owner-chat-form {
          padding: 16px 18px 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mt1-m01-owner-chat-label {
          font-size: 10.5px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 600;
          color: ${T.color.inkFaint};
        }
        .mt1-m01-owner-chat-text {
          resize: vertical;
          min-height: 84px;
          appearance: none;
          -webkit-appearance: none;
          background: ${T.color.surface};
          border: 1px solid ${T.color.hairline};
          border-radius: 10px;
          padding: 12px 14px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          color: ${T.color.ink};
          transition: border-color 140ms, background 140ms;
        }
        .mt1-m01-owner-chat-text:focus-visible {
          border-color: ${T.color.accent};
          outline: none;
        }
        .mt1-m01-owner-chat-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .mt1-m01-owner-chat-send {
          appearance: none;
          -webkit-appearance: none;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          border-radius: 999px;
          padding: 12px 22px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 20px -10px rgba(181, 143, 94, 0.6);
          transition: background 140ms, transform 140ms;
        }
        .mt1-m01-owner-chat-send:hover:not(:disabled),
        .mt1-m01-owner-chat-send:focus-visible:not(:disabled) {
          background: ${T.color.accentDeep};
          transform: translateY(-1px);
          outline: none;
        }
        .mt1-m01-owner-chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .mt1-m01-owner-chat-hint {
          margin: 0;
          font-size: 11.5px;
          color: ${T.color.inkFaint};
          line-height: 1.4;
        }
        .mt1-m01-owner-chat-sent {
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 14px;
        }
        .mt1-m01-owner-chat-sent-tick {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${T.color.accent};
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          box-shadow: 0 10px 24px -10px rgba(181, 143, 94, 0.6);
        }
        .mt1-m01-owner-chat-sent-title {
          margin: 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          font-size: 20px;
          color: ${T.color.ink};
        }
        .mt1-m01-owner-chat-sent-body {
          margin: 4px 0 0;
          font-size: 13px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
          max-width: 36ch;
        }
        .mt1-m01-owner-chat-sent-close {
          margin-top: 6px;
          appearance: none;
          -webkit-appearance: none;
          background: ${T.color.accent};
          color: #fff;
          border: 0;
          border-radius: 999px;
          padding: 10px 20px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 140ms;
        }
        .mt1-m01-owner-chat-sent-close:hover,
        .mt1-m01-owner-chat-sent-close:focus-visible {
          background: ${T.color.accentDeep};
          outline: none;
        }
      `}</style>
    </div>,
    document.body,
  );
}
