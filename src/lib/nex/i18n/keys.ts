// src/lib/nex/i18n/keys.ts
//
// Stage 3.33 · Phase 26 · Typed key registry (Philip 2026-08-31).
//
// Every user-facing string in the app chrome (buttons, nav, section
// headers, empty-state copy) MUST have a key here. The `useT` hook
// only accepts keys from this union so a missing translation is a
// compile-time error, not a silent English fallback.
//
// Naming convention: `namespace.subject.form`
//   nav.messages           → nav item label
//   messenger.title        → messenger screen heading
//   messenger.emptyState   → empty-state hero copy
//   common.back            → generic "back" affordance
//
// Growing the registry: add a key here + add an entry to both packs
// in ./packs/en.ts and ./packs/id.ts. TypeScript will refuse to compile
// if either pack is missing a key.

export const I18N_KEYS = [
  // ─── Common ─────────────────────────────────────────────────
  "common.back",
  "common.close",
  "common.continue",
  "common.cancel",
  "common.save",
  "common.loading",
  "common.error",
  "common.more",

  // ─── Nav ────────────────────────────────────────────────────
  "nav.home",
  "nav.messages",
  "nav.discover",
  "nav.profile",

  // ─── Messenger ──────────────────────────────────────────────
  "messenger.title",
  "messenger.subtitle",
  "messenger.searchPlaceholder",
  "messenger.emptyStateTitle",
  "messenger.emptyStateBody",
  "messenger.newChat",
  "messenger.previewTitle",
  "messenger.previewSubtitle",
  "messenger.translated",
  "messenger.original",
  "messenger.showOriginal",
  "messenger.showTranslated",

  // ─── Sign-on (mirrors the per-screen pack in nex-sign-on/page.tsx
  //     so future screens outside sign-on that reuse these keys stay
  //     consistent) ────────────────────────────────────────────
  "signon.welcome",
  "signon.continueBtn",
  "signon.guestBtn",

  // ─── Settings · Language picker (Phase B.7 P1-P3 dogfood) ───
  //     Minimal set required to migrate /nex-native/settings/
  //     language/page.tsx off its hard-coded COPY map so the pipe
  //     is proven end-to-end. Zero speculative keys here · every
  //     entry below has an actual call-site in the migrated page.
  "settings.language.eyebrow",
  "settings.language.title",
  "settings.language.lede",
  "settings.language.save",
  "settings.language.id_label",
  "settings.language.id_blurb",
  "settings.language.en_label",
  "settings.language.en_blurb",
] as const;

export type I18nKey = (typeof I18N_KEYS)[number];
