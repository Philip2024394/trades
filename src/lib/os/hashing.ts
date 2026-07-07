// OS Foundation — Identity hashing primitives.
//
// Every app that needs to hash an email / WhatsApp / IP for anti-abuse
// or dedup binding calls into this module. Historically these helpers
// lived at src/lib/ai-visualiser/hashing.ts (App #001 namespace) and
// were imported by every subsequent app + the OS Party helpers — a
// direction inversion the Constitution forbids. This is the canonical
// home. The AI Visualiser file re-exports these until the next major
// version, then is deleted.
//
// Salt policy: one platform-wide salt (AI_VISUALISER_HASH_SALT — kept
// under its historical env var name to avoid a rotation event). The
// hash algorithm is SHA-256 truncated to first 64 hex chars — cheap,
// collision-resistant for the sizes we operate at, and deterministic
// across processes.
import "server-only";
import { createHash } from "node:crypto";

function platformSalt(): string {
  const s = process.env.AI_VISUALISER_HASH_SALT;
  if (!s || s.length < 16) {
    throw new Error(
      "AI_VISUALISER_HASH_SALT must be set to a random string of at least 16 chars"
    );
  }
  return s;
}

export function hashEmail(email: string): string {
  const normalised = email.trim().toLowerCase();
  return createHash("sha256")
    .update(`${platformSalt()}:email:${normalised}`)
    .digest("hex");
}

export function hashWhatsapp(e164: string): string {
  const normalised = e164.replace(/\D/g, "");
  return createHash("sha256")
    .update(`${platformSalt()}:whatsapp:${normalised}`)
    .digest("hex");
}

// Best-effort E.164 normaliser for UK-heavy traffic. Not intended as a
// full libphonenumber replacement; the raw input is stored alongside so
// callers always see what the customer typed.
export function toE164(input: string, defaultCountry: "GB" = "GB"): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return `+${digits}`;
  if (defaultCountry === "GB") {
    if (digits.startsWith("44")) return `+${digits}`;
    if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  }
  return `+${digits}`;
}

export function normalisePostcode(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

// IP → coarse "class" for cross-merchant abuse detection without
// storing full IPs. /24 for IPv4, /64 for IPv6.
export function ipClass(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":");
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}
