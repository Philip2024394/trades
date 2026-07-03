// Section registrations — single import point.
//
// Importing this module registers every known Studio section. Any code
// path that needs the registry populated (renderer, editor, Library UI,
// AI, Score engine) imports this module first — or transitively depends
// on something that does.
//
// New sections: add one line here + create the file under
// `sections/{library}/{id}.tsx`. Never edit any consumer.

// ─── Hero library ──────────────────────────────────────────────────
import "./hero/plantHireBold";
import "./hero/splitPhotoLeft";
import "./hero/minimalCentred";
// State-of-the-art heroes — trade-focused, theme-aware, mobile-first.
// Each is designed for a specific merchant intent (trust / emergency /
// portfolio / stats / postcode / storefront / social-proof).
import "./hero/trustAnchor";
import "./hero/emergency247";
import "./hero/portfolioMosaic";
import "./hero/statHero";
import "./hero/postcodeLocal";
import "./hero/productShowroom";
import "./hero/reviewWave";
// Second wave — unique UI patterns, one hero per pattern to keep the
// library discoverable rather than a wall of near-duplicates.
import "./hero/chatBubbleHero";
import "./hero/beforeAfterSlider";
import "./hero/animatedGradient";
import "./hero/badgeWall";
import "./hero/mapHero";
import "./hero/videoBackground";
import "./hero/magazineEditorial";
import "./hero/compareHero";
import "./hero/qrPosterHero";
// Signature trade hero — animated tools (hammer swings, saw slides,
// wrench turns, drill bit spins, paintbrush sweeps). Pure SVG + CSS.
import "./hero/animationHero";
// Kinetic typography — 6 selectable text-animation styles (roll-up,
// fall-down, wipe-reveal, blur-focus, word-rotate, typewriter).
import "./hero/textKineticHero";

// ─── CTA library ───────────────────────────────────────────────────
import "./cta/centred";

// ─── Product Grid library ─────────────────────────────────────────
import "./product_grid/classic3col";

// ─── Services library ─────────────────────────────────────────────
import "./services/list";

// ─── FAQ library ──────────────────────────────────────────────────
import "./faq/accordion";

// ─── Gallery library ─────────────────────────────────────────────
import "./gallery/grid";

// ─── Video library ───────────────────────────────────────────────
import "./video/embed";

// ─── Pricing library ─────────────────────────────────────────────
import "./pricing/threeTier";

// ─── Statistics library ─────────────────────────────────────────
import "./statistics/band";

// ─── Brands library ─────────────────────────────────────────────
import "./brands/strip";

// ─── Team library ───────────────────────────────────────────────
import "./team/cards";

// ─── Newsletter library ─────────────────────────────────────────
import "./newsletter/inline";

// ─── Contact library ────────────────────────────────────────────
import "./contact/split";

// ─── Map library ────────────────────────────────────────────────
import "./map/embed";

// ─── Banner library ────────────────────────────────────────────
import "./banner/ribbon";

// ─── Categories library ────────────────────────────────────────
import "./categories/grid";

// ─── Features library ──────────────────────────────────────────────
import "./features/iconGrid";

// ─── Testimonials library ──────────────────────────────────────────
import "./testimonials/cardGrid";

// ─── Footer library ────────────────────────────────────────────────
import "./footer/minimal";

// ─── Add-on wrappers ───────────────────────────────────────────────
// Every visual add-on is registered as a Studio section under
// addons/. Wrappers reuse the existing profile components + data and
// expose appearance-only editableFields; content lives in the
// dedicated add-on editors.
import "./addons";

// ─── All 18 canonical libraries are now populated with at least one
//    reference registration. Module 11 will multiply variants per
//    library toward the master brief's 10-per-library goal. Adding a
//    new variant is a single-file exercise — the shell contract is
//    stable. ─────────────────────────────────────────────────────────

export {}; // marks this as a module even with only side-effect imports
