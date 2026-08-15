// NEX Design Catalogue · ST-B01 · Photo Band + Coverage Check
// (Philip 2026-08-14 · v4).
//
// v4 changes:
//   - supporting-copy paragraph removed from the band
//   - "Check Locations" button under the headline
//   - clicking Check Locations morphs the section into a postcode
//     coverage-check UI: left form (postcode input + Search + result),
//     right stylised map (contour grid + green service radius ring +
//     HQ pin + searched-location pin)
//   - "Back" returns to the band view · Escape also closes
//   - postcode → distance calc is a deterministic hash stub for the
//     design catalogue (a real geo lookup plugs in via prop later)
//
// Nationwide variant (Philip flagged 2026-08-14):
//   When Philip supplies the image + copy for the "Nationwide Fitting
//   Available" variant we add a third view (NationwideView) selected
//   via a coverageMode prop. Keeping the current UI additive.
//
// UI standard (Philip 2026-08-14 · "world class UI"):
//   - eyebrow uppercase tracked · Playfair serif headline
//   - solid tan primary CTA · outline secondary
//   - premium spacing · clear hierarchy · smooth cross-fade between
//     views (opacity + transform · 220ms)
//   - result card lifts in from below · gentle shadow

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MT1_TOKENS as T } from "../tokens";

// Direct ImageKit URLs · aligns with NEX Storage Boundary Rule.
const PHOTO_BAND        = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2014,%202026,%2011_15_12%20PM.png";
const PHOTO_BAND_SUPPLY = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2015,%202026,%2012_16_30%20AM.png";

// Band background image per owner mode. Overridable via the imageUrl prop.
const BAND_IMAGE_BY_MODE: Record<OwnerMode, string> = {
  "fitting":              PHOTO_BAND,
  "fitting-plus-supply":  PHOTO_BAND,
  "supply-only":          PHOTO_BAND_SUPPLY
};

/**
 * Owner-side coverage mode (Philip 2026-08-15 · brainstorm option D):
 *   - "fitting"              · fits within a radius · no nationwide supply
 *   - "fitting-plus-supply"  · fits within a radius · supply-only outside
 *   - "supply-only"          · no fitting · delivers anywhere nationwide
 *
 * Postcode input is shown in ALL three modes; the RESULT changes meaning:
 *   - fitting                · in / out of fitting zone
 *   - fitting-plus-supply    · in / out of fitting zone → supply fallback
 *   - supply-only            · delivery estimate + surcharge band
 */
export type OwnerMode = "fitting" | "fitting-plus-supply" | "supply-only";

type Config = {
  eyebrow?: string;
  headlineTop?: string;
  headlineBottom?: string;
  ctaLabel?: string;
  imageUrl?: string;
  imageAlt?: string;
  hqLabel?: string;
  hqPostcode?: string;
  serviceRadiusMiles?: number;
  ownerMode?: OwnerMode;
};

// Per-mode band + form copy (kept in one table so owner switching a
// single prop cascades cleanly across the whole section).
const COPY_BY_MODE: Record<OwnerMode, {
  eyebrow: string;
  headlineTop: string;
  headlineBottom: string;
  formHeading: string;
  formHelper: string;
}> = {
  "fitting": {
    eyebrow: "FULLY FITTED",
    headlineTop: "Installation service",
    headlineBottom: "In our area",
    formHeading: "Enter your postcode",
    formHelper: "We'll check if we fit in your area."
  },
  "fitting-plus-supply": {
    eyebrow: "On Request",
    headlineTop: "Installation service",
    headlineBottom: "Across the UK",
    formHeading: "Enter your postcode",
    formHelper: "Search fitting service in your area · Nationwide supply available"
  },
  "supply-only": {
    eyebrow: "NATIONWIDE SUPPLY",
    headlineTop: "Nationwide delivery",
    headlineBottom: "Direct to your site",
    formHeading: "Check delivery to your area",
    formHelper: "We'll estimate transit time and any regional surcharge."
  }
};

