// Admin WhatsApp number for Xrated lead notifications, upgrade requests
// and verified-waitlist confirmations. Reads ADMIN_WHATSAPP from env so
// production swaps between Hammerex / Xrated numbers cleanly.

export function adminWhatsapp(): string {
  return process.env.ADMIN_WHATSAPP ?? process.env.NEXT_PUBLIC_HAMMEREX_WHATSAPP ?? "+6281392000050";
}
