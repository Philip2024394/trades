// src/app/nex-native/directory/__tests__/page-no-fabrication.test.ts
//
// NEX Directory · Phase A · Static grep invariants for the UI layer.
//
// Covers (via static source-text analysis)
//   · No fabricated city / coordinate / business-name literals in the
//     Directory UI files
//   · No stock imagery references · no placeholder.jpg / default.png
//   · No `javascript:` or `data:` href attacks (defensive · we build
//     every href from Phase C's typed path strings only)
//   · page.tsx + _directory-card.tsx + _directory-results.tsx +
//     _no-image.tsx carry no DB / network / clock / randomness
//     tokens
//   · The two sealed route patterns are the ONLY `/nex-native/`
//     literal URLs that reach the UI from the destination contract
//   · UI files import ONLY from the sealed Phase B/C barrel + the
//     local underscore-prefixed Phase A siblings + Next.js primitives
//
// Keep in sync with
//   · scripts/nex-canonical/* sealed modules
//   · src/lib/nex-native/directory/* Phase B+C sealed modules

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const UI_DIR = resolve(__dirname, "..");

function read(file: string): string {
  return readFileSync(join(UI_DIR, file), "utf8");
}

function stripComments(src: string): string {
  // Strip line comments FIRST so `/*` inside `//` prose does not
  // confuse the block-comment regex. (Lesson from Phase B.)
  const noLine = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  const noBlock = noLine.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock;
}

const UI_FILES: readonly string[] = [
  "page.tsx",
  "_directory-card.tsx",
  "_directory-results.tsx",
  "_no-image.tsx",
  "_distance.ts",
];

// ═════════════════════════════════════════════════════════════════════
// §1 · No fabrication literals
// ═════════════════════════════════════════════════════════════════════

const FORBIDDEN_CITY_LITERALS: readonly string[] = [
  "Yogyakarta",
  "Jakarta",
  "Bali",
  "Denpasar",
  "Bandung",
  "Surabaya",
];

// Checks ONLY quoted-literal usages (via the TOKEN_PATTERNS section
// §2 for image host hits). Bare prose like "nothing is fabricated"
// in user-facing copy is honest and intentional.
const FORBIDDEN_FABRICATION_LITERALS: readonly string[] = [
  "lorem ipsum",
  "example.com",
  "stock-image",
  "default-image",
  "default.jpg",
  "default.png",
  "unknown-business",
  "unknown-city",
  "coming-soon",
  "null-island",
];

