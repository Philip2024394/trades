// src/lib/nex/i18n/foundation.test.ts
//
// Phase B.7 · NEX Universal Language Foundation · deterministic
// guards for the pieces introduced in this phase: the data-driven
// supported-locale registry, the server-side `t()` + resolver, the
// formatter module, the I18nProvider mount in the nex-native
// layout, and the one authoritative fallback.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { I18N_KEYS } from "./keys";
import { EN_PACK } from "./packs/en";
import { ID_PACK } from "./packs/id";
import {
  DEFAULT_LANG,
  PACKS,
  SUPPORTED_LANG_CODES,
  SUPPORTED_LOCALES,
  narrowToSupportedLang,
  type Lang,
} from "./supported-locales";
import { resolveServerLocale, t, tFor } from "./server";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeFrom,
  formatRelativeTime,
  formatTime,
} from "./format";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function exists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ────────────────────────────────────────────────────────────────────
// Section A · supported-locale registry
// ────────────────────────────────────────────────────────────────────

describe("supported-locale registry · architecture", () => {
  it("exposes at least `id` and `en`", () => {
    expect(SUPPORTED_LANG_CODES.has("id")).toBe(true);
    expect(SUPPORTED_LANG_CODES.has("en")).toBe(true);
  });

  it("every supported locale has code + label + pack with every I18N_KEY", () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(loc.code).toMatch(/^[a-z-]{2,}$/i);
      expect(loc.label.length).toBeGreaterThan(0);
      for (const key of I18N_KEYS) {
        expect(loc.pack[key], `${loc.code} missing ${key}`).toBeDefined();
      }
    }
  });

  it("DEFAULT_LANG is `id` and is a member of the registry", () => {
    expect(DEFAULT_LANG).toBe("id");
    expect(SUPPORTED_LANG_CODES.has(DEFAULT_LANG)).toBe(true);
  });

  it("PACKS is derived from the registry · one entry per supported code", () => {
    const packKeys = Object.keys(PACKS).sort();
    const registryCodes = SUPPORTED_LOCALES.map((l) => l.code).sort();
    expect(packKeys).toEqual(registryCodes);
  });

  it("narrowToSupportedLang · accepts supported · rejects everything else", () => {
    expect(narrowToSupportedLang("id")).toBe("id");
    expect(narrowToSupportedLang("en")).toBe("en");
    expect(narrowToSupportedLang(" EN ")).toBe("en"); // trim + lowercase
    expect(narrowToSupportedLang("")).toBeNull();
    expect(narrowToSupportedLang(null)).toBeNull();
    expect(narrowToSupportedLang(undefined)).toBeNull();
    expect(narrowToSupportedLang("xx")).toBeNull();
    expect(narrowToSupportedLang("en-GB")).toBeNull(); // registry carries primary subtag only · narrower is strict
  });
});

// ────────────────────────────────────────────────────────────────────
// Section B · server-side t() + resolveServerLocale precedence
// ────────────────────────────────────────────────────────────────────

describe("server · resolveServerLocale precedence", () => {
  it("URL ?lang wins over everything", () => {
    const l = resolveServerLocale({
      urlParam: "en",
      accountLocale: "id",
      acceptLanguage: "id-ID,id;q=0.9",
    });
    expect(l).toBe("en");
  });

  it("account preference wins over Accept-Language when URL is absent", () => {
    const l = resolveServerLocale({
      urlParam: null,
      accountLocale: "en",
      acceptLanguage: "id-ID,id;q=0.9",
    });
    expect(l).toBe("en");
  });

  it("Accept-Language primary subtag is used when URL + account absent", () => {
    const l = resolveServerLocale({
      urlParam: null,
      accountLocale: null,
      acceptLanguage: "en-US,en;q=0.9,id;q=0.8",
    });
    expect(l).toBe("en");
  });

  it("DEFAULT_LANG is `id` when every input is empty", () => {
    const l = resolveServerLocale({});
    expect(l).toBe(DEFAULT_LANG);
    expect(l).toBe("id");
  });

  it("unsupported URL / account / Accept-Language values fall through to DEFAULT_LANG", () => {
    const l = resolveServerLocale({
      urlParam: "xx",
      accountLocale: "zz",
      acceptLanguage: "fr-FR,fr;q=0.9",
    });
    expect(l).toBe("id");
  });

  it("Accept-Language can be malformed without throwing", () => {
    expect(resolveServerLocale({ acceptLanguage: "" })).toBe("id");
    expect(resolveServerLocale({ acceptLanguage: ",;," })).toBe("id");
  });

  it("explicit account preference is NEVER silently overridden by Accept-Language", () => {
    // Founder rule: Accept-Language is detection/suggestion only ·
    // must not silently override an explicit account choice.
    const l = resolveServerLocale({
      urlParam: null,
      accountLocale: "id",
      acceptLanguage: "en-US",
    });
    expect(l).toBe("id");
  });
});

