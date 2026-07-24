// Brain Admin session — parallel to the Author session pattern.
// Deliberately isolated:
//   • Separate env allowlist (NEX_BRAIN_ADMIN_ALLOWLIST)
//   • Separate cookie name (tn_brain_admin_sid)
//   • Separate invite + cookie secrets
//   • Different persona: platform reviewer, not content author
//
// A person could in principle hold both an Author and a Brain Admin
// session (they are keyed by separate cookies) — but the runtime
// only ever reads one at a time, so there's no cross-role escalation.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const BRAIN_ADMIN_COOKIE_NAME = "tn_brain_admin_sid";
const COOKIE_MAX_AGE_SECONDS         = 60 * 60 * 24 * 30;   // 30 days
const INVITE_SECRET_ENV              = "NEX_BRAIN_ADMIN_INVITE_SECRET";
const COOKIE_SECRET_ENV              = "NEX_BRAIN_ADMIN_COOKIE_SECRET";

function requireSecret(name: string): string {
  const v = process.env[name];
  if (!v || v.length < 32) throw new Error(`Missing or too-short env var ${name} (need ≥32 chars)`);
  return v;
}
function normalise(id: string): string { return id.trim().toLowerCase(); }

export function allowedBrainAdminIds(): string[] {
  const raw = process.env.NEX_BRAIN_ADMIN_ALLOWLIST ?? "";
  return raw.split(",").map(normalise).filter((s) => s.length > 0);
}

export function isAllowedBrainAdminId(id: string): boolean {
  return allowedBrainAdminIds().includes(normalise(id));
}

// ─── Invite token ───────────────────────────────────────────────

export function issueBrainAdminInviteToken(adminId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const id = normalise(adminId);
  if (!isAllowedBrainAdminId(id)) throw new Error(`Brain admin '${id}' not on allowlist`);
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const salt = Math.random().toString(36).slice(2, 14);
  const payload = `${id}|${expires}|${salt}`;
  const sig = createHmac("sha256", requireSecret(INVITE_SECRET_ENV)).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyBrainAdminInviteToken(raw: string): { ok: true; adminId: string } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "missing_token" };
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return { ok: false, reason: "malformed_token" };
  const payload = raw.slice(0, dot);
  const sig     = raw.slice(dot + 1);
  const expected = createHmac("sha256", requireSecret(INVITE_SECRET_ENV)).update(payload).digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return { ok: false, reason: "bad_signature" };
  const parts = payload.split("|");
  if (parts.length !== 3) return { ok: false, reason: "malformed_payload" };
  const [id, expiresRaw] = parts;
  const expires = parseInt(expiresRaw, 10);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return { ok: false, reason: "expired" };
  if (!isAllowedBrainAdminId(id)) return { ok: false, reason: "not_on_allowlist" };
  return { ok: true, adminId: normalise(id) };
}

// ─── Session cookie ─────────────────────────────────────────────

function signAdminId(id: string): string {
  return createHmac("sha256", requireSecret(COOKIE_SECRET_ENV)).update(id).digest("hex");
}

export function brainAdminCookieValue(adminId: string): string {
  const id = normalise(adminId);
  if (!isAllowedBrainAdminId(id)) throw new Error(`Brain admin '${id}' not on allowlist`);
  return `${id}.${signAdminId(id)}`;
}

export function verifyBrainAdminCookie(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const id  = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!isAllowedBrainAdminId(id)) return null;
  const expected = signAdminId(id);
  const sigBuf = Buffer.from(sig, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  return id;
}

export async function setBrainAdminSessionCookie(adminId: string): Promise<void> {
  const c = await cookies();
  c.set(BRAIN_ADMIN_COOKIE_NAME, brainAdminCookieValue(adminId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS
  });
}

export async function clearBrainAdminSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(BRAIN_ADMIN_COOKIE_NAME);
}

export async function getBrainAdminFromCookie(): Promise<string | null> {
  const c = await cookies();
  const raw = c.get(BRAIN_ADMIN_COOKIE_NAME)?.value;
  return verifyBrainAdminCookie(raw);
}