const DEFAULTS: Required<Config> = {
  eyebrow:            COPY_BY_MODE["fitting-plus-supply"].eyebrow,
  headlineTop:        COPY_BY_MODE["fitting-plus-supply"].headlineTop,
  headlineBottom:     COPY_BY_MODE["fitting-plus-supply"].headlineBottom,
  ctaLabel:           "Service Area",
  imageUrl:           PHOTO_BAND,
  imageAlt:           "Staircase composition",
  hqLabel:            "Manchester HQ",
  hqPostcode:         "M1 4AZ",
  serviceRadiusMiles: 50,
  ownerMode:          "fitting-plus-supply"
};

export function STB01(props: Config = {}) {
  // Resolve owner mode first so copy defaults inherit from the mode
  // table rather than the fitting-plus-supply defaults.
  const mode: OwnerMode = props.ownerMode ?? "fitting-plus-supply";
  const modeCopy = COPY_BY_MODE[mode];
  const c: Required<Config> = {
    eyebrow:            props.eyebrow            ?? modeCopy.eyebrow,
    headlineTop:        props.headlineTop        ?? modeCopy.headlineTop,
    headlineBottom:     props.headlineBottom     ?? modeCopy.headlineBottom,
    ctaLabel:           props.ctaLabel           ?? "Service Area",
    imageUrl:           props.imageUrl           ?? BAND_IMAGE_BY_MODE[mode],
    imageAlt:           props.imageAlt           ?? "Staircase composition",
    hqLabel:            props.hqLabel            ?? "Manchester HQ",
    hqPostcode:         props.hqPostcode         ?? "M1 4AZ",
    serviceRadiusMiles: props.serviceRadiusMiles ?? 50,
    ownerMode:          mode
  };
  const [view, setView] = useState<"band" | "coverage">("band");

  const openCoverage = useCallback(() => setView("coverage"), []);
  const closeCoverage = useCallback(() => setView("band"), []);

  useEffect(() => {
    if (view !== "coverage") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCoverage(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view, closeCoverage]);

  return (
    <section
      data-section-id="ST-B01"
      data-master-template="1"
      data-vertical="staircase"
      data-family="premium-architectural"
      style={{
        background: T.color.surface,
        // Top padding tightened per Philip 2026-08-14 so the band sits
        // right under the collection cards. Bottom stays generous.
        paddingBlock: "clamp(4px, 1vw, 12px) clamp(28px, 4vw, 56px)",
        paddingInline: "clamp(20px, 4vw, 40px)"
      }}
    >
      <div
        style={{
          maxWidth: 1320,
          margin: "0 auto",
          borderRadius: T.radius.card,
          overflow: "hidden",
          position: "relative",
          minHeight: view === "coverage"
            ? "clamp(360px, 40vw, 520px)"
            : "clamp(220px, 24vw, 320px)",
          transition: "min-height 320ms cubic-bezier(0.16,1,0.3,1)",
          background: T.color.surfaceCard
        }}
      >
        {view === "band"
          ? <BandView c={c} onCta={openCoverage} />
          : <CoverageView c={c} onClose={closeCoverage} />}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BAND VIEW · photo + eyebrow + headline + Check Locations button
   ══════════════════════════════════════════════════════════════════ */

function BandView({ c, onCta }: { c: Required<Config>; onCta: () => void }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={c.imageUrl}
        alt={c.imageAlt}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "right center"
        }}
      />

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(58,52,40,0.6) 0%, rgba(58,52,40,0.4) 35%, rgba(58,52,40,0.12) 60%, rgba(58,52,40,0) 82%)"
        }}
      />

      {/* Text · left · centred vertically */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "clamp(24px, 4vw, 44px)",
          gap: 24
        }}
      >
        <div style={{ maxWidth: "min(520px, 55%)" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#F5EBDA",
              fontWeight: 600
            }}
          >
            {c.eyebrow}
          </div>
          <h3
            style={{
              margin: "12px 0 0",
              fontFamily: T.font.serif,
              fontWeight: 400,
              color: "#FFFFFF",
              fontSize: "clamp(28px, 3.4vw, 48px)",
              lineHeight: 1.02,
              letterSpacing: "-0.01em"
            }}
          >
            <span style={{ display: "block" }}>{c.headlineTop}</span>
            <span style={{ display: "block", fontStyle: "italic", color: "#F5EBDA", marginTop: 4 }}>
              {c.headlineBottom}
            </span>
          </h3>
        </div>

        {/* Button · right side · anchored to bottom-right · Philip 2026-08-14 */}
        <button
          type="button"
          onClick={onCta}
          aria-haspopup="dialog"
          style={{
            flexShrink: 0,
            alignSelf: "flex-end",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            background: T.color.accent,
            color: "#FFFFFF",
            border: "none",
            borderRadius: T.radius.button,
            fontWeight: 600,
            fontSize: 12.5,
            letterSpacing: "0.02em",
            cursor: "pointer",
            boxShadow: "0 8px 20px -10px rgba(0,0,0,0.5)"
          }}
        >
          {c.ctaLabel}
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COVERAGE VIEW · postcode form + stylised radius map
   ══════════════════════════════════════════════════════════════════ */

