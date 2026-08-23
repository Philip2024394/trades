// NEX Design Catalogue · Master Template 1 · Staircase Parts &
// Accessories (ST-P01). Philip 2026-08-17.
//
// TWO-JOURNEY DOCTRINE (see memory):
//   Customer A · wants a staircase   → ST-M01 (wood + design journey)
//   Customer B · needs a specific part → ST-P01 (this section)
//
// This section is the commercial gateway for Customer B. The curated
// primary grid sells the categories at a glance · "View All Parts →"
// activates the expanded catalogue (Phase 1 is display-only; commerce
// — search / filter / dimensions / material / finish / price / buy /
// order / enquire — lands later with real product data · NEVER
// fabricated).
//
// A small bridge back to the main staircase journey sits at the bottom
// ("Looking for a complete staircase? Explore Staircase Designs →") so
// a Customer-B visitor who realises they actually want the whole thing
// can find their way to the design flow without being pushed there.
//
// Layout (mobile-first · same shell language as ST-M01):
//   • Centred section header · eyebrow + serif headline + supporting line
//   • Curated primary grid · 4-6 featured parts · 2 cols mobile, 4 cols
//     ≥640 px, 4-6 cols ≥1024 px
//   • "View All Parts →" activator button (SectionActivation-gated ·
//     appears immediately below the head so both entry points work the
//     same way ST-M01 does)
//   • Gated full catalogue (hidden until activated) · complete list ·
//     Phase 1 = enriched display · commerce comes later
//   • Bridge back to staircase design journey
//
// State: DISPLAY-ONLY. Per the LOCKED role separation, parts do NOT
// write to StaircaseDesign state · the customer's part interest is
// a purchase intent, not a component of their in-progress staircase
// design. Wiring a "select part" state here would blur the two
// journeys and is explicitly forbidden by the doctrine.
//
// Scroll targets: id="parts" (whole section) · id="parts-all" (Explore
// All Parts anchor for the gated catalogue · target of deep-link
// `#parts-all`).

"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MT1_TOKENS as T } from "../tokens";
import { useSectionActivation } from "../SectionActivation";

/** Structured spec row on a product card. Every value here is MOCK /
 *  example data for the Phase 1 catalogue preview. Real product data
 *  replaces these later without changing the UI. Never surface
 *  fabricated commercial facts (price, stock, lead time, SKU, supplier
 *  claim) — those fields are absent by design until authoritative
 *  data lands. */
type PartSpec = {
  label: string;
  value: string;
};

/** A single purchasable product inside a part category. Phase 1 has
 *  ONE representative mock product per category; the same shape scales
 *  to N real products once a real catalogue data feed is connected —
 *  no architectural change needed on that day.
 *
 *  Commercial fields (price, stock, sku, leadTime, availability) are
 *  DELIBERATELY absent from the type until authoritative data exists.
 *  See the "no fabricated commerce" doctrine (memory). The UI reserves
 *  slots for those fields so their arrival is a data change, not a
 *  UI redesign.  */
type PartProduct = {
  id: string;
  name: string;
  /** Product close-up image. Clicking the image opens the lightbox. */
  imageUrl?: string;
  /** Short marketing blurb shown under the product name on the card. */
  blurb?: string;
  /** Structured spec table · MOCK / example values in Phase 1. */
  specs?: PartSpec[];
  /** Commercial price · UI slot ALWAYS renders. When unset, falls
   *  back to "Price on enquiry" — the standard UK trade language
   *  that does not fabricate a number. Owner adds real pricing here
   *  when the catalogue data lands · UI activates automatically. */
  price?: {
    /** "from £X" pricing (e.g. cut-to-length variable) */
    from?: number;
    /** exact "£X" pricing */
    exact?: number;
    /** ISO currency code · GBP default */
    currency?: "GBP" | "USD" | "EUR";
    /** unit modifier · "per m", "each", "per pair" etc. */
    unit?: string;
  };
};

type PartCard = {
  slug: string;
  /** Category name shown on the compact card and as the header of the
   *  product-catalogue row (e.g. "Newel Posts"). */
  name: string;
  /** One-line category description on the compact card. */
  description: string;
  /** Close-up category photo · falls back to a themed gradient. */
  imageUrl?: string;
  /** Fallback tone for placeholder gradient. */
  tone: string;
  /** Featured in the curated primary grid. Un-flagged parts appear
   *  only in the gated "Explore All Parts" catalogue. */
  featured?: boolean;
  /** One or many purchasable products inside this category. Phase 1:
   *  exactly one representative mock product per category. Future:
   *  many real products. Empty array is valid — a category can ship
   *  without a representative product; the catalogue then shows only
   *  the category header + "Product catalogue coming soon" state. */
  products: PartProduct[];
};

