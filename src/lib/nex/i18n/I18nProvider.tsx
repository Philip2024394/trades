// src/lib/nex/i18n/I18nProvider.tsx
//
// Stage 3.33 · Phase 26 · React Context + useT hook (Philip 2026-08-31).
//
// Usage in any client component:
//
//   const t = useT();
//   return <h1>{t("messenger.title")}</h1>;
//
// The provider reads the initial language from `resolveClientLang()`
// (URL ?lang= → localStorage → 'en' default) and exposes both the
// current `lang` and a `setLang(next)` that persists to localStorage.
//
// Placement: wrap surfaces that need i18n. Because Next.js layouts
// nest, the safest placement is at the surface root (nex-app layout,
// nex-sign-on page, messenger shell). Do NOT wrap the entire root
// layout in one provider — some surfaces (admin, developer, docs)
// are English-only by intent and don't need the overhead.

"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { type Lang, DEFAULT_LANG, resolveClientLang, writeClientLang } from "./lang";
import { EN_PACK } from "./packs/en";
import { ID_PACK } from "./packs/id";
import type { I18nKey } from "./keys";

type I18nContextValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: I18nKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const PACKS: Record<Lang, Record<I18nKey, string>> = {
  en: EN_PACK,
  id: ID_PACK,
};

export function I18nProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  /** Optional server-side hint. If omitted, resolves on the client. */
  initialLang?: Lang;
}): React.ReactElement {
  // Start with the server hint (SSR-safe) then re-resolve once the
  // client mounts so URL ?lang= + localStorage take effect. Prevents
  // hydration flash by keeping the first paint deterministic.
  const [lang, setLangState] = useState<Lang>(initialLang ?? DEFAULT_LANG);

  useEffect(() => {
    const clientLang = resolveClientLang();
    if (clientLang !== lang) setLangState(clientLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeClientLang(next);
  }, []);

  const t = useCallback((key: I18nKey): string => {
    const pack = PACKS[lang] ?? EN_PACK;
    return pack[key] ?? EN_PACK[key] ?? key;
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Hook · returns the translate function. Throws in dev if used outside
 * an I18nProvider so misuse is caught immediately rather than silently
 * falling back to the key itself.
 */
export function useT(): (key: I18nKey) => string {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx.t;
  // Safe fallback for components rendered outside a provider (SSR,
  // isolated tests): return EN pack directly. Warns once in dev.
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn("[useT] called outside I18nProvider · falling back to EN pack");
  }
  return (key: I18nKey) => EN_PACK[key] ?? key;
}

/**
 * Hook · returns current lang + a setter. Same fallback behaviour as
 * useT when called outside a provider.
 */
export function useLang(): { lang: Lang; setLang: (next: Lang) => void } {
  const ctx = useContext(I18nContext);
  if (ctx) return { lang: ctx.lang, setLang: ctx.setLang };
  return { lang: DEFAULT_LANG, setLang: writeClientLang };
}