type CoverageResult = {
  postcode: string;
  distanceMiles: number;
  distanceKm: number;
  /** In the FITTING radius. For supply-only owners this is always
   *  false — fitting isn't offered, so this flag isn't relevant. */
  inCoverage: boolean;
  townHint: string;
  /** Delivery band · used by fitting-plus-supply (when out of zone)
   *  and by supply-only (always). Undefined for pure fitting-only. */
  deliveryBand?: "standard" | "extended" | "highlands";
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
  surchargeGBP?: number;
};

function CoverageView({ c, onClose }: { c: Required<Config>; onClose: () => void }) {
  const [postcode, setPostcode] = useState("");
  const [result, setResult] = useState<CoverageResult | null>(null);
  const modeCopy = COPY_BY_MODE[c.ownerMode];

  const search = useCallback((raw: string) => {
    const cleaned = raw.trim().toUpperCase();
    if (!isPlausibleUkPostcode(cleaned)) {
      setResult(null);
      return;
    }
    const r = stubDistanceFor(cleaned, c.serviceRadiusMiles, c.ownerMode);
    setResult(r);
  }, [c.serviceRadiusMiles, c.ownerMode]);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    search(postcode);
  }, [postcode, search]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fitting coverage check"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "clamp(360px, 40vw, 520px)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 380px) minmax(0, 1fr)",
        background: T.color.surfaceCard
      }}
      className="mt1-coverage-grid"
    >
      {/* ── LEFT · form + result ─────────────────────────────────── */}
      <div
        style={{
          padding: "clamp(24px, 3vw, 40px)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          borderInlineEnd: `1px solid ${T.color.hairline}`,
          background: T.color.surfaceCard,
          minWidth: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: T.color.accent, fontWeight: 700 }}>
              Coverage Check
            </div>
            <h3 style={{ margin: "8px 0 0", fontFamily: T.font.serif, fontWeight: 400, color: T.color.ink, fontSize: "clamp(22px, 2vw, 30px)", lineHeight: 1.1 }}>
              {modeCopy.formHeading}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            style={{
              width: 34, height: 34, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent",
              border: `1px solid ${T.color.hairline}`,
              borderRadius: 8, cursor: "pointer", color: T.color.ink
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12" /><path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label htmlFor="mt1-postcode" style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Postcode
          </label>
          <div style={{ position: "relative" }}>
            <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.color.inkFaint, pointerEvents: "none" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22c-4-4.5-7-8-7-12a7 7 0 1 1 14 0c0 4-3 7.5-7 12Z" />
                <circle cx="12" cy="10" r="2.6" />
              </svg>
            </span>
            <input
              id="mt1-postcode"
              type="text"
              inputMode="text"
              autoComplete="postal-code"
              placeholder="e.g. M1 4AZ"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              style={{
                width: "100%",
                padding: "14px 14px 14px 42px",
                fontSize: 15,
                fontFamily: T.font.sans,
                color: T.color.ink,
                background: T.color.surfaceSoft,
                border: `1px solid ${T.color.hairline}`,
                borderRadius: T.radius.button,
                letterSpacing: "0.05em",
                textTransform: "uppercase"
              }}
            />
          </div>
          <button
            type="submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "14px 22px",
              background: T.color.accent,
              color: "#FFFFFF",
              border: "none",
              borderRadius: T.radius.button,
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.02em",
              cursor: "pointer",
              boxShadow: "0 10px 24px -12px rgba(181, 143, 94, 0.6)"
            }}
          >
            Search
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <div style={{ fontSize: 11, color: T.color.inkFaint, marginTop: 2 }}>
            {modeCopy.formHelper}
          </div>
        </form>

        {/* Result card · appears after search · shape varies by owner mode */}
        {result && <ResultCard result={result} c={c} />}
      </div>

      {/* ── RIGHT · map · SWAPS to nationwide-supply view when the
           searched postcode is out of the fitting zone ─────────── */}
      <div
        style={{
          position: "relative",
          minWidth: 0,
          minHeight: 320,
          background: "#F1EBDD",
          overflow: "hidden"
        }}
      >
        {(() => {
          // Supply-only owners always show the nationwide map — there
          // is no fitting radius to render. Fitting-plus-supply swaps
          // to nationwide only when the searched postcode is out of
          // zone. Pure fitting-only stays on the map with an in/out
          // pin (no nationwide fallback).
          if (c.ownerMode === "supply-only") return <NationwideSupplyView />;
          if (c.ownerMode === "fitting-plus-supply" && result && !result.inCoverage) {
            return <NationwideSupplyView />;
          }
          return <MapCanvas c={c} result={result} />;
        })()}
      </div>

      {/* Responsive · stacks on mobile · form on top, map below */}
      <style>{`
        @media (max-width: 720px) {
          .mt1-coverage-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .mt1-coverage-grid > div:last-child {
            min-height: 260px !important;
          }
        }
      `}</style>
    </div>
  );
}