// Real parts photography · originally sourced 2026-08-17. Featured
// set (Newel Posts · Handrails · Balusters · Treads) chosen as the
// four highest-frequency component queries; the rest live in the
// expanded catalogue.
//
// Each category carries ONE representative Phase-1 mock product for
// the detail experience. Spec values (Timber · Profile · Dimensions ·
// Finish) are EXAMPLE data that will be replaced when the real
// catalogue lands. Deliberately NO price · NO stock · NO lead time ·
// NO SKU — those must not be fabricated. The detail panel shows a
// clear "Preview only" line so no visitor is misled.
const DEFAULT_PARTS: PartCard[] = [
  {
    slug: "newel-posts",
    name: "Newel Posts",
    description: "Various styles and sizes",
    tone: "#C8A97D",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsd.png",
    featured: true,
    products: [
      {
        id: "oak-square-newel",
        name: "Oak Square Newel Post",
        imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsd.png",
        blurb:
          "Premium solid oak newel post with a clean square profile. Used at the base and top of the stair flight as the primary structural post carrying the handrail and balustrade.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Profile", value: "Square" },
          { label: "Section", value: "90 × 90 mm" },
          { label: "Length", value: "1500 mm" },
          { label: "Finish", value: "Unfinished · ready for stain or paint" },
        ],
      },
    ],
  },
  {
    slug: "handrails",
    name: "Handrails",
    description: "Wood, metal & custom profiles",
    tone: "#B08856",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsds.png",
    featured: true,
    products: [
      {
        id: "oak-profile-handrail",
        name: "Oak Profile Handrail",
        imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsds.png",
        blurb:
          "Solid oak handrail with a comfortable rounded top profile and grooved underside for baluster fit. Cut to length on request.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Profile", value: "Rounded top with plough groove" },
          { label: "Section", value: "62 × 68 mm" },
          { label: "Standard length", value: "2400 mm · custom cuts available" },
          { label: "Finish", value: "Unfinished" },
        ],
      },
    ],
  },
  {
    slug: "balusters",
    name: "Balusters",
    description: "Wood, metal & glass options",
    tone: "#9E7548",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscv.png",
    featured: true,
    products: [
      {
        id: "oak-square-baluster",
        name: "Oak Square Baluster",
        imageUrl:
          "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscv.png",
        blurb:
          "Solid oak baluster with a clean square profile. Fits standard handrail grooves and baserail assemblies.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Profile", value: "Square" },
          { label: "Section", value: "32 × 32 mm" },
          { label: "Length", value: "900 mm" },
          { label: "Finish", value: "Unfinished" },
        ],
      },
    ],
  },
  {
    slug: "treads",
    name: "Treads",
    description: "Solid wood tread options",
    tone: "#CFA97E",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscvsadasd.png",
    featured: true,
    products: [
      {
        id: "oak-stair-tread",
        name: "Oak Stair Tread",
        imageUrl:
          "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscvsadasd.png",
        blurb:
          "Solid oak stair tread with a rounded front-edge nosing. Suits both new build and refurbishment / cladding projects.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Thickness", value: "38 mm" },
          { label: "Depth", value: "270 mm" },
          { label: "Standard length", value: "1000 mm · cut-to-size available" },
          { label: "Front edge", value: "Rounded bullnose" },
        ],
      },
    ],
  },
  {
    slug: "risers",
    name: "Risers",
    description: "Matching wood riser boards",
    tone: "#BE9463",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscvsadasdsdasd.png",
    products: [
      {
        id: "oak-stair-riser",
        name: "Oak Stair Riser",
        imageUrl:
          "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscvsadasdsdasd.png",
        blurb:
          "Solid oak riser board matched to the standard oak tread range. Supplied to length; also available in painted grades on request.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Thickness", value: "18 mm" },
          { label: "Height", value: "195 mm" },
          { label: "Standard length", value: "1000 mm · cut-to-size available" },
          { label: "Finish", value: "Unfinished" },
        ],
      },
    ],
  },
  {
    slug: "stringers",
    name: "Stringers",
    description: "Closed, open & custom cut",
    tone: "#A88254",
    imageUrl:
      "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscvsadasdsdasdzxc.png",
    products: [
      {
        id: "timber-stair-stringer",
        name: "Timber Stair Stringer",
        imageUrl:
          "https://ik.imagekit.io/5vv5pw26q/Untitledasdasdassdsdsdscvsadasdsdasdzxc.png",
        blurb:
          "Structural stair stringer routed to accept the tread and riser assembly. Available closed or cut string configurations to match your flight design.",
        specs: [
          { label: "Timber", value: "European Oak" },
          {
            label: "Configuration",
            value: "Closed string · cut string available",
          },
          { label: "Thickness", value: "32 mm" },
          { label: "Depth", value: "275 mm" },
          { label: "Length", value: "Cut to your rise / run" },
        ],
      },
    ],
  },
  {
    slug: "tg-sheeting",
    name: "T&G Sheeting",
    description: "Tongue-and-groove wall sheeting",
    tone: "#C8A97D",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdassdsd.png",
    products: [
      {
        id: "timber-tg-sheeting",
        name: "Timber T&G Stair Sheeting",
        imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdassdsd.png",
        blurb:
          "Tongue-and-groove timber sheeting used to line stairwell walls and understair panels. Micro-V joint delivers a clean shadow line between boards.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Board width", value: "94 mm face · 100 mm nominal" },
          { label: "Thickness", value: "15 mm" },
          { label: "Standard length", value: "2400 mm" },
          { label: "Joint", value: "Micro V tongue and groove" },
        ],
      },
    ],
  },
  {
    slug: "paneling",
    name: "Paneling",
    description: "Wall panels & wainscoting",
    tone: "#B08856",
    imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdassdsdsdfsdf.png",
    products: [
      {
        id: "timber-staircase-paneling",
        name: "Timber Staircase Paneling",
        imageUrl: "https://ik.imagekit.io/5vv5pw26q/Untitledasdassdsdsdfsdf.png",
        blurb:
          "Framed timber paneling / wainscoting for stairwell walls. Supplied as a modular kit with stiles, rails and infill boards to trim in.",
        specs: [
          { label: "Timber", value: "European Oak" },
          { label: "Panel format", value: "Framed with stile / rail / infill" },
          {
            label: "Panel height",
            value: "1200 mm dado · custom heights on request",
          },
          { label: "Thickness", value: "18 mm" },
          { label: "Finish", value: "Unfinished · ready for stain or paint" },
        ],
      },
    ],
  },
];

export type STP01Config = {
  sectionEyebrow?: string;
  sectionHeadline?: string;
  sectionSupport?: string;
  parts?: PartCard[];
  bridgeQuestion?: string;
  bridgeCtaLabel?: string;
  bridgeCtaHref?: string;
};

