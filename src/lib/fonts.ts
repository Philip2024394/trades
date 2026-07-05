// Platform typography — next/font Google Font loading.
//
// Six curated font families loaded once at build time and exposed as
// CSS variables. Every rebuilt section reads `font-heading` /
// `font-body` Tailwind classes which resolve to the ACTIVE theme's
// CSS variables — flipping the theme flips every heading + body font
// across the entire site with no re-render.
//
// Loaded families:
//   Inter             — Modern (default)         → --font-inter
//   Manrope           — Corporate                → --font-manrope
//   Playfair Display  — Luxury heading pair      → --font-playfair
//   Roboto            — Industrial               → --font-roboto
//   DM Sans           — Minimal                  → --font-dm-sans
//   Poppins           — Creative                 → --font-poppins
//
// Bundle cost: next/font strips unused glyph subsets automatically;
// each family adds ~15-25 KB gzipped per weight. We ship only the
// weights we actually render (400, 500, 600, 700, 800).

import {
  Inter,
  Manrope,
  Playfair_Display,
  Roboto,
  DM_Sans,
  Poppins
} from "next/font/google";

// ─── Modern — Inter ───────────────────────────────────────────
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap"
});

// ─── Corporate — Manrope ───────────────────────────────────────
export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap"
});

// ─── Luxury heading — Playfair Display ────────────────────────
export const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-playfair",
  display: "swap"
});

// ─── Industrial — Roboto ──────────────────────────────────────
export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-roboto",
  display: "swap"
});

// ─── Minimal — DM Sans ────────────────────────────────────────
export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap"
});

// ─── Creative — Poppins ───────────────────────────────────────
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap"
});

/** Combined className that mounts every font family's CSS variable
 *  on a single element. Apply to <html> or <body> in the root layout
 *  so every child element can reference any font family via var(). */
export const allFontVariables = [
  inter.variable,
  manrope.variable,
  playfair.variable,
  roboto.variable,
  dmSans.variable,
  poppins.variable
].join(" ");
