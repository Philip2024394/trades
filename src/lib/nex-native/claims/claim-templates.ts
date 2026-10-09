// src/lib/nex-native/claims/claim-templates.ts
//
// NEX · Universal Business Claim · outreach templates.
//
// SEALED CLAIM:
//   Per-channel + per-language templates for the "claim your listing"
//   invitation that NEX sends to a business when it enters OWNER_CLAIMED
//   lifecycle. Templates are pure functions over a strongly-typed
//   TemplateInputs — no interpolation of unverified strings.
//
// CHANNELS:
//   whatsapp · email · sms · phone (phone is a call-script, not a send)
//
// LANGUAGES:
//   id (Bahasa Indonesia · primary) · en (English · fallback)
//
// SCOPE:
//   Pure template string construction. No DB, no network, no send.
//   The actual delivery is the responsibility of the send-adapter
//   (claim-send-service.ts).

import type { ClaimChannel } from "./claim-logic";

// ═════════════════════════════════════════════════════════════════════
// §1 · Public types
// ═════════════════════════════════════════════════════════════════════

export type ClaimLanguage = "id" | "en";

export interface ClaimTemplateInputs {
  readonly business_name: string;
  readonly claim_code: string;              // the 6-digit plaintext code
  readonly claim_url: string;               // deep link to /nex-native/claim/<claim_id>
  readonly public_listing_ref: string;      // the stable business ref
  readonly expires_minutes: number;         // sealed to 10 (CLAIM_CODE_TTL_MS)
  readonly city: string | null;
}

export interface RenderedTemplate {
  readonly channel: ClaimChannel;
  readonly language: ClaimLanguage;
  readonly subject: string | null;          // null for whatsapp/sms/phone
  readonly body_text: string;
  readonly body_html: string | null;        // only for email
}

// ═════════════════════════════════════════════════════════════════════
// §2 · WhatsApp templates (reuses the migration 058 shape)
// ═════════════════════════════════════════════════════════════════════

