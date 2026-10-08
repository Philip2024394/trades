// src/app/nex-native/directory/[id]/__tests__/detail-page-no-fabrication.test.ts
//
// NEX Directory · Phase A · Detail page static-grep invariants.
//
// These tests read `src/app/nex-native/directory/[id]/page.tsx` as text
// and assert architectural invariants that cannot be expressed in
// TypeScript types alone:
//
//   · No visitor-facing exposure of ownership state ("Unclaimed",
//     "claim this listing", etc.)
//   · No dead-button pattern or "coming soon" placeholder copy
//   · No fabricated city / coordinate / stock-image literals
//   · No DB / network / clock / randomness tokens in the page module
//   · Server component discipline (no 'use client')
//   · Hard-coded URL discipline (only the back-to-directory anchor is
//     a direct literal; detail-route URLs come from the shared
//     `buildDirectoryDetailPath` helper)
//   · Correct destination handling for the five Phase C kinds
//
// If a future wave accidentally lands "Unclaimed" or "Message Business"
// copy on the detail page, this suite fails loudly.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const PAGE_DIR = resolve(__dirname, "..");
const PAGE_FILE = join(PAGE_DIR, "page.tsx");

function src(): string {
  return readFileSync(PAGE_FILE, "utf8");
}

function stripComments(input: string): string {
  const noLine = input
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return noLine.replace(/\/\*[\s\S]*?\*\//g, "");
}

function stripped(): string {
  return stripComments(src());
}

// ═════════════════════════════════════════════════════════════════════
// §1 · No visitor-facing ownership exposure
// ═════════════════════════════════════════════════════════════════════

describe("detail page · no visitor-facing ownership exposure", () => {
  it("does not expose the word 'Unclaimed' to visitors", () => {
    expect(stripped()).not.toMatch(/\bUnclaimed\b/);
  });

  it("does not expose 'claim this listing' copy to visitors", () => {
    expect(stripped().toLowerCase()).not.toContain("claim this listing");
  });

  it("does not render a 'Message Business' button (reserved for next build)", () => {
    expect(stripped()).not.toMatch(/Message Business/);
  });

  it("does not render coming-soon / dead-button placeholder copy", () => {
    const s = stripped().toLowerCase();
    expect(s).not.toContain("coming soon");
    expect(s).not.toContain("coming-soon");
    expect(s).not.toContain("coming later");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · No stock imagery / fabricated URLs
// ═════════════════════════════════════════════════════════════════════

describe("detail page · no stock imagery / fabricated URLs", () => {
  it("has no .png / .jpg / .jpeg / .webp / .gif URL literals", () => {
    const matches =
      stripped().match(/["'`][^"'`]*\.(?:png|jpg|jpeg|webp|gif)["'`]/gi) ??
      [];
    expect(matches).toEqual([]);
  });

  it("has no cdn / unsplash / picsum / placeholder host literals in URL context", () => {
    const matches =
      stripped().match(
        /["'`](?:https?:)?\/\/[^"'`]*(?:cdn\.|unsplash\.|picsum\.|placeholder\.)[^"'`]*["'`]/gi,
      ) ?? [];
    expect(matches).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · No fabricated content literals
// ═════════════════════════════════════════════════════════════════════

describe("detail page · no fabricated content literals", () => {
  const FORBIDDEN_CITY_LITERALS = [
    "Yogyakarta",
    "Jakarta",
    "Bali",
    "Denpasar",
    "Bandung",
    "Surabaya",
  ];
  const FORBIDDEN_FAB = [
    "lorem ipsum",
    "example.com",
    "stock-image",
    "default-image",
    "default.jpg",
    "default.png",
    "unknown-business",
    "unknown-city",
    "null-island",
  ];
  for (const needle of FORBIDDEN_CITY_LITERALS) {
    it(`no literal "${needle}"`, () => {
      expect(stripped()).not.toContain(needle);
    });
  }
  for (const needle of FORBIDDEN_FAB) {
    it(`no literal "${needle}"`, () => {
      expect(stripped().toLowerCase()).not.toContain(needle.toLowerCase());
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §4 · No runtime side effects
// ═════════════════════════════════════════════════════════════════════

describe("detail page · no runtime side effects", () => {
  const FORBIDDEN_RUNTIME = [
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
  for (const needle of FORBIDDEN_RUNTIME) {
    it(`no "${needle}"`, () => {
      expect(stripped()).not.toContain(needle);
    });
  }
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Server component discipline
// ═════════════════════════════════════════════════════════════════════

describe("detail page · server component", () => {
  it("has no 'use client' directive (server component)", () => {
    expect(src()).not.toMatch(/^\s*["']use client["']/m);
  });

  it("imports the server-only guard", () => {
    expect(stripped()).toMatch(/import\s+["']server-only["']/);
  });

  it("resolves the NEX app session (same convention as the list page)", () => {
    expect(stripped()).toContain("resolveNexAppSessionFromContext");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §6 · Hard-coded URL discipline
// ═════════════════════════════════════════════════════════════════════

describe("detail page · hard-coded URL discipline", () => {
  it("the only hard-coded /nex-native/ URL is the back-to-directory anchor", () => {
    const hits =
      stripped().match(/["'`]\/nex-native\/[A-Za-z0-9_{}[\]-]+["'`]/g) ?? [];
    for (const h of hits) {
      const url = h.slice(1, -1);
      if (url === "/nex-native/directory") continue;
      throw new Error(
        `detail page hard-codes an unexpected URL literal: ${h}`,
      );
    }
    expect(true).toBe(true);
  });

  it("builds detail routes via the shared buildDirectoryDetailPath helper (no detail-URL literal)", () => {
    expect(stripped()).toContain("buildDirectoryDetailPath");
    const detailLiteral =
      stripped().match(/["'`]\/nex-native\/directory\/\{/g) ?? [];
    expect(detailLiteral).toEqual([]);
  });

  it("has no javascript: hrefs", () => {
    expect(stripped()).not.toContain("javascript:");
  });

  it("has no data: URL hrefs", () => {
    const dataUrl = stripped().match(/["'`]data:[a-z]+\//gi) ?? [];
    expect(dataUrl).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7 · Destination handling
// ═════════════════════════════════════════════════════════════════════

describe("detail page · destination handling", () => {
  it("redirects nex_business destinations to the owner's existing route", () => {
    expect(stripped()).toMatch(/"nex_business"[\s\S]*redirect\(/);
  });

  it("redirects nex_user_profile destinations to the owner's existing route", () => {
    expect(stripped()).toMatch(/"nex_user_profile"[\s\S]*redirect\(/);
  });

  it("follows the SUPERSEDED chain via server redirect to the target id", () => {
    expect(stripped()).toContain("redirect_to_canonical");
    expect(stripped()).toContain("targetBusinessId");
  });

  it("notFound()s on unresolved destinations", () => {
    expect(stripped()).toContain('"unresolved"');
    expect(stripped()).toContain("notFound(");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §7b · "Verified" chip semantic (D-1 fix lock)
// ═════════════════════════════════════════════════════════════════════

describe("detail page · Verified chip is gated on lifecycle, not evidence", () => {
  it("imports the sealed isVerifiedLifecycle predicate", () => {
    expect(stripped()).toMatch(
      /import\s*\{\s*isVerifiedLifecycle\s*\}\s*from\s*["']\.\.\/_verified["']/,
    );
  });

  it("gates the Verified chip on isVerifiedLifecycle(listing.lifecycleState)", () => {
    const s = stripped();
    // The gate must call the predicate against the view-model's
    // lifecycleState field · nothing else.
    expect(s).toMatch(/isVerifiedLifecycle\(\s*listing\.lifecycleState\s*\)/);
  });

  it("does NOT gate the Verified chip on hasEvidence (provenance != verification)", () => {
    const s = stripComments(src());
    // The exact mistake D-1 identified: `hasEvidence ?` followed by
    // a span rendering the verified chip. If this pattern reappears
    // the semantic defect is back.
    const multiline = s.replace(/\s+/g, " ");
    expect(multiline).not.toMatch(
      /hasEvidence\s*\?[^?]*data-nex-directory-detail-chip="verified"/,
    );
  });

  it("does not claim 'Verified via the NEX canonical pipeline' (pipeline provenance is NOT visitor verification)", () => {
    // The previous title attribute explicitly conflated provenance with
    // verification. The sealed replacement reads simply "Verified listing".
    expect(stripped()).not.toContain("Verified via the NEX canonical pipeline");
  });

  it("still exposes hasEvidence as internal state via data-attr (admin / future Marketing)", () => {
    // The chip stops using hasEvidence for its gate, but provenance
    // presence is legitimately useful operational state. The article
    // keeps `data-nex-directory-detail-has-evidence` for internal
    // consumers · it just never surfaces as "Verified" to the visitor.
    expect(stripped()).toContain("data-nex-directory-detail-has-evidence");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §8 · Primary interaction area discipline
// ═════════════════════════════════════════════════════════════════════

describe("detail page · primary interaction area · no dead affordances", () => {
  it("renders a Call action only when phoneE164 is present", () => {
    const s = stripped();
    expect(s).toContain("tel:");
    // The tel: href must be guarded by a non-null check on phoneE164.
    expect(s).toMatch(/phoneE164\s*!==\s*null/);
  });

  it("renders a Website action only when websiteApex is present", () => {
    const s = stripped();
    expect(s).toContain("buildWebsiteHref");
    expect(s).toMatch(/websiteApex\s*!==\s*null/);
  });

  it("the contact section renders nothing when no real contact fields exist", () => {
    const s = stripped();
    // The ContactSection must return null when no actionable field exists.
    expect(s).toMatch(/if \(!haveAny\)[\s\S]*return null/);
  });
});
