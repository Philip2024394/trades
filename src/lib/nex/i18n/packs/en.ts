// src/lib/nex/i18n/packs/en.ts
//
// Stage 3.33 · Phase 26 · English string pack. Every key from
// I18N_KEYS must have an entry here or the file fails to typecheck.

import type { I18nKey } from "../keys";

export const EN_PACK: Record<I18nKey, string> = {
  // Common
  "common.back":     "Back",
  "common.close":    "Close",
  "common.continue": "Continue",
  "common.cancel":   "Cancel",
  "common.save":     "Save",
  "common.loading":  "Loading…",
  "common.error":    "Something went wrong",
  "common.more":     "More",

  // Nav
  "nav.home":     "Home",
  "nav.messages": "Messages",
  "nav.discover": "Discover",
  "nav.profile":  "Profile",

  // Messenger
  "messenger.title":             "Messages",
  "messenger.subtitle":          "Free forever · no AI needed",
  "messenger.searchPlaceholder": "Search chats",
  "messenger.emptyStateTitle":   "Messenger is coming soon.",
  "messenger.emptyStateBody":    "The free chat layer is the next major piece we're building. Person-to-person, group chats, images, files — no AI needed to use any of it. This surface will light up when the messaging backend lands.",
  "messenger.newChat":           "Start new chat",
  "messenger.previewTitle":      "Preview · cross-language chat",
  "messenger.previewSubtitle":   "When you chat with someone in another language, each side sees the message in their own language. Tap the icon on a bubble to see the original.",
  "messenger.translated":        "Translated",
  "messenger.original":          "Original",
  "messenger.showOriginal":      "Show original text",
  "messenger.showTranslated":    "Show translated text",

  // Sign-on
  "signon.welcome":     "Welcome",
  "signon.continueBtn": "Continue",
  "signon.guestBtn":    "Continue as guest",
};
