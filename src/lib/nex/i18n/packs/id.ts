// src/lib/nex/i18n/packs/id.ts
//
// Stage 3.33 · Phase 26 · Bahasa Indonesia string pack. Every key from
// I18N_KEYS must have an entry here or the file fails to typecheck.

import type { I18nKey } from "../keys";

export const ID_PACK: Record<I18nKey, string> = {
  // Common
  "common.back":     "Kembali",
  "common.close":    "Tutup",
  "common.continue": "Lanjutkan",
  "common.cancel":   "Batal",
  "common.save":     "Simpan",
  "common.loading":  "Memuat…",
  "common.error":    "Terjadi kesalahan",
  "common.more":     "Lainnya",

  // Nav
  "nav.home":     "Beranda",
  "nav.messages": "Pesan",
  "nav.discover": "Jelajahi",
  "nav.profile":  "Profil",

  // Messenger
  "messenger.title":             "Pesan",
  "messenger.subtitle":          "Gratis selamanya · tanpa perlu AI",
  "messenger.searchPlaceholder": "Cari obrolan",
  "messenger.emptyStateTitle":   "Messenger akan segera hadir.",
  "messenger.emptyStateBody":    "Lapisan obrolan gratis adalah bagian besar berikutnya yang sedang kami bangun. Chat pribadi, grup, gambar, file — tanpa perlu AI untuk menggunakannya. Permukaan ini akan aktif saat backend pesan siap.",
  "messenger.newChat":           "Mulai obrolan baru",
  "messenger.previewTitle":      "Pratinjau · obrolan lintas bahasa",
  "messenger.previewSubtitle":   "Saat kamu mengobrol dengan orang berbahasa lain, masing-masing pihak melihat pesan dalam bahasa sendiri. Ketuk ikon di gelembung untuk melihat teks asli.",
  "messenger.translated":        "Diterjemahkan",
  "messenger.original":          "Asli",
  "messenger.showOriginal":      "Tampilkan teks asli",
  "messenger.showTranslated":    "Tampilkan teks terjemahan",

  // Sign-on
  "signon.welcome":     "Selamat datang",
  "signon.continueBtn": "Lanjutkan",
  "signon.guestBtn":    "Lanjutkan sebagai tamu",
};