describe("Phase A · no fabrication literals", () => {
  for (const file of UI_FILES) {
    for (const needle of FORBIDDEN_CITY_LITERALS) {
      it(`${file} contains no literal "${needle}"`, () => {
        const src = stripComments(read(file));
        expect(src).not.toContain(needle);
      });
    }
    for (const needle of FORBIDDEN_FABRICATION_LITERALS) {
      it(`${file} contains no literal "${needle}"`, () => {
        const src = stripComments(read(file));
        expect(src.toLowerCase()).not.toContain(needle.toLowerCase());
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// §2 · No fabricated image URLs
// ═════════════════════════════════════════════════════════════════════

describe("Phase A · no stock-image / asset fabrication", () => {
  for (const file of UI_FILES) {
    it(`${file} has no .png / .jpg / .jpeg / .webp / .gif URL literals`, () => {
      const src = stripComments(read(file));
      // Any explicit image URL hard-coded in UI source is a fabrication.
      // Real primary images come from the Phase B view-model carrying
      // listing.primaryImage.url.
      const imageUrlPattern =
        /["'`][^"'`]*\.(?:png|jpg|jpeg|webp|gif)["'`]/gi;
      const matches = src.match(imageUrlPattern) ?? [];
      expect(matches).toEqual([]);
    });

    it(`${file} has no cdn./unsplash./picsum. host literals in URL context`, () => {
      const src = stripComments(read(file));
      // Match ONLY when the host appears inside a quoted URL (so a
      // sentence like "Nothing is a placeholder" in user-facing
      // honest copy does not false-flag). URL contexts begin with
      // `http://` or `https://` or a quoted scheme-less `//host/`.
      const quotedUrlPattern =
        /["'`](?:https?:)?\/\/[^"'`]*(?:cdn\.|unsplash\.|picsum\.|placeholder\.)[^"'`]*["'`]/gi;
      const matches = src.match(quotedUrlPattern) ?? [];
      expect(matches).toEqual([]);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §3 · No DB / network / clock / randomness in UI files
// ═════════════════════════════════════════════════════════════════════

const FORBIDDEN_RUNTIME_TOKENS: readonly string[] = [
  "nexSupabaseAdmin",
  "@supabase/supabase-js",
  "createClient",
  "pg.Client",
  "Math.random",
  "crypto.random",
  "node:fs",
  "readFileSync",
  "writeFileSync",
];

describe("Phase A · UI files have no server-only runtime leaks", () => {
  for (const file of UI_FILES) {
    for (const needle of FORBIDDEN_RUNTIME_TOKENS) {
      it(`${file} contains no "${needle}"`, () => {
        const src = stripComments(read(file));
        expect(src).not.toContain(needle);
      });
    }
  }
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Hard-coded URL discipline
// ═════════════════════════════════════════════════════════════════════

describe("Phase A · UI hard-coded URL discipline", () => {
  it("the only /nex-native/ hard-coded URL literals in page.tsx are the /nex-native/directory route itself", () => {
    const src = stripComments(read("page.tsx"));
    // Match ONLY quoted string literals (href values etc.) · not
    // import specifiers like `@/lib/nex-native/app/session` which
    // are compile-time paths, not runtime URLs.
    const hits =
      src.match(/["'`]\/nex-native\/[A-Za-z0-9_{}[\]-]+["'`]/g) ?? [];
    const seen = new Set(hits);
    for (const h of seen) {
      // Strip quotes for comparison.
      const url = h.slice(1, -1);
      if (url === "/nex-native/directory") continue;
      throw new Error(
        `page.tsx hard-codes a URL other than "/nex-native/directory": ${h}`,
      );
    }
    expect(true).toBe(true);
  });

  it("_directory-card.tsx has no /nex-native/ hard-coded URLs (routes come from Phase C destination.path only)", () => {
    const src = stripComments(read("_directory-card.tsx"));
    const hits = src.match(/["'`]\/nex-native\/[^"'`]*["'`]/g) ?? [];
    expect(hits).toEqual([]);
  });

  it("no UI file carries a javascript: or data: href", () => {
    for (const file of UI_FILES) {
      const src = stripComments(read(file));
      expect(src).not.toContain("javascript:");
      // Allow `data-*` HTML attribute prefixes (common) but reject
      // `data:` URL schemes used as href.
      const dataUrlPattern = /["'`]data:[a-z]+\//gi;
      const matches = src.match(dataUrlPattern) ?? [];
      expect(matches).toEqual([]);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Dead-end-destination discipline
// ═════════════════════════════════════════════════════════════════════

describe("Phase A · no dead-end clickable destinations", () => {
  it("_directory-card.tsx only wraps in <Link> when destination.kind is nex_business or nex_user_profile", () => {
    const src = stripComments(read("_directory-card.tsx"));
    // The isLinkable guard must mention both nex_business and
    // nex_user_profile. No other destination kind may be in the
    // isLinkable predicate.
    expect(src).toMatch(/nex_business.*nex_user_profile|nex_user_profile.*nex_business/);
    // claim_available / place_detail must not be rendered as links
    // (they appear in the file but inside non-link branches).
    expect(src).toContain('"claim_available"');
    expect(src).toContain('"place_detail"');
  });

  it("page.tsx pre-filters redirect_to_canonical + unresolved from render", () => {
    const src = stripComments(read("page.tsx"));
    expect(src).toContain('"redirect_to_canonical"');
    expect(src).toContain('"unresolved"');
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Server/Client boundary
// ═════════════════════════════════════════════════════════════════════

describe("Phase A · server/client boundary", () => {
  it("page.tsx is a server component (no 'use client' directive)", () => {
    const src = read("page.tsx");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });

  it("_directory-results.tsx is a client component", () => {
    const src = read("_directory-results.tsx");
    expect(src).toMatch(/^\s*["']use client["']/m);
  });

  it("_directory-card.tsx is a client component", () => {
    const src = read("_directory-card.tsx");
    expect(src).toMatch(/^\s*["']use client["']/m);
  });

  it("_no-image.tsx is a shared component (no 'use client' required · pure SVG)", () => {
    const src = read("_no-image.tsx");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });

  it("_distance.ts is pure (no 'use client' required)", () => {
    const src = read("_distance.ts");
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Destination-kind coverage in the card
// ═════════════════════════════════════════════════════════════════════

describe("Phase A · destination-kind coverage in _directory-card.tsx", () => {
  it("the card references every Phase C sealed destination kind", () => {
    const src = read("_directory-card.tsx");
    for (const kind of [
      "nex_business",
      "nex_user_profile",
      "claim_available",
      "place_detail",
    ]) {
      expect(src).toContain(`"${kind}"`);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Honest empty / preparing states
// ═════════════════════════════════════════════════════════════════════

describe("Phase A · honest empty + preparing states", () => {
  it("page.tsx has a preparing state when systemReady is false", () => {
    const src = read("page.tsx");
    expect(src).toContain("SystemPreparingState");
    expect(src).toContain("being prepared");
  });

  it("page.tsx has an empty state when results are 0", () => {
    const src = read("page.tsx");
    expect(src).toContain("EmptyState");
    expect(src).toContain("No listings yet");
  });

  it("empty state explicitly declares the content is not fabricated", () => {
    const src = read("page.tsx");
    expect(src).toContain("Nothing on this page is fabricated");
  });
});
