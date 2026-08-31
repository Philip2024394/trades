// src/lib/nex/i18n/i18n.test.ts
//
// Stage 3.33 · Phase 26 · i18n framework tests (Philip 2026-08-31).
//
// Locks in:
//   · Every I18N_KEY has an entry in every pack (EN + ID)
//   · Neither pack has extra keys the other lacks (drift prevention)
//   · resolveClientLang honours URL > localStorage > default order
//   · writeClientLang persists + resolveClientLang reads it back
//   · Unsupported values in URL/localStorage fall through to default

import { describe, expect, it, beforeEach, vi } from "vitest";
import { I18N_KEYS } from "./keys";
import { EN_PACK } from "./packs/en";
import { ID_PACK } from "./packs/id";
import { DEFAULT_LANG, SUPPORTED_LANGS, resolveClientLang, writeClientLang } from "./lang";

describe("i18n · key registry integrity", () => {
  it("every I18N_KEY has an entry in the EN pack", () => {
    for (const key of I18N_KEYS) {
      expect(EN_PACK[key], `EN pack missing key "${key}"`).toBeDefined();
      expect(typeof EN_PACK[key]).toBe("string");
      expect(EN_PACK[key].length).toBeGreaterThan(0);
    }
  });

  it("every I18N_KEY has an entry in the ID pack", () => {
    for (const key of I18N_KEYS) {
      expect(ID_PACK[key], `ID pack missing key "${key}"`).toBeDefined();
      expect(typeof ID_PACK[key]).toBe("string");
      expect(ID_PACK[key].length).toBeGreaterThan(0);
    }
  });

  it("EN and ID packs have EXACTLY the same key set (no drift)", () => {
    const enKeys = Object.keys(EN_PACK).sort();
    const idKeys = Object.keys(ID_PACK).sort();
    expect(idKeys).toEqual(enKeys);
  });

  it("EN and ID entries for the same key are visibly different (translation actually happened)", () => {
    // Not every entry has to differ (e.g. proper nouns) but the majority
    // should — 90%+ · a fully-identical pack means someone forgot to
    // translate.
    let identical = 0;
    for (const key of I18N_KEYS) {
      if (EN_PACK[key] === ID_PACK[key]) identical++;
    }
    const ratio = identical / I18N_KEYS.length;
    expect(ratio, `${identical}/${I18N_KEYS.length} keys identical · ID pack likely stale`).toBeLessThan(0.1);
  });
});

describe("resolveClientLang · precedence + safety", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Reset a fresh jsdom-like window + localStorage for each test.
    const store: Record<string, string> = {};
    // @ts-expect-error test shim
    globalThis.window = {
      location: { href: "https://nex.local/nex-app" },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
    };
  });

  it("returns DEFAULT_LANG when no URL query + no localStorage entry", () => {
    expect(resolveClientLang()).toBe(DEFAULT_LANG);
  });

  it("prefers URL ?lang= over localStorage", () => {
    // @ts-expect-error test shim
    globalThis.window.location.href = "https://nex.local/nex-app?lang=id";
    // @ts-expect-error test shim
    globalThis.window.localStorage.setItem("nex_user_lang", "en");
    expect(resolveClientLang()).toBe("id");
  });

  it("falls back to localStorage when URL query missing", () => {
    // @ts-expect-error test shim
    globalThis.window.localStorage.setItem("nex_user_lang", "id");
    expect(resolveClientLang()).toBe("id");
  });

  it("ignores unsupported URL ?lang= values and falls through", () => {
    // @ts-expect-error test shim
    globalThis.window.location.href = "https://nex.local/nex-app?lang=xx";
    // @ts-expect-error test shim
    globalThis.window.localStorage.setItem("nex_user_lang", "id");
    // xx is unsupported → skip URL → fall back to localStorage
    expect(resolveClientLang()).toBe("id");
  });

  it("ignores unsupported localStorage values and falls through to default", () => {
    // @ts-expect-error test shim
    globalThis.window.localStorage.setItem("nex_user_lang", "xx");
    expect(resolveClientLang()).toBe(DEFAULT_LANG);
  });

  it("returns DEFAULT_LANG when window is undefined (SSR-safe)", () => {
    // @ts-expect-error test shim
    globalThis.window = undefined;
    expect(resolveClientLang()).toBe(DEFAULT_LANG);
    // Restore for subsequent tests
    globalThis.window = originalWindow;
  });
});

describe("writeClientLang · persistence + safety", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    // @ts-expect-error test shim
    globalThis.window = {
      location: { href: "https://nex.local/nex-app" },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      },
    };
  });

  it("writes lang to localStorage and resolveClientLang reads it back", () => {
    writeClientLang("id");
    expect(resolveClientLang()).toBe("id");
    writeClientLang("en");
    expect(resolveClientLang()).toBe("en");
  });

  it("no-op when window is undefined", () => {
    const w = globalThis.window;
    // @ts-expect-error test shim
    globalThis.window = undefined;
    expect(() => writeClientLang("id")).not.toThrow();
    globalThis.window = w;
  });

  it("silent on localStorage failure (private mode)", () => {
    // @ts-expect-error test shim
    globalThis.window.localStorage.setItem = () => { throw new Error("private mode"); };
    expect(() => writeClientLang("id")).not.toThrow();
  });
});

describe("SUPPORTED_LANGS · sanity", () => {
  it("contains exactly en and id (guards accidental removal)", () => {
    expect(SUPPORTED_LANGS.length).toBe(2);
    expect(SUPPORTED_LANGS).toContain("en");
    expect(SUPPORTED_LANGS).toContain("id");
  });

  it("DEFAULT_LANG is one of SUPPORTED_LANGS", () => {
    expect(SUPPORTED_LANGS).toContain(DEFAULT_LANG);
  });
});
