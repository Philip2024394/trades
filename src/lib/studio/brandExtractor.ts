// Brand extractor — server-only URL → candidate brand tokens.
//
// Simple, regex-based scrape (avoids a full HTML-parsing dependency).
// Fetches the URL, extracts:
//   • <meta name="theme-color" content="…">           → color.accent
//   • Google Fonts family names                        → font.heading / font.body
//   • inline `style="…"` hex colours (frequency count) → color.primary / color.surface
//   • common tokens embedded in CSS (background, color)
//
// Returns candidates the merchant reviews before applying. NEVER auto-
// applies — the Module 4 tokens API is used explicitly by the wizard
// after merchant consent.

export type BrandExtractionCandidates = {
  url: string;
  fetchedAt: string;
  tokens: Partial<{
    "color.accent": string;
    "color.primary": string;
    "color.surface": string;
    "color.text": string;
    "font.heading": string;
    "font.body": string;
  }>;
  raw: {
    colors: { hex: string; count: number }[];
    fonts: string[];
    themeColor: string | null;
  };
};

const HEX_STANDALONE = /#([0-9a-f]{6})\b/gi;
const META_THEME =
  /<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i;
const GOOGLE_FONT_HREF =
  /href=["']https:\/\/fonts\.googleapis\.com\/css[^"']*["']/gi;
const GOOGLE_FONT_FAMILY = /family=([^&:"']+)/gi;
const STYLE_ATTR = /style=["'][^"']*["']/gi;
const CSS_COLOR_RULE = /(?:background(?:-color)?|color)\s*:\s*(#[0-9a-f]{6}|rgb\([^)]+\))/gi;

const USER_AGENT =
  "Mozilla/5.0 (compatible; StudioBrandExtractor/1.0; +https://xratedtrade.com)";

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 1_500_000; // 1.5 MB — safety cap

function normaliseHex(raw: string): string | null {
  const m = /^#[0-9a-f]{6}$/i.exec(raw.trim());
  if (!m) return null;
  return raw.trim().toUpperCase();
}

function rgbToHex(rgb: string): string | null {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(rgb);
  if (!m) return null;
  const [_, r, g, b] = m;
  const toHex = (n: string) =>
    Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Distance between two hex colours in RGB space. Used to filter out
 *  near-duplicates in the frequency count. */
function hexDistance(a: string, b: string): number {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/** Very rough luminance for picking a "light surface" hex from a list. */
function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

async function fetchWithTimeout(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new Error("Response too large");
    }
    return new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(t);
  }
}

export async function extractBrandFromUrl(
  url: string
): Promise<BrandExtractionCandidates> {
  // Validate + coerce protocol.
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  const u = new URL(target); // throws on garbage

  const html = await fetchWithTimeout(u.toString());

  // ─── Colours ────────────────────────────────────────────────
  const colourCounts = new Map<string, number>();
  const bumpColour = (raw: string) => {
    const norm =
      normaliseHex(raw) ??
      (raw.startsWith("rgb") ? rgbToHex(raw) : null);
    if (!norm) return;
    // Skip pure white / near-white / pure black to avoid overwhelming
    // the frequency map with body defaults.
    const lum = luminance(norm);
    if (lum > 0.98 || lum < 0.02) return;
    colourCounts.set(norm, (colourCounts.get(norm) ?? 0) + 1);
  };

  // Meta theme-color.
  const themeMatch = META_THEME.exec(html);
  const themeColor = themeMatch ? normaliseHex(themeMatch[1]) : null;
  if (themeColor) bumpColour(themeColor);

  // Inline style attributes.
  const styleAttrs = html.match(STYLE_ATTR) ?? [];
  for (const attr of styleAttrs) {
    let m;
    // Direct hex within style attrs.
    HEX_STANDALONE.lastIndex = 0;
    while ((m = HEX_STANDALONE.exec(attr)) !== null) {
      bumpColour(`#${m[1]}`);
    }
    // CSS rules.
    CSS_COLOR_RULE.lastIndex = 0;
    while ((m = CSS_COLOR_RULE.exec(attr)) !== null) {
      bumpColour(m[1]);
    }
  }

  // Merge near-duplicate colours (within 12 units in RGB space) into
  // the more frequent representative.
  const merged: Map<string, number> = new Map();
  const sortedByCount = Array.from(colourCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  for (const [hex, count] of sortedByCount) {
    let attached = false;
    for (const key of Array.from(merged.keys())) {
      if (hexDistance(hex, key) < 12) {
        merged.set(key, (merged.get(key) ?? 0) + count);
        attached = true;
        break;
      }
    }
    if (!attached) merged.set(hex, count);
  }

  const rawColours = Array.from(merged.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([hex, count]) => ({ hex, count }));

  // ─── Fonts (Google Fonts href scrape) ──────────────────────
  const fonts: string[] = [];
  const gfHrefs = html.match(GOOGLE_FONT_HREF) ?? [];
  for (const href of gfHrefs) {
    GOOGLE_FONT_FAMILY.lastIndex = 0;
    let m;
    while ((m = GOOGLE_FONT_FAMILY.exec(href)) !== null) {
      const raw = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
      if (raw && !fonts.includes(raw)) fonts.push(raw);
    }
  }

  // ─── Infer candidate tokens ────────────────────────────────
  const tokens: BrandExtractionCandidates["tokens"] = {};
  if (themeColor) tokens["color.accent"] = themeColor;
  else if (rawColours[0]) tokens["color.accent"] = rawColours[0].hex;

  if (rawColours[0] && rawColours[0].hex !== tokens["color.accent"]) {
    tokens["color.primary"] = rawColours[0].hex;
  } else if (rawColours[1]) {
    tokens["color.primary"] = rawColours[1].hex;
  }

  // Surface: pick the lightest of the top 5.
  const lightest = rawColours
    .slice(0, 5)
    .sort((a, b) => luminance(b.hex) - luminance(a.hex))[0];
  if (lightest && luminance(lightest.hex) > 0.75) {
    tokens["color.surface"] = lightest.hex;
  }

  if (fonts[0]) {
    tokens["font.heading"] = `'${fonts[0]}', system-ui, sans-serif`;
  }
  if (fonts[1]) {
    tokens["font.body"] = `'${fonts[1]}', system-ui, sans-serif`;
  } else if (fonts[0]) {
    tokens["font.body"] = `'${fonts[0]}', system-ui, sans-serif`;
  }

  return {
    url: u.toString(),
    fetchedAt: new Date().toISOString(),
    tokens,
    raw: {
      colors: rawColours,
      fonts,
      themeColor
    }
  };
}