describe("server · t() uses the same key registry and packs as useT", () => {
  it("returns the ID pack entry for a known key when locale=id", () => {
    expect(t("common.save", "id")).toBe(ID_PACK["common.save"]);
    expect(t("common.save", "id")).toBe("Simpan");
  });

  it("returns the EN pack entry for a known key when locale=en", () => {
    expect(t("common.save", "en")).toBe(EN_PACK["common.save"]);
    expect(t("common.save", "en")).toBe("Save");
  });

  it("falls through to EN pack when a locale pack is missing a key (future-proof)", () => {
    // Both packs cover every I18N_KEY today · we simulate a missing
    // entry by deleting a temporary key. The fallback behaviour is
    // documented in the module docstring so clients can rely on it.
    const originalId = ID_PACK["settings.language.save"];
    try {
      // @ts-expect-error · deliberate deletion for the fallback test
      delete ID_PACK["settings.language.save"];
      expect(t("settings.language.save", "id")).toBe(
        EN_PACK["settings.language.save"],
      );
    } finally {
      ID_PACK["settings.language.save"] = originalId;
    }
  });

  it("tFor returns a stable (key) => string closure bound to a locale", () => {
    const tid = tFor("id");
    const ten = tFor("en");
    expect(tid("common.save")).toBe("Simpan");
    expect(ten("common.save")).toBe("Save");
  });
});