function ResultCard({ result, c }: { result: CoverageResult; c: Required<Config> }) {
  const RING = "#3F8F5C";                  // in-coverage green
  const OUT  = "#B54A3A";                  // out-of-coverage red
  const TRUCK = "#3F8F5C";                 // supply/delivery available green
  const mode = c.ownerMode;

  // ── Supply-only mode · always a delivery-band card, never in/out ──
  if (mode === "supply-only") {
    return (
      <div
        style={{
          marginTop: 4, padding: 16,
          background: "#F1F7F3", border: `1px solid #CBE3D3`,
          borderRadius: T.radius.button,
          display: "flex", alignItems: "flex-start", gap: 12
        }}
      >
        <div aria-hidden style={{ width: 34, height: 34, flexShrink: 0, borderRadius: "50%", background: TRUCK, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TruckGlyph />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.color.ink }}>
            {result.postcode} · {result.townHint}
          </div>
          <div style={{ fontSize: 12.5, color: T.color.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
            Delivery available · {result.deliveryDaysMin}-{result.deliveryDaysMax} working days
            {result.surchargeGBP && result.surchargeGBP > 0
              ? ` · £${result.surchargeGBP} carriage`
              : " · standard carriage"}
          </div>
        </div>
      </div>
    );
  }

  // ── Fitting modes · in/out card. fitting-plus-supply appends the
  //    supply fallback line when out of zone. Fitting-only tells the
  //    visitor honestly that we don't cover their area. ──────────────
  const fittingPlusSupply = mode === "fitting-plus-supply";
  const outMsgSuffix = fittingPlusSupply
    ? " Nationwide supply is still available."
    : " Get in touch about pricing for further sites.";

  const tone = result.inCoverage ? RING : OUT;
  return (
    <div
      style={{
        marginTop: 4,
        padding: 16,
        background: result.inCoverage ? "#F1F7F3" : "#FBEFEC",
        border: `1px solid ${result.inCoverage ? "#CBE3D3" : "#EFCBC2"}`,
        borderRadius: T.radius.button,
        display: "flex",
        alignItems: "flex-start",
        gap: 12
      }}
    >
      <div
        aria-hidden
        style={{
          width: 34, height: 34, flexShrink: 0,
          borderRadius: "50%",
          background: tone,
          color: "#FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}
      >
        {result.inCoverage ? (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.color.ink }}>
          {result.postcode} · {result.townHint}
        </div>
        <div style={{ fontSize: 12.5, color: T.color.inkMuted, marginTop: 4, lineHeight: 1.5 }}>
          {result.inCoverage
            ? `In coverage · ${result.distanceMiles} miles (${result.distanceKm} km) from ${c.hqLabel}`
            : `Out of coverage · ${result.distanceMiles} miles from ${c.hqLabel}.${outMsgSuffix}`
          }
        </div>
      </div>
    </div>
  );
}

function TruckGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7Z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════
   NATIONWIDE SUPPLY VIEW · rendered on the right when the searched
   postcode is OUTSIDE the fitting zone. Uses the illustrated UK map
   as the hero, dark scrim + text overlay explains the supply-only
   fallback.
   ══════════════════════════════════════════════════════════════════ */

const NATIONWIDE_IMG = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2015,%202026,%2012_03_12%20AM.png";

function NationwideSupplyView() {
  return (
    <div
      role="region"
      aria-label="Nationwide supply available"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden"
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={NATIONWIDE_IMG}
        alt="Illustrated UK map showing staircases delivered nationwide"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
      />

      {/* Bottom scrim so overlay text reads over the image */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(10,7,3,0) 30%, rgba(10,7,3,0.55) 70%, rgba(10,7,3,0.82) 100%)"
        }}
      />

      {/* Copy · bottom-left */}
      <div
        style={{
          position: "absolute",
          left: "clamp(20px, 3vw, 32px)",
          right: "clamp(20px, 3vw, 32px)",
          bottom: "clamp(20px, 3vw, 32px)",
          color: "#FFFFFF"
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#F5EBDA",
            fontWeight: 600
          }}
        >
          Nationwide Supply
        </div>
        <div
          style={{
            marginTop: 8,
            fontFamily: T.font.serif,
            fontWeight: 400,
            fontSize: "clamp(20px, 2.2vw, 30px)",
            lineHeight: 1.1,
            letterSpacing: "-0.01em"
          }}
        >
          Delivered anywhere in the UK
        </div>
        <p
          style={{
            margin: "10px 0 0",
            maxWidth: 480,
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.88)"
          }}
        >
          Our fitting service isn&apos;t available in your area right now — but every staircase can be built to order and shipped to you. Local installation on request.
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAP CANVAS · real map image + concentric ping + heartbeat pin
   ══════════════════════════════════════════════════════════════════ */

function MapCanvas({ c, result }: { c: Required<Config>; result: CoverageResult | null }) {
  const RING = "#3F8F5C";
  const RING_SOFT = "#E5F1E9";
  const MAP_IMG = "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2015,%202026,%2012_14_44%20AM.png";

  // Placement of the searched pin: place it at a bearing derived from
  // the postcode hash so the pin sits somewhere different for each
  // search, at a radius proportional to its distance vs the service
  // radius. Clamped so it always stays inside the visible canvas.
  const searchPin = useMemo(() => {
    if (!result) return null;
    const ratio = Math.min(1.15, result.distanceMiles / c.serviceRadiusMiles);
    // hash bearing 0..360 from postcode
    let h = 0;
    for (const ch of result.postcode) h = ((h * 33) + ch.charCodeAt(0)) >>> 0;
    const bearing = (h % 360) * Math.PI / 180;
    // 25% radius = at ring edge. Multiply by ratio for outside-radius pins.
    const rPct = 0.25 * ratio;
    return {
      x: 50 + Math.cos(bearing) * rPct * 100,
      y: 50 + Math.sin(bearing) * rPct * 100,
      inside: result.inCoverage
    };
  }, [result, c.serviceRadiusMiles]);

  return (
    <>
      {/* Real map background (Philip 2026-08-14) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MAP_IMG}
        alt=""
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover"
        }}
      />

      {/* HQ pin sits INSIDE the map background's own circle · centred.
          Hand-drawn radius ring removed per Philip 2026-08-15 so the
          map image's circle reads on its own. Ping + heartbeat kept. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: 0, height: 0
        }}
      >
        {/* PING · three staggered concentric rings from the pin centre */}
        <span aria-hidden className="mt1-ping mt1-ping--a" style={{ borderColor: RING }} />
        <span aria-hidden className="mt1-ping mt1-ping--b" style={{ borderColor: RING }} />
        <span aria-hidden className="mt1-ping mt1-ping--c" style={{ borderColor: RING }} />

        {/* HEARTBEAT · HQ pin */}
        <div
          className="mt1-hq-pin"
          style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)",
            width: 40, height: 40, borderRadius: "50%",
            background: "#FFFFFF",
            border: `2px solid ${T.color.accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 20px -8px rgba(58,52,40,0.35)"
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill={T.color.accent} aria-hidden>
            <path d="M12 22c-4-4.5-7-8-7-12a7 7 0 1 1 14 0c0 4-3 7.5-7 12Z" />
            <circle cx="12" cy="10" r="2.6" fill="#FFFFFF" />
          </svg>
        </div>
      </div>

      <style>{`
        @keyframes mt1-ping-anim {
          0%   { transform: translate(-50%, -50%) scale(0.55); opacity: 0.75; border-width: 2px; }
          80%  { opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(2.6);  opacity: 0; border-width: 1px; }
        }
        @keyframes mt1-heartbeat-anim {
          0%,  100% { transform: translate(-50%, -50%) scale(1); }
          14%       { transform: translate(-50%, -50%) scale(1.14); }
          28%       { transform: translate(-50%, -50%) scale(1); }
          42%       { transform: translate(-50%, -50%) scale(1.08); }
          56%       { transform: translate(-50%, -50%) scale(1); }
        }
        .mt1-ping {
          position: absolute;
          left: 50%; top: 50%;
          width: 88px; height: 88px;
          margin: 0;
          border-radius: 50%;
          border: 2px solid ${RING};
          transform: translate(-50%, -50%);
          animation: mt1-ping-anim 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          pointer-events: none;
        }
        .mt1-ping--a { animation-delay: 0s; }
        .mt1-ping--b { animation-delay: 0.9s; }
        .mt1-ping--c { animation-delay: 1.8s; }
        .mt1-hq-pin {
          animation: mt1-heartbeat-anim 2.2s ease-in-out infinite;
          transform-origin: center center;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .mt1-ping, .mt1-hq-pin { animation: none !important; }
        }
      `}</style>

      {/* Searched pin (if any) · positioned proportionally to distance */}
      {searchPin && (
        <div
          style={{
            position: "absolute",
            left: `${searchPin.x}%`,
            top: `${searchPin.y}%`,
            transform: "translate(-50%, -100%)",
            transition: "left 320ms ease, top 320ms ease"
          }}
        >
          <div
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: searchPin.inside ? "#3F8F5C" : "#B54A3A",
              border: "3px solid #FFFFFF",
              boxShadow: "0 6px 14px -4px rgba(0,0,0,0.35)"
            }}
            aria-label={searchPin.inside ? "Your postcode · in coverage" : "Your postcode · out of coverage"}
          />
        </div>
      )}

      {/* HQ label · bottom-left */}
      <div
        style={{
          position: "absolute",
          left: "clamp(14px, 2.4vw, 24px)",
          bottom: "clamp(14px, 2.4vw, 24px)",
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "10px 14px",
          boxShadow: T.shadow.softCard,
          fontFamily: T.font.sans
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: RING, boxShadow: `0 0 0 3px rgba(63,143,92,0.2)` }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.color.ink }}>{c.hqLabel}</div>
            <div style={{ fontSize: 10.5, color: T.color.inkMuted, marginTop: 1 }}>{c.hqPostcode} · {c.serviceRadiusMiles}mi radius</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Postcode stub · UK postcode format check + deterministic distance
   ══════════════════════════════════════════════════════════════════ */

function isPlausibleUkPostcode(pc: string): boolean {
  // Loose UK postcode pattern · outward (letters+digits) + optional
  // space + inward (digit+letters). Accepts M1, M1 4AZ, EC1A 1BB, etc.
  return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(pc) ||
         /^[A-Z]{1,2}\d[A-Z\d]?$/i.test(pc); // outward-only is fine for a coverage check
}

/**
 * Hash the postcode to a plausible distance + delivery band for the
 * design catalogue. Real installations plug in a geocoder via a
 * `distanceFor` prop later.
 *
 * The distribution favours "in coverage" for common postcodes so the
 * hero UX of a hit is the default reading. Delivery band is derived
 * from postcode prefix (Highlands/Islands = surcharge, everywhere
 * else = standard).
 */
function stubDistanceFor(pc: string, radiusMiles: number, mode: OwnerMode): CoverageResult {
  let h = 5381;
  for (const ch of pc) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  const raw = h % 90;
  const distanceMiles = raw + 4; // 4..93
  const distanceKm = Math.round(distanceMiles * 1.60934);
  const inCoverage = distanceMiles <= radiusMiles;

  const OUT = pc.split(/\s+/)[0];
  const TOWN: Record<string, string> = {
    M: "Manchester", MK: "Milton Keynes", L: "Liverpool", B: "Birmingham",
    S: "Sheffield", LS: "Leeds", NG: "Nottingham", CV: "Coventry",
    EC: "London EC", WC: "London WC", SW: "London SW", NW: "London NW",
    E: "London E", N: "London N", W: "London W", SE: "London SE",
    BS: "Bristol", BA: "Bath", CF: "Cardiff", EH: "Edinburgh",
    G: "Glasgow", NE: "Newcastle", DL: "Darlington",
    IV: "Inverness", KW: "Kirkwall (Orkney)", HS: "Stornoway (Hebrides)",
    ZE: "Lerwick (Shetland)", AB: "Aberdeen", PA: "Paisley", PH: "Perth",
    BT: "Belfast"
  };
  const prefixKey = (OUT.match(/^[A-Z]{1,2}/) || [""])[0].toUpperCase();
  const townHint = TOWN[prefixKey] ?? "UK";

  // Delivery band · attached for supply-only always, and for
  // fitting-plus-supply when out of zone. Fitting-only doesn't use it.
  const needsBand = mode === "supply-only" || (mode === "fitting-plus-supply" && !inCoverage);
  let deliveryBand: CoverageResult["deliveryBand"];
  let deliveryDaysMin: number | undefined;
  let deliveryDaysMax: number | undefined;
  let surchargeGBP: number | undefined;

  if (needsBand) {
    const HIGHLANDS = new Set(["IV", "KW", "HS", "ZE", "PA", "PH", "AB", "BT"]);
    if (HIGHLANDS.has(prefixKey)) {
      deliveryBand = "highlands";
      deliveryDaysMin = 5;
      deliveryDaysMax = 8;
      surchargeGBP = 79;
    } else if (distanceMiles > 200) {
      deliveryBand = "extended";
      deliveryDaysMin = 4;
      deliveryDaysMax = 6;
      surchargeGBP = 29;
    } else {
      deliveryBand = "standard";
      deliveryDaysMin = 3;
      deliveryDaysMax = 5;
      surchargeGBP = 0;
    }
  }

  return {
    postcode: pc,
    distanceMiles,
    distanceKm,
    inCoverage,
    townHint,
    deliveryBand,
    deliveryDaysMin,
    deliveryDaysMax,
    surchargeGBP
  };
}