export function renderWhatsAppClaim(
  inputs: ClaimTemplateInputs,
  language: ClaimLanguage,
): RenderedTemplate {
  const body =
    language === "id"
      ? `Halo ${inputs.business_name},\n\n` +
        `Kami NEX, platform direktori bisnis Indonesia. ` +
        (inputs.city ? `Kami menemukan bisnis Anda di ${inputs.city} ` : "Kami menemukan bisnis Anda ") +
        `dan sudah menampilkannya di direktori NEX.\n\n` +
        `Kode verifikasi untuk klaim bisnis Anda: *${inputs.claim_code}*\n\n` +
        `Kode ini akan kedaluwarsa dalam ${inputs.expires_minutes} menit.\n\n` +
        `Klaim bisnis Anda sekarang: ${inputs.claim_url}\n\n` +
        `Referensi: ${inputs.public_listing_ref}\n\n` +
        `Jika Anda bukan pemilik bisnis ini atau tidak meminta kode ini, ` +
        `abaikan pesan ini. Balas STOP untuk berhenti menerima pesan.\n\n` +
        `Tim NEX`
      : `Hi ${inputs.business_name},\n\n` +
        `This is NEX, Indonesia's business directory platform. ` +
        (inputs.city ? `We found your business in ${inputs.city} ` : "We found your business ") +
        `and have listed it in the NEX directory.\n\n` +
        `Your verification code to claim this listing: *${inputs.claim_code}*\n\n` +
        `This code expires in ${inputs.expires_minutes} minutes.\n\n` +
        `Claim your business now: ${inputs.claim_url}\n\n` +
        `Reference: ${inputs.public_listing_ref}\n\n` +
        `If you are not the business owner or did not request this code, ` +
        `ignore this message. Reply STOP to stop receiving messages.\n\n` +
        `The NEX Team`;

  return {
    channel: "whatsapp",
    language,
    subject: null,
    body_text: body,
    body_html: null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Email templates
// ═════════════════════════════════════════════════════════════════════

export function renderEmailClaim(
  inputs: ClaimTemplateInputs,
  language: ClaimLanguage,
): RenderedTemplate {
  const subject =
    language === "id"
      ? `Klaim bisnis Anda di NEX (${inputs.public_listing_ref})`
      : `Claim your business listing on NEX (${inputs.public_listing_ref})`;

  const bodyText =
    language === "id"
      ? `Halo ${inputs.business_name},\n\n` +
        `Kami NEX, platform direktori bisnis Indonesia. ` +
        (inputs.city ? `Kami telah menampilkan bisnis Anda di ${inputs.city} ` : "Kami telah menampilkan bisnis Anda ") +
        `di direktori NEX secara gratis.\n\n` +
        `Untuk mengelola profil bisnis Anda, verifikasi dengan kode berikut:\n\n` +
        `    ${inputs.claim_code}\n\n` +
        `Kode kedaluwarsa dalam ${inputs.expires_minutes} menit.\n` +
        `Klaim bisnis Anda: ${inputs.claim_url}\n\n` +
        `Referensi listing: ${inputs.public_listing_ref}\n\n` +
        `Dengan klaim, Anda bisa:\n` +
        `  · Mengontrol foto, jam buka, menu, dan info kontak\n` +
        `  · Mendapat notifikasi pesanan dan pertanyaan pelanggan\n` +
        `  · Verifikasi "pemilik asli" untuk kepercayaan pelanggan\n\n` +
        `Jika Anda bukan pemilik bisnis ini, abaikan email ini.\n\n` +
        `Tim NEX`
      : `Hi ${inputs.business_name},\n\n` +
        `This is NEX, Indonesia's business directory platform. ` +
        (inputs.city ? `We have listed your business in ${inputs.city} ` : "We have listed your business ") +
        `on the NEX directory for free.\n\n` +
        `To manage your business profile, verify with the following code:\n\n` +
        `    ${inputs.claim_code}\n\n` +
        `The code expires in ${inputs.expires_minutes} minutes.\n` +
        `Claim your business: ${inputs.claim_url}\n\n` +
        `Listing reference: ${inputs.public_listing_ref}\n\n` +
        `By claiming, you can:\n` +
        `  · Control photos, hours, menu, and contact info\n` +
        `  · Get notified of customer orders and questions\n` +
        `  · Verify as the real owner to build customer trust\n\n` +
        `If you are not the business owner, ignore this email.\n\n` +
        `The NEX Team`;

  // Minimal HTML version · plain-text parity, no styled table (deliverability friendly).
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml =
    `<!doctype html><html><body>` +
    bodyText
      .split("\n")
      .map((line) => {
        if (/^\s{4}\d{6}$/.test(line)) {
          // Highlight the code line.
          return `<p style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:16px 0">${esc(line.trim())}</p>`;
        }
        if (line.trim().length === 0) return "<br>";
        return `<p style="margin:4px 0;line-height:1.5">${esc(line)}</p>`;
      })
      .join("") +
    `</body></html>`;

  return {
    channel: "email",
    language,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §4 · SMS template (short · 160 chars friendly)
// ═════════════════════════════════════════════════════════════════════

export function renderSmsClaim(
  inputs: ClaimTemplateInputs,
  language: ClaimLanguage,
): RenderedTemplate {
  const body =
    language === "id"
      ? `NEX: Kode klaim bisnis ${inputs.business_name}: ${inputs.claim_code}. Kedaluwarsa ${inputs.expires_minutes} mnt. Klaim: ${inputs.claim_url} Ref: ${inputs.public_listing_ref}`
      : `NEX: Business claim code for ${inputs.business_name}: ${inputs.claim_code}. Expires ${inputs.expires_minutes}min. Claim: ${inputs.claim_url} Ref: ${inputs.public_listing_ref}`;

  return {
    channel: "sms",
    language,
    subject: null,
    body_text: body,
    body_html: null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §5 · Phone call-script (for admin agent to read)
// ═════════════════════════════════════════════════════════════════════

export function renderPhoneCallScript(
  inputs: ClaimTemplateInputs,
  language: ClaimLanguage,
): RenderedTemplate {
  const body =
    language === "id"
      ? `[Panggilan ke ${inputs.business_name}]\n\n` +
        `"Selamat pagi/siang, Pak/Bu. Saya dari NEX, direktori bisnis Indonesia.\n\n` +
        (inputs.city ? `Kami melihat bisnis ${inputs.business_name} di ${inputs.city} ` : `Kami melihat bisnis ${inputs.business_name} `) +
        `dan sudah menampilkannya di direktori NEX secara gratis.\n\n` +
        `Untuk mengontrol listing Anda - foto, jam, menu - silakan klaim di: ${inputs.claim_url}\n\n` +
        `Kode verifikasi: ${inputs.claim_code}\n` +
        `Berlaku ${inputs.expires_minutes} menit."\n\n` +
        `[Jika ya: pandu melalui proses klaim.]\n` +
        `[Jika tidak: minta izin follow-up via WhatsApp. Catat preferensi.]`
      : `[Call to ${inputs.business_name}]\n\n` +
        `"Good morning/afternoon. This is NEX, Indonesia's business directory.\n\n` +
        (inputs.city ? `We've listed ${inputs.business_name} in ${inputs.city} ` : `We've listed ${inputs.business_name} `) +
        `on the NEX directory for free.\n\n` +
        `To control your listing - photos, hours, menu - please claim at: ${inputs.claim_url}\n\n` +
        `Verification code: ${inputs.claim_code}\n` +
        `Valid for ${inputs.expires_minutes} minutes."\n\n` +
        `[If yes: guide through the claim flow.]\n` +
        `[If no: ask permission for WhatsApp follow-up. Record preference.]`;

  return {
    channel: "phone",
    language,
    subject: null,
    body_text: body,
    body_html: null,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §6 · Dispatcher
// ═════════════════════════════════════════════════════════════════════

export function renderClaim(
  channel: ClaimChannel,
  inputs: ClaimTemplateInputs,
  language: ClaimLanguage,
): RenderedTemplate {
  switch (channel) {
    case "whatsapp": return renderWhatsAppClaim(inputs, language);
    case "email":    return renderEmailClaim(inputs, language);
    case "sms":      return renderSmsClaim(inputs, language);
    case "phone":    return renderPhoneCallScript(inputs, language);
    default: {
      const _exhaustive: never = channel;
      throw new Error(`renderClaim: unhandled channel ${String(_exhaustive)}`);
    }
  }
}