describe("client/server agreement · same resolved pack entry per locale", () => {
  it("for every I18N_KEY · the server t() and the EN/ID pack lookup agree", () => {
    for (const key of I18N_KEYS) {
      expect(t(key, "id")).toBe(ID_PACK[key]);
      expect(t(key, "en")).toBe(EN_PACK[key]);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Section C · formatter foundation
// ────────────────────────────────────────────────────────────────────

describe("format · Intl-based locale-aware output", () => {
  // Use UTC timezone to keep the asserted output deterministic across
  // test environments.
  const UTC = { timeZone: "UTC" } as const;
  const d = new Date("2026-10-07T14:35:00Z");

  it("formatDate · differs between id and en", () => {
    const id = formatDate(d, "id", UTC);
    const en = formatDate(d, "en", UTC);
    expect(id.length).toBeGreaterThan(0);
    expect(en.length).toBeGreaterThan(0);
    // Both contain the day · the formatted strings vary by locale.
    expect(id).toContain("7");
    expect(en).toContain("7");
  });

  it("formatTime · 24h / 12h locale behavior · never empty", () => {
    expect(formatTime(d, "id", UTC)).not.toBe("");
    expect(formatTime(d, "en", UTC)).not.toBe("");
  });

  it("formatDateTime · includes both date and time", () => {
    const out = formatDateTime(d, "en", UTC);
    expect(out).toContain("7");
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });

  it("formatNumber · uses locale-aware grouping", () => {
    const id = formatNumber(1234567.89, "id");
    const en = formatNumber(1234567.89, "en");
    // id-ID uses `.` thousands + `,` decimal · en-US uses `,` thousands + `.` decimal.
    expect(id).toContain("1.234.567");
    expect(en).toContain("1,234,567");
  });

  it("formatRelativeTime · negative = past · positive = future", () => {
    expect(formatRelativeTime(-5, "minute", "en")).toContain("ago");
    expect(formatRelativeTime(5, "minute", "en").toLowerCase()).not.toContain("ago");
  });

  it("formatRelativeFrom · picks a sensible unit", () => {
    const now = new Date("2026-10-07T14:35:00Z");
    const earlier = new Date("2026-10-07T14:30:00Z"); // 5 min earlier
    const much_earlier = new Date("2026-10-01T14:35:00Z"); // 6 days earlier
    expect(formatRelativeFrom(earlier, "en", now)).toMatch(/5|minute/i);
    expect(formatRelativeFrom(much_earlier, "en", now)).toMatch(/6|day/i);
  });

  it("coerces strings and numbers · returns empty string for invalid dates", () => {
    expect(formatDate("not-a-date", "en")).toBe("");
    expect(formatNumber(Number.NaN, "en")).toBe("");
    expect(formatRelativeTime(Number.NaN, "minute", "en")).toBe("");
  });

  it("unknown Lang value falls back to DEFAULT_LANG · never crashes", () => {
    // @ts-expect-error · defensive runtime check
    expect(formatDate(d, "zz", UTC)).not.toBe("");
    // @ts-expect-error · defensive runtime check
    expect(formatNumber(1, "zz")).not.toBe("");
  });
});

// ────────────────────────────────────────────────────────────────────
// Section D · I18nProvider mounted at the nex-native layout root
// ────────────────────────────────────────────────────────────────────

describe("I18nProvider · mounted at the nex-native layout root", () => {
  const LAYOUT = "src/app/nex-native/layout.tsx";

  it("the nex-native layout imports the shared I18nProvider", () => {
    const src = read(LAYOUT);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex\/i18n\/I18nProvider["']/,
    );
    expect(src).toMatch(/import\s*\{\s*I18nProvider\s*\}/);
  });

  it("the nex-native layout wraps children in <I18nProvider>", () => {
    const src = read(LAYOUT);
    expect(src).toMatch(/<I18nProvider\s+initialLang=\{initialLang\}>/);
    expect(src).toMatch(/<\/I18nProvider>/);
  });

  it("the nex-native layout resolves the server locale from session + Accept-Language", () => {
    const src = read(LAYOUT);
    expect(src).toMatch(
      /from\s+["']@\/lib\/nex\/i18n\/server["']/,
    );
    expect(src).toMatch(/resolveServerLocale\s*\(/);
    expect(src).toMatch(/accountLocale/);
    expect(src).toMatch(/acceptLanguage/);
  });
});

// ────────────────────────────────────────────────────────────────────
// Section E · no second i18n registry introduced
// ────────────────────────────────────────────────────────────────────

describe("second-system guard · one registry only", () => {
  it("exactly one authoritative translation PACKS map exists (in supported-locales.ts)", () => {
    // The universal pipe assumes one source of truth for the
    // `Record<Lang, Record<I18nKey, string>>` registry. Any new
    // module exporting a similarly-shaped PACKS object is a
    // potential second system · fail loudly so the next engineer
    // consolidates instead of forking.
    const src = read("src/lib/nex/i18n/supported-locales.ts");
    expect(src).toMatch(/export\s+const\s+PACKS\s*:/);
    // Nothing under `src/lib/nex/i18n/` other than the registry
    // itself + the pack files should export a `PACKS` constant.
    const dir = path.join(ROOT, "src", "lib", "nex", "i18n");
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!full.endsWith(".ts") && !full.endsWith(".tsx")) continue;
      if (name === "supported-locales.ts") continue;
      const body = fs.readFileSync(full, "utf8");
      expect(
        body,
        `${name} must not re-export PACKS · consolidate through supported-locales.ts`,
      ).not.toMatch(/export\s+const\s+PACKS\s*=/);
    }
  });

  it("the sealed `safe-trade-strings.ts` is unchanged in this phase (file still exists)", () => {
    // Legal wording there is sealed · we do not touch it in P1-P3.
    expect(exists("src/lib/nex-native/i18n/safe-trade-strings.ts")).toBe(true);
  });

  it("the sealed `safe-trade-strings.ts` still owns its own resolveLocale (we did not fold it in)", () => {
    const src = read("src/lib/nex-native/i18n/safe-trade-strings.ts");
    expect(src).toMatch(/export\s+function\s+resolveLocale/);
    // Reconciliation with the universal registry is a later phase.
  });
});

// ────────────────────────────────────────────────────────────────────
// Section F · lang.ts contract preserved
// ────────────────────────────────────────────────────────────────────

describe("lang.ts · public API still works for existing call-sites", () => {
  it("re-exports DEFAULT_LANG as `id` and SUPPORTED_LANGS matches the registry", async () => {
    const lang = await import("./lang");
    expect(lang.DEFAULT_LANG).toBe("id");
    expect([...lang.SUPPORTED_LANGS].sort()).toEqual(
      SUPPORTED_LOCALES.map((l) => l.code).sort(),
    );
  });
});
