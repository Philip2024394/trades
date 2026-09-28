// src/lib/nex-native/i18n/safe-trade-strings.ts
//
// Bridge 16c · Bilingual copy for the safe-trade surfaces.
// --------------------------------------------------------
// The consent modal and the terms page are the load-bearing legal
// surfaces. Users in Indonesia should see Bahasa Indonesia by
// default · we expose both languages via a single strings map so
// callers pick with resolveLocale() and pluck the key they need.
//
// This is a minimal in-source i18n approach · no framework, no
// runtime bundle, no server round-trips. When translation volume
// grows we can lift into a proper i18n library, but for the ~30
// legal strings we ship today it would be over-engineering.
//
// Doctrine: the terms + modal wording is legally load-bearing ·
// changes here should be authorised (or reviewed) by Founder
// Philip before release. Translation done 2026-09-28 · reviewer
// pass by a native speaker queued.

export type NexLocale = "id" | "en";

/** Resolve locale from URL param, then Accept-Language header,
 *  falling back to Indonesian (launch market). Signed-in users
 *  can override via a future account preference (queued). */
export function resolveLocale(input: {
  urlParam?: string | null;
  acceptLanguage?: string | null;
}): NexLocale {
  const p = (input.urlParam ?? "").toLowerCase().trim();
  if (p === "id" || p === "en") return p as NexLocale;
  const al = (input.acceptLanguage ?? "").toLowerCase();
  // Very rough parse · we only care whether English is preferred over
  // Indonesian. If the user's first accepted language starts with
  // "en" we serve English, otherwise Indonesian (Indonesia-first
  // default for the pilot market).
  const first = al.split(",")[0]?.split(";")[0]?.trim() ?? "";
  if (first.startsWith("en")) return "en";
  return "id";
}

/** Safe-trade strings · consumed by consent modal, terms page hero,
 *  and shop-landing chip strip labels. */
export const SAFE_TRADE_STRINGS = {
  id: {
    /* --- consent modal ---------------------------------------------- */
    modal_eyebrow: "🛡 Sebelum kamu mulai",
    modal_title: "Bagaimana NEX menjaga kamu tetap aman.",
    modal_lede:
      "Di NEX, <b>kamu tidak pernah bayar sebelum menerima barang</b> · kecuali pihak ketiga yang kamu percaya (Rekber / Xendit / PayPal) yang memegang uangnya. Lima jalur aman:",
    modal_paths_short: "COD · QRIS saat terima · COD kurir · Ketemuan · Rekber",
    modal_warning_eyebrow: "⚠ Apa artinya untuk kamu",
    modal_warning_body:
      "Kalau kamu kirim uang ke penjual <b>di luar lima jalur ini</b> (misalnya transfer langsung ke rekening pribadi mereka sebelum barang diterima), <b>NEX tidak bisa bantu kamu mengembalikan uang</b>. Itu keputusan kamu · bukan sesuatu yang NEX bisa fasilitasi.",
    modal_read_terms: "Baca ketentuan lengkap:",
    modal_terms_link: "/nex-native/terms",
    modal_safe_trade_link: "Penjelasan Aman Bertransaksi",
    modal_checkbox_label:
      "Saya mengerti · Saya akan gunakan salah satu dari lima jalur pembayaran yang didukung NEX, dan saya menerima bahwa pembayaran di luar jalur tidak dilindungi atau dimediasi oleh dukungan NEX.",
    modal_submit: "🛡 Setuju · masuk chat",
    modal_version_prefix: "Versi",

    /* --- terms page hero -------------------------------------------- */
    terms_eyebrow: "Ketentuan Layanan NEX",
    terms_title: "Aturan sederhana untuk tempat yang adil.",
    terms_lede_prefix: "Versi",
    terms_lede_middle: "· Ditetapkan 2026-09-28 · Dengan menggunakan NEX, kamu setuju dengan hal-hal di bawah.",

    /* --- one-line promise (used at bottom of terms + safe-trade) ---- */
    promise_line1: "Kamu tidak pernah bayar sebelum menerima",
    promise_line2: "kecuali pihak ketiga yang kamu percaya memegang uangnya.",
    promise_eyebrow: "🛡 Janji satu baris",
  },
  en: {
    /* --- consent modal ---------------------------------------------- */
    modal_eyebrow: "🛡 Before you start",
    modal_title: "How NEX keeps you safe.",
    modal_lede:
      "On NEX, <b>you never pay before you receive</b> · unless a third party you trust (Rekber / Xendit / PayPal) is holding the money. Five safe paths:",
    modal_paths_short:
      "COD · QRIS on delivery · Courier COD · Meet in person · Escrow",
    modal_warning_eyebrow: "⚠ What this means for you",
    modal_warning_body:
      "If you send money to a seller <b>outside these five paths</b> (for example, direct bank transfer to their private account before delivery), <b>NEX support cannot help you recover it</b>. That is your choice, not something NEX will mediate.",
    modal_read_terms: "Read the full terms:",
    modal_terms_link: "/nex-native/terms",
    modal_safe_trade_link: "Safe trade explainer",
    modal_checkbox_label:
      "I understand · I will use one of the five NEX-supported payment paths, and I accept that off-path payments are not protected or mediated by NEX support.",
    modal_submit: "🛡 Agree · enter chat",
    modal_version_prefix: "Version",

    /* --- terms page hero -------------------------------------------- */
    terms_eyebrow: "NEX terms of service",
    terms_title: "Plain rules for a fair place.",
    terms_lede_prefix: "Version",
    terms_lede_middle: "· Sealed 2026-09-28 · By using NEX you agree to what's below.",

    /* --- one-line promise ------------------------------------------- */
    promise_line1: "You never pay before you receive",
    promise_line2: "unless a third party you trust is holding the money.",
    promise_eyebrow: "🛡 The one-line promise",
  },
} as const;

export type SafeTradeStrings = (typeof SAFE_TRADE_STRINGS)["id"];
