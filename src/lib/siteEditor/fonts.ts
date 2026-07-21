// Curated font catalogue for the Site Editor's text tool. Every
// family listed here is either a browser system font or loaded via
// the app's global stylesheet (see src/app/layout.tsx which imports
// Inter, Playfair Display, Roboto, Poppins, DM Sans, Manrope), so
// picking one has no additional font-download cost.
//
// Server-side ffmpeg composite (videoCompose.ts) falls back to a
// generic sans stack for fonts it can't render; the client preview
// uses the true family. Any deviation between the two is documented
// per row.

export type FontChoice = {
  slug:       string;
  label:      string;
  /** CSS `font-family` value — must be a family the browser or the
   *  loaded webfont set can resolve. */
  cssFamily:  string;
  /** Category for the picker's group chips. */
  category:   "sans" | "serif" | "display" | "mono";
  /** Ships with a bold weight — used to grey out the Bold toggle
   *  if false. Every family here supports 400/700+ so this is
   *  currently always true; kept for future additions. */
  bold:       boolean;
};

export const FONT_CATALOGUE: FontChoice[] = [
  { slug: "system",   label: "System",         cssFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', category: "sans",    bold: true },
  { slug: "inter",    label: "Inter",          cssFamily: '"Inter", system-ui, sans-serif',                          category: "sans",    bold: true },
  { slug: "roboto",   label: "Roboto",         cssFamily: '"Roboto", system-ui, sans-serif',                         category: "sans",    bold: true },
  { slug: "poppins",  label: "Poppins",        cssFamily: '"Poppins", system-ui, sans-serif',                        category: "sans",    bold: true },
  { slug: "dm-sans",  label: "DM Sans",        cssFamily: '"DM Sans", system-ui, sans-serif',                        category: "sans",    bold: true },
  { slug: "manrope",  label: "Manrope",        cssFamily: '"Manrope", system-ui, sans-serif',                        category: "sans",    bold: true },
  { slug: "playfair", label: "Playfair Display", cssFamily: '"Playfair Display", Georgia, serif',                     category: "display", bold: true },
  { slug: "mono",     label: "Mono",           cssFamily: 'ui-monospace, "SFMono-Regular", Menlo, monospace',        category: "mono",    bold: true }
];

/** Look a font up by slug. Falls back to the first entry (System)
 *  when the slug is unknown. */
export function findFont(slug: string): FontChoice {
  return FONT_CATALOGUE.find((f) => f.slug === slug) ?? FONT_CATALOGUE[0];
}