export function STP01(props: STP01Config = {}) {
  const sectionEyebrow = props.sectionEyebrow ?? "STAIRCASE PARTS & ACCESSORIES";
  const sectionHeadline =
    props.sectionHeadline ?? "Find the component you need.";
  const sectionSupport =
    props.sectionSupport ??
    "Building, replacing or upgrading a staircase? Start with the piece you're looking for.";
  const parts = props.parts ?? DEFAULT_PARTS;
  const bridgeQuestion =
    props.bridgeQuestion ?? "Looking for a complete staircase?";
  const bridgeCtaLabel = props.bridgeCtaLabel ?? "Explore Staircase Designs";
  const bridgeCtaHref = props.bridgeCtaHref ?? "#materials";

  const featuredParts = parts.some((p) => p.featured)
    ? parts.filter((p) => p.featured)
    : parts;

  const { isActive, activate } = useSectionActivation();
  const catalogueActive = isActive("parts-all");
  const openCatalogue = () => activate("parts-all");

  // Detail-panel selection · LOCAL UI state, not StaircaseDesign.
  // Per the role doctrine, parts are Customer B purchase intent, NOT
  // a component of the customer's in-progress staircase design · so
  // "which part am I currently looking at" is browsing state, not
  // design state. Toggle model: click a selected card again to close.
  //
  // Origin tracking (Philip 2026-08-17): selection carries WHICH grid
  // the click came from so the inline detail panel opens ONLY under
  // that grid. Without this the same panel renders twice (once in the
  // featured grid, once in the catalogue) whenever a featured part is
  // clicked with the catalogue open · a "crash style" layout bug.
  type Selection = { slug: string; origin: "featured" | "catalogue" };
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedSlug = selection?.slug ?? null;
  const selectedPart = selectedSlug
    ? parts.find((p) => p.slug === selectedSlug) ?? null
    : null;
  const handleSelectFrom = useCallback(
    (slug: string, origin: Selection["origin"]) => {
      setSelection((prev) =>
        prev?.slug === slug && prev.origin === origin
          ? null
          : { slug, origin },
      );
    },
    [],
  );
  const handleClose = useCallback(() => setSelection(null), []);

  // Product image lightbox · opens when a customer clicks a product
  // card's image. Independent of the category selection so opening/
  // closing the lightbox never disturbs the browsing context.
  const [lightboxProduct, setLightboxProduct] = useState<PartProduct | null>(
    null,
  );
  const openLightbox = useCallback((p: PartProduct) => {
    if (!p.imageUrl) return;
    setLightboxProduct(p);
  }, []);
  const closeLightbox = useCallback(() => setLightboxProduct(null), []);

  // Track column count of the featured grid + catalogue grid so the
  // inline detail panel inserts at the end of the row containing the
  // clicked card. Matches the CSS breakpoints below.
  //   Featured grid: 2 cols mobile · 4 cols ≥640 px
  //   Catalogue grid: 1 col mobile · 2 cols ≥640 · 4 cols ≥1024 px
  const [featuredCols, setFeaturedCols] = useState<2 | 4>(2);
  const [catalogueCols, setCatalogueCols] = useState<1 | 2 | 4>(1);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mqFeatured = window.matchMedia("(min-width: 640px)");
    const mqCatalogueMid = window.matchMedia("(min-width: 640px)");
    const mqCatalogueWide = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setFeaturedCols(mqFeatured.matches ? 4 : 2);
      setCatalogueCols(
        mqCatalogueWide.matches ? 4 : mqCatalogueMid.matches ? 2 : 1,
      );
    };
    update();
    mqFeatured.addEventListener("change", update);
    mqCatalogueWide.addEventListener("change", update);
    return () => {
      mqFeatured.removeEventListener("change", update);
      mqCatalogueWide.removeEventListener("change", update);
    };
  }, []);

  // Insertion index = end of the row containing the selected card,
  // clamped to the last item in the list. Detail opens ONLY in the
  // grid the click originated from · so featuredInsertAfter is -1 when
  // the click came from the catalogue (and vice-versa).
  const featuredSelectedIndex =
    selection?.origin === "featured" && selectedSlug
      ? featuredParts.findIndex((p) => p.slug === selectedSlug)
      : -1;
  const featuredInsertAfter =
    featuredSelectedIndex >= 0
      ? Math.min(
          Math.ceil((featuredSelectedIndex + 1) / featuredCols) *
            featuredCols -
            1,
          featuredParts.length - 1,
        )
      : -1;
  const catalogueSelectedIndex =
    selection?.origin === "catalogue" && selectedSlug && catalogueActive
      ? parts.findIndex((p) => p.slug === selectedSlug)
      : -1;
  const catalogueInsertAfter =
    catalogueSelectedIndex >= 0
      ? Math.min(
          Math.ceil((catalogueSelectedIndex + 1) / catalogueCols) *
            catalogueCols -
            1,
          parts.length - 1,
        )
      : -1;

  return (
    <section
      id="parts"
      className="mt1-p01"
      data-section-id="ST-P01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      aria-labelledby="mt1-p01-headline"
    >
      <div className="mt1-p01-inner">
        <div className="mt1-p01-head">
          <div className="mt1-p01-eyebrow">{sectionEyebrow}</div>
          <h2 id="mt1-p01-headline" className="mt1-p01-headline">
            {sectionHeadline}
          </h2>
          <p className="mt1-p01-support">{sectionSupport}</p>
        </div>

        <div className="mt1-p01-viewall-row">
          <button
            type="button"
            className="mt1-p01-viewall-btn"
            onClick={openCatalogue}
            aria-expanded={catalogueActive}
            aria-controls="parts-all"
          >
            View All Parts <span aria-hidden>→</span>
          </button>
        </div>

        {/* Featured grid · row-split when a card in this grid is selected
            so the detail renders as a full-width sibling BETWEEN the
            two grid halves (never as an in-grid child). Preserves
            "beneath the row containing the selected product" doctrine
            without letting the detail inherit grid layout constraints. */}
        {(() => {
          const renderFeaturedCard = (p: PartCard) => {
            const isSelected =
              p.slug === selectedSlug && selection?.origin === "featured";
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => handleSelectFrom(p.slug, "featured")}
                aria-expanded={isSelected}
                aria-label={`View ${p.name}`}
                className={`mt1-p01-card ${isSelected ? "is-selected" : ""}`}
              >
                <div
                  className="mt1-p01-swatch"
                  style={{
                    background: p.imageUrl
                      ? `url(${p.imageUrl}) center/cover no-repeat`
                      : `linear-gradient(150deg, ${p.tone} 0%, ${p.tone} 55%, rgba(0,0,0,0.18) 100%)`,
                  }}
                  aria-hidden
                />
                {isSelected && (
                  <span className="mt1-p01-selected-dot" aria-hidden>
                    ✓
                  </span>
                )}
                <div className="mt1-p01-name">{p.name}</div>
                <div className="mt1-p01-desc">{p.description}</div>
              </button>
            );
          };
          const split = featuredInsertAfter;
          const showSplit = split >= 0 && selectedPart;
          if (!showSplit) {
            return (
              <div className="mt1-p01-grid" aria-label="Featured parts">
                {featuredParts.map(renderFeaturedCard)}
              </div>
            );
          }
          const before = featuredParts.slice(0, split + 1);
          const after = featuredParts.slice(split + 1);
          return (
            <>
              <div className="mt1-p01-grid" aria-label="Featured parts">
                {before.map(renderFeaturedCard)}
              </div>
              <CategoryProducts
                category={selectedPart}
                onClose={handleClose}
                onOpenLightbox={openLightbox}
              />
              {after.length > 0 && (
                <div
                  className="mt1-p01-grid mt1-p01-grid--after"
                  aria-label="More featured parts"
                >
                  {after.map(renderFeaturedCard)}
                </div>
              )}
            </>
          );
        })()}

        {/* Gated full catalogue · same activation pattern as ST-M01's
            "Explore All Woods". Progressive disclosure so the normal
            landing-page flow shows only the curated primary set · the
            complete list appears only when the customer explicitly asks
            for it via "View All Parts →" or the `#parts-all` deep-link. */}
        {catalogueActive && (
          <div
            id="parts-all"
            className="mt1-p01-catalogue"
            aria-labelledby="mt1-p01-catalogue-title"
          >
            <div className="mt1-p01-catalogue-head">
              <h3
                id="mt1-p01-catalogue-title"
                className="mt1-p01-catalogue-title"
              >
                Explore All Parts
              </h3>
              <a href="#parts" className="mt1-p01-viewall">
                Back to top <span aria-hidden>↑</span>
              </a>
            </div>
            {(() => {
              const renderCatalogueCard = (p: PartCard) => {
                const isSelected =
                  p.slug === selectedSlug &&
                  selection?.origin === "catalogue";
                return (
                  <button
                    key={p.slug}
                    type="button"
                    onClick={() => handleSelectFrom(p.slug, "catalogue")}
                    aria-expanded={isSelected}
                    aria-label={`View ${p.name}`}
                    className={`mt1-p01-catalogue-card ${isSelected ? "is-selected" : ""}`}
                  >
                    <div
                      className="mt1-p01-catalogue-swatch"
                      style={{
                        background: p.imageUrl
                          ? `url(${p.imageUrl}) center/cover no-repeat`
                          : `linear-gradient(150deg, ${p.tone} 0%, ${p.tone} 55%, rgba(0,0,0,0.18) 100%)`,
                      }}
                      aria-hidden
                    />
                    {isSelected && (
                      <span
                        className="mt1-p01-selected-dot mt1-p01-selected-dot--catalogue"
                        aria-hidden
                      >
                        ✓
                      </span>
                    )}
                    <div className="mt1-p01-catalogue-body">
                      <div className="mt1-p01-catalogue-name">{p.name}</div>
                      <div className="mt1-p01-catalogue-desc">
                        {p.description}
                      </div>
                    </div>
                  </button>
                );
              };
              const split = catalogueInsertAfter;
              const showSplit = split >= 0 && selectedPart;
              if (!showSplit) {
                return (
                  <div
                    className="mt1-p01-catalogue-grid"
                    aria-label="All parts catalogue"
                  >
                    {parts.map(renderCatalogueCard)}
                  </div>
                );
              }
              const before = parts.slice(0, split + 1);
              const after = parts.slice(split + 1);
              return (
                <>
                  <div
                    className="mt1-p01-catalogue-grid"
                    aria-label="All parts catalogue"
                  >
                    {before.map(renderCatalogueCard)}
                  </div>
                  <CategoryProducts
                    category={selectedPart}
                    onClose={handleClose}
                    onOpenLightbox={openLightbox}
                  />
                  {after.length > 0 && (
                    <div
                      className="mt1-p01-catalogue-grid mt1-p01-catalogue-grid--after"
                      aria-label="More catalogue parts"
                    >
                      {after.map(renderCatalogueCard)}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Bridge back to the main staircase journey. Small, single-line,
            never a demand — Customer B who realises they want the whole
            staircase can find their way in without being pushed. */}
        <div className="mt1-p01-bridge">
          <span className="mt1-p01-bridge-q">{bridgeQuestion}</span>
          <a href={bridgeCtaHref} className="mt1-p01-bridge-cta">
            {bridgeCtaLabel} <span aria-hidden>→</span>
          </a>
        </div>
      </div>

      <ProductLightbox product={lightboxProduct} onClose={closeLightbox} />

      <style jsx>{`
        /* Section shell · mobile-first · matches ST-M01 spacing rhythm */
        .mt1-p01 {
          background: ${T.color.surface};
          padding: ${T.spacing.sectionPaddingBlock} 16px;
          font-family: ${T.font.sans};
          scroll-margin-top: 80px;
          color: ${T.color.ink};
        }
        .mt1-p01-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* Centred header · same treatment as ST-M01 · adds a support
           line under the headline (single sentence, honest framing) */
        .mt1-p01-head {
          text-align: center;
          margin: 0 0 clamp(20px, 3vw, 32px);
        }
        .mt1-p01-eyebrow {
          font-size: 11px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: ${T.color.accent};
          font-weight: 600;
        }
        .mt1-p01-headline {
          margin: 12px 0 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: ${T.color.ink};
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.1;
          letter-spacing: -0.01em;
        }
        .mt1-p01-support {
          margin: 12px auto 0;
          max-width: 560px;
          font-size: 14px;
          color: ${T.color.inkMuted};
          line-height: 1.6;
        }

        /* View-all activator row · sits right below the head so the
           gateway to the full catalogue is visible before scrolling
           through the curated grid */
        .mt1-p01-viewall-row {
          display: flex;
          justify-content: center;
          margin-bottom: clamp(20px, 3vw, 28px);
        }
        .mt1-p01-viewall-btn {
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          border: 1px solid ${T.color.hairline};
          padding: 8px 16px;
          border-radius: 999px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
          color: ${T.color.accent};
          cursor: pointer;
          transition: background 140ms, border-color 140ms;
        }
        .mt1-p01-viewall-btn:hover,
        .mt1-p01-viewall-btn:focus-visible {
          background: ${T.color.seal};
          border-color: ${T.color.accent};
          outline: none;
        }
        .mt1-p01-viewall {
          font-size: 13px;
          color: ${T.color.accent};
          text-decoration: none;
          white-space: nowrap;
          font-weight: 500;
        }
        .mt1-p01-viewall:hover {
          color: ${T.color.accentDeep};
        }

        /* Curated primary grid · 2 cols mobile, 4 cols ≥640 px, 4 cols
           ≥1024 px. Cards are DISPLAY-ONLY per the role doctrine · no
           select-part state · commerce arrives later. */
        .mt1-p01-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        @media (min-width: 640px) {
          .mt1-p01-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
          }
        }
        .mt1-p01-card {
          display: flex;
          flex-direction: column;
        }
        .mt1-p01-swatch {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        .mt1-p01-name {
          margin-top: 10px;
          font-family: ${T.font.serif};
          font-size: 16px;
          color: ${T.color.ink};
        }
        .mt1-p01-desc {
          margin-top: 2px;
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
        }

        /* Gated full catalogue · richer 2-col layout so the customer
           can scan more context per part. Card is still display-only ·
           commerce (price / buy / order / enquire) comes later. */
        .mt1-p01-catalogue {
          margin-top: clamp(40px, 5vw, 60px);
          scroll-margin-top: 80px;
        }
        .mt1-p01-catalogue-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 18px;
        }
        .mt1-p01-catalogue-title {
          font-family: ${T.font.serif};
          font-size: clamp(22px, 3.4vw, 30px);
          font-weight: 400;
          color: ${T.color.ink};
          margin: 0;
        }
        .mt1-p01-catalogue-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        @media (min-width: 640px) {
          .mt1-p01-catalogue-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
          }
        }
        @media (min-width: 1024px) {
          .mt1-p01-catalogue-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .mt1-p01-catalogue-card {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 14px;
          padding: 12px;
          background: ${T.color.surfaceCard};
          border: 1px solid ${T.color.hairline};
          border-radius: 12px;
          align-items: center;
        }
        @media (min-width: 1024px) {
          .mt1-p01-catalogue-card {
            grid-template-columns: 1fr;
            gap: 10px;
          }
        }
        .mt1-p01-catalogue-swatch {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        }
        .mt1-p01-catalogue-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .mt1-p01-catalogue-name {
          font-family: ${T.font.serif};
          font-size: 15px;
          color: ${T.color.ink};
        }
        .mt1-p01-catalogue-desc {
          font-size: 12px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
        }

        /* Bridge back to the main staircase journey · single sentence,
           low-weight, honest. Never a hard sell. */
        .mt1-p01-bridge {
          margin-top: clamp(40px, 5vw, 60px);
          padding: 18px 20px;
          background: ${T.color.surfaceSoft};
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;
        }
        @media (min-width: 640px) {
          .mt1-p01-bridge {
            flex-direction: row;
            justify-content: center;
            gap: 16px;
            text-align: left;
          }
        }
        .mt1-p01-bridge-q {
          font-size: 14px;
          color: ${T.color.inkMuted};
        }
        .mt1-p01-bridge-cta {
          font-size: 13px;
          font-weight: 600;
          color: ${T.color.accent};
          text-decoration: none;
        }
        .mt1-p01-bridge-cta:hover {
          color: ${T.color.accentDeep};
        }

        /* ── Interactive card resets · both grids (Phase 1 detail UX) ─
           Cards are now <button>s that open the inline PartDetail
           panel. Selected state uses a subtle accent ring + a small
           ✓ dot in the top-right so the visitor can see which card
           the detail below belongs to. */
        .mt1-p01-card,
        .mt1-p01-catalogue-card {
          appearance: none;
          -webkit-appearance: none;
          font: inherit;
          color: inherit;
          text-align: left;
          cursor: pointer;
          position: relative;
          transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 220ms ease, background 220ms ease;
        }
        .mt1-p01-card {
          background: transparent;
          border: 0;
          padding: 6px;
          margin: -6px;
          border-radius: 14px;
        }
        .mt1-p01-card:hover,
        .mt1-p01-card:focus-visible {
          transform: translateY(-2px);
          background: rgba(181, 143, 94, 0.06);
          outline: none;
        }
        .mt1-p01-card:focus-visible {
          box-shadow: 0 0 0 2px ${T.color.accent};
        }
        .mt1-p01-card.is-selected {
          background: rgba(181, 143, 94, 0.08);
          box-shadow: 0 0 0 2px ${T.color.accent};
        }
        .mt1-p01-catalogue-card:hover,
        .mt1-p01-catalogue-card:focus-visible {
          transform: translateY(-2px);
          border-color: ${T.color.accent};
          outline: none;
        }
        .mt1-p01-catalogue-card.is-selected {
          border-color: ${T.color.accent};
          box-shadow: 0 0 0 1px ${T.color.accent};
        }
        .mt1-p01-selected-dot {
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
        .mt1-p01-selected-dot--catalogue {
          top: 8px;
          right: 8px;
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-p01-card,
          .mt1-p01-card:hover,
          .mt1-p01-card:focus-visible,
          .mt1-p01-catalogue-card,
          .mt1-p01-catalogue-card:hover,
          .mt1-p01-catalogue-card:focus-visible {
            transition: none;
            transform: none;
          }
        }

        /* Row-split spacing · when a category is selected the grid
           splits into two halves and CategoryProducts renders between
           them. The continuation half needs matching top-spacing so
           the split reads as a controlled break, not a jarring gap. */
        .mt1-p01-grid--after,
        .mt1-p01-catalogue-grid--after {
          margin-top: 12px;
        }

        /* CategoryProducts + ProductLightbox CSS moved into their own
           <style jsx> blocks (inside those sub-component functions) per
           the styled-jsx scoping doctrine · parent's style tag does
           NOT reach sub-component DOM. Bug re-fix 2026-08-17 (second
           instance of the same class of bug). */
      `}</style>
    </section>
  );
}

/** Product-catalogue row · full-width sibling of the split card grid.
 *  Replaces the earlier long-form editorial PartDetail (Philip 2026-08-17)
 *  because Parts is a commercial catalogue experience — NOT an editorial
 *  wood-discovery experience. Renders:
 *    · Category header (crumbs + name + product count)
 *    · Product cards grid — Phase 1 has 1 mock product per category, the
 *      same architecture scales to N real products
 *    · Preview-only disclaimer (mock data status)
 *  Empty-products state shows a "coming soon · Ask NEX" prompt so a
 *  category with no products defined still reads as intentional. */
function CategoryProducts({
  category,
  onClose,
  onOpenLightbox,
}: {
  category: PartCard;
  onClose: () => void;
  onOpenLightbox: (product: PartProduct) => void;
}) {
  const products = category.products;
  const titleId = `mt1-p01-catrow-${category.slug}-title`;
  return (
    <section
      className="mt1-p01-catrow"
      role="region"
      aria-labelledby={titleId}
    >
      <header className="mt1-p01-catrow-head">
        <div className="mt1-p01-catrow-head-titles">
          <h3 id={titleId} className="mt1-p01-catrow-title">
            {category.name}
          </h3>
          <div className="mt1-p01-catrow-subtitle">
            Additional designs available on request
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt1-p01-catrow-dismiss"
          aria-label={`Close ${category.name} products`}
        >
          <span aria-hidden>×</span>
        </button>
      </header>

      {products.length === 0 ? (
        <div className="mt1-p01-catrow-empty">
          <p>Product catalogue for this category is coming soon.</p>
          <a href="#chat" className="mt1-p01-catrow-empty-ask">
            Ask NEX about {category.name.toLowerCase()} <span aria-hidden>→</span>
          </a>
        </div>
      ) : (
        <div className="mt1-p01-catrow-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenImage={() => onOpenLightbox(product)}
            />
          ))}
        </div>
      )}

      <p className="mt1-p01-catrow-preview">
        Preview only · specifications shown are example data.
      </p>

      {/* CSS lives INSIDE CategoryProducts because styled-jsx scopes to
          the component that owns the <style jsx> tag · parent STP01's
          rules never reach this sub-component's DOM. Bug re-fix
          2026-08-17. */}
      <style jsx>{`
        .mt1-p01-catrow {
          position: relative;
          margin-top: clamp(36px, 5vw, 56px);
          padding: 0;
          background: transparent;
          border: 0;
          box-shadow: none;
          animation: mt1-p01-catrow-in 320ms
            cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes mt1-p01-catrow-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-p01-catrow {
            animation: none;
          }
        }
        .mt1-p01-catrow-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin: 0 0 clamp(16px, 2vw, 24px);
        }
        .mt1-p01-catrow-head-titles {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .mt1-p01-catrow-title {
          margin: 0;
          font-family: ${T.font.serif};
          font-weight: 400;
          color: ${T.color.ink};
          font-size: clamp(24px, 3.4vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.01em;
        }
        .mt1-p01-catrow-subtitle {
          font-size: 12.5px;
          color: ${T.color.inkMuted};
          line-height: 1.5;
          letter-spacing: 0.01em;
        }
        .mt1-p01-catrow-dismiss {
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
          transition: background 140ms, transform 140ms,
            box-shadow 140ms;
        }
        .mt1-p01-catrow-dismiss:hover,
        .mt1-p01-catrow-dismiss:focus-visible {
          background: ${T.color.accentDeep};
          transform: scale(1.06);
          outline: none;
        }
        .mt1-p01-catrow-grid {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .mt1-p01-catrow-empty {
          padding: clamp(24px, 3vw, 40px);
          text-align: center;
          background: ${T.color.surfaceSoft};
          border-radius: 12px;
          font-size: 14px;
          color: ${T.color.inkMuted};
        }
        .mt1-p01-catrow-empty p {
          margin: 0 0 10px;
        }
        .mt1-p01-catrow-empty-ask {
          font-size: 13px;
          font-weight: 600;
          color: ${T.color.accent};
          text-decoration: none;
        }
        .mt1-p01-catrow-empty-ask:hover {
          color: ${T.color.accentDeep};
        }
        .mt1-p01-catrow-preview {
          margin: 14px 0 0;
          padding: 0;
          background: transparent;
          border-radius: 0;
          font-size: 11px;
          color: ${T.color.inkFaint};
          line-height: 1.4;
          letter-spacing: 0.02em;
          font-style: italic;
        }
      `}</style>
    </section>
  );
}

/** Individual product card inside CategoryProducts · landscape layout
 *  (image LEFT, details RIGHT · stacks on mobile).
 *
 *  Image is a <button> that opens the lightbox · click doesn't disturb
 *  the category selection so the customer returns to their browsing
 *  position after closing.
 *
 *  Price UI slot ALWAYS renders · falls back to "Price on enquiry"
 *  when `product.price` is unset · standard UK trade language that
 *  doesn't fabricate a number. Owner drops in real pricing later ·
 *  UI activates automatically.
 *
 *  CSS lives in ProductCard's OWN <style jsx> block per the styled-jsx
 *  scoping doctrine (2026-08-17) · rules in the parent STP01's block
 *  do NOT apply to sub-component DOM. */
function ProductCard({
  product,
  onOpenImage,
}: {
  product: PartProduct;
  onOpenImage: () => void;
}) {
  const priceText = formatPrice(product.price);

  return (
    <article className="mt1-p01-product">
      <button
        type="button"
        onClick={onOpenImage}
        className="mt1-p01-product-imgbtn"
        aria-label={`View larger image of ${product.name}`}
        disabled={!product.imageUrl}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="mt1-p01-product-img"
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
          />
        ) : (
          <div
            className="mt1-p01-product-img mt1-p01-product-img--placeholder"
            aria-hidden
          />
        )}
        {product.imageUrl && (
          <span className="mt1-p01-product-zoom" aria-hidden>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 3H5a2 2 0 00-2 2v4" />
              <path d="M15 3h4a2 2 0 012 2v4" />
              <path d="M9 21H5a2 2 0 01-2-2v-4" />
              <path d="M15 21h4a2 2 0 002-2v-4" />
            </svg>
          </span>
        )}
      </button>

      <div className="mt1-p01-product-body">
        <div className="mt1-p01-product-head">
          <h4 className="mt1-p01-product-name">{product.name}</h4>
          <div className="mt1-p01-product-price">
            <span className="mt1-p01-product-price-value">
              {priceText.value}
            </span>
            {priceText.unit && (
              <span className="mt1-p01-product-price-unit">
                {priceText.unit}
              </span>
            )}
          </div>
        </div>

        {product.blurb && (
          <p className="mt1-p01-product-blurb">{product.blurb}</p>
        )}

        {product.specs && product.specs.length > 0 && (
          <dl className="mt1-p01-product-specs">
            {product.specs.map((s) => (
              <div key={s.label} className="mt1-p01-product-spec">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt1-p01-product-actions">
          <a href="#chat" className="mt1-p01-product-cta">
            Enquire <span aria-hidden>→</span>
          </a>
          <a href="#chat" className="mt1-p01-product-ask">
            Ask NEX <span aria-hidden>→</span>
          </a>
        </div>
      </div>

      <style jsx>{`
        .mt1-p01-product {
          display: grid;
          grid-template-columns: 1fr;
          background: ${T.color.surface};
          border: 1px solid ${T.color.hairline};
          border-radius: 16px;
          overflow: hidden;
          transition: box-shadow 200ms, transform 200ms,
            border-color 200ms;
        }
        @media (min-width: 640px) {
          .mt1-p01-product {
            grid-template-columns: minmax(220px, 42%) 1fr;
            align-items: stretch;
          }
        }
        .mt1-p01-product:hover,
        .mt1-p01-product:focus-within {
          border-color: ${T.color.accent};
          box-shadow: 0 14px 32px -18px rgba(15, 12, 8, 0.35);
          transform: translateY(-2px);
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-p01-product,
          .mt1-p01-product:hover {
            transition: none;
            transform: none;
          }
        }
        .mt1-p01-product-imgbtn {
          appearance: none;
          -webkit-appearance: none;
          background: ${T.color.surfaceSoft};
          border: 0;
          padding: 0;
          margin: 0;
          font: inherit;
          color: inherit;
          cursor: zoom-in;
          position: relative;
          overflow: hidden;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
        }
        @media (min-width: 640px) {
          .mt1-p01-product-imgbtn {
            aspect-ratio: auto;
            height: 100%;
            min-height: 260px;
          }
        }
        .mt1-p01-product-imgbtn:disabled {
          cursor: default;
        }
        .mt1-p01-product-imgbtn:focus-visible {
          outline: 2px solid ${T.color.accent};
          outline-offset: -2px;
        }
        .mt1-p01-product-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .mt1-p01-product-imgbtn:hover .mt1-p01-product-img,
        .mt1-p01-product-imgbtn:focus-visible .mt1-p01-product-img {
          transform: scale(1.03);
        }
        .mt1-p01-product-img--placeholder {
          background: ${T.color.surfaceSoft};
        }
        .mt1-p01-product-zoom {
          position: absolute;
          bottom: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.92);
          border-radius: 50%;
          color: ${T.color.ink};
          box-shadow: 0 4px 10px -2px rgba(0, 0, 0, 0.25);
          pointer-events: none;
        }
        .mt1-p01-product-body {
          padding: clamp(18px, 2.2vw, 28px);
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }
        .mt1-p01-product-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .mt1-p01-product-name {
          margin: 0;
          font-family: ${T.font.serif};
          font-weight: 500;
          color: ${T.color.ink};
          font-size: clamp(18px, 1.8vw, 22px);
          line-height: 1.2;
          letter-spacing: -0.005em;
        }
        .mt1-p01-product-price {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
          text-align: right;
        }
        .mt1-p01-product-price-value {
          font-family: ${T.font.serif};
          font-weight: 500;
          font-size: clamp(15px, 1.6vw, 18px);
          color: ${T.color.accent};
          line-height: 1.1;
          white-space: nowrap;
        }
        .mt1-p01-product-price-unit {
          font-size: 11px;
          letter-spacing: 0.06em;
          color: ${T.color.inkFaint};
          font-weight: 500;
          white-space: nowrap;
        }
        .mt1-p01-product-blurb {
          margin: 0;
          font-size: 13.5px;
          color: ${T.color.inkMuted};
          line-height: 1.55;
        }
        .mt1-p01-product-specs {
          margin: 0;
          display: grid;
          gap: 6px;
        }
        .mt1-p01-product-spec {
          display: grid;
          grid-template-columns: minmax(110px, auto) 1fr;
          gap: 10px;
          padding: 8px 0;
          border-top: 1px solid ${T.color.hairline};
          font-size: 13px;
        }
        .mt1-p01-product-spec:first-child {
          border-top: 0;
          padding-top: 0;
        }
        .mt1-p01-product-spec dt {
          color: ${T.color.inkFaint};
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 11px;
          align-self: center;
        }
        .mt1-p01-product-spec dd {
          margin: 0;
          color: ${T.color.ink};
          line-height: 1.4;
        }
        .mt1-p01-product-actions {
          margin-top: auto;
          padding-top: 10px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }
        .mt1-p01-product-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 11px 18px;
          background: ${T.color.accent};
          color: #fff;
          border-radius: ${T.radius.button};
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: background 140ms, transform 140ms;
          box-shadow: 0 6px 18px -8px rgba(181, 143, 94, 0.6);
        }
        .mt1-p01-product-cta:hover,
        .mt1-p01-product-cta:focus-visible {
          background: ${T.color.accentDeep};
          transform: translateY(-1px);
          outline: none;
        }
        .mt1-p01-product-ask {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 500;
          color: ${T.color.accent};
          text-decoration: none;
          border-bottom: 1px solid transparent;
          padding-bottom: 2px;
          transition: color 140ms, border-color 140ms;
        }
        .mt1-p01-product-ask:hover,
        .mt1-p01-product-ask:focus-visible {
          color: ${T.color.accentDeep};
          border-color: ${T.color.accent};
          outline: none;
        }
      `}</style>
    </article>
  );
}

/** Format a `PartProduct.price` value into display text. Never
 *  fabricates a number when unset · returns the "Price on enquiry"
 *  UK trade fallback. Currency symbol resolved from ISO code. */
function formatPrice(price: PartProduct["price"]): {
  value: string;
  unit?: string;
} {
  if (!price || (price.from == null && price.exact == null)) {
    return { value: "Price on enquiry" };
  }
  const symbol = price.currency === "USD" ? "$" : price.currency === "EUR" ? "€" : "£";
  const amount = price.exact ?? price.from;
  const prefix = price.exact != null ? "" : "from ";
  const value = `${prefix}${symbol}${amount!.toLocaleString("en-GB")}`;
  return { value, unit: price.unit };
}

/** Full-screen product image viewer. Opens when the customer clicks a
 *  product card's image · closes on Escape, backdrop click, or the ✕
 *  button · body scroll locked while open · does not disturb the
 *  underlying category selection so the customer returns to exactly
 *  the same browsing position. Modal semantics: role="dialog" +
 *  aria-modal="true" + aria-labelledby the caption. */
function ProductLightbox({
  product,
  onClose,
}: {
  product: PartProduct | null;
  onClose: () => void;
}) {
  // Portal readiness · SSR-safe. document isn't available server-side,
  // so we defer portal creation until after mount. Without this the
  // component would crash during the SSR pass.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!product) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [product, onClose]);

  if (!product || !product.imageUrl) return null;
  if (!mounted) return null;

  // Portal to document.body · escapes every ancestor containing block.
  // Critical: STP01 lives inside <Reveal> which sets `transform` +
  // `will-change: transform` on its wrapper · both create a containing
  // block for descendants with `position: fixed`. Without portalling,
  // the lightbox is trapped inside Reveal's box · does NOT cover the
  // viewport · body-scroll lock still applies · screen appears frozen.
  // Bug fix Philip 2026-08-17.
  return createPortal(
    <div
      className="mt1-p01-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mt1-p01-lightbox-title"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="mt1-p01-lightbox-close"
        aria-label="Close image viewer"
      >
        <span aria-hidden>×</span>
      </button>
      <figure
        className="mt1-p01-lightbox-figure"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="mt1-p01-lightbox-img"
          src={product.imageUrl}
          alt={product.name}
        />
        <figcaption
          id="mt1-p01-lightbox-title"
          className="mt1-p01-lightbox-caption"
        >
          {product.name}
        </figcaption>
      </figure>

      {/* CSS in ProductLightbox's own scope per styled-jsx doctrine. */}
      <style jsx>{`
        .mt1-p01-lightbox {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(15, 12, 8, 0.86);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 4vw, 56px);
          animation: mt1-p01-lightbox-fade 180ms ease-out;
        }
        @keyframes mt1-p01-lightbox-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-p01-lightbox {
            animation: none;
          }
        }
        .mt1-p01-lightbox-close {
          position: absolute;
          top: clamp(16px, 3vw, 28px);
          right: clamp(16px, 3vw, 28px);
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 50%;
          color: #fff;
          font-size: 26px;
          line-height: 1;
          cursor: pointer;
          transition: background 140ms;
        }
        .mt1-p01-lightbox-close:hover,
        .mt1-p01-lightbox-close:focus-visible {
          background: rgba(255, 255, 255, 0.22);
          outline: none;
        }
        .mt1-p01-lightbox-figure {
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          max-width: min(100%, 1100px);
          max-height: 100%;
        }
        .mt1-p01-lightbox-img {
          display: block;
          max-width: 100%;
          max-height: calc(100vh - clamp(80px, 12vw, 160px));
          object-fit: contain;
          border-radius: 8px;
          box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.6);
        }
        .mt1-p01-lightbox-caption {
          font-family: ${T.font.serif};
          font-size: 15px;
          color: rgba(255, 255, 255, 0.88);
          text-align: center;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>,
    document.body,
  );
}
