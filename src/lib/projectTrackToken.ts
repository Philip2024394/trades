// Project tracking token — HMAC-signed magic link.
//
// When a homeowner submits a brief we email them a link back to
// /project/track?token=… that grants read-only access to the project
// state + replies for 60 days. No account required.
//
// Same shape as inboxToken but different scope (projectId).

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 days

function secret(): string {
  const s =
    process.env.PROJECT_TRACK_SECRET ||
    process.env.INBOX_TOKEN_SECRET ||
    process.env.ADMIN_COOKIE_SECRET ||
    "";
  if (s.length < 24) {
    throw new Error(
      "projectTrackToken: secret missing or too short — set PROJECT_TRACK_SECRET or ADMIN_COOKIE_SECRET."
    );
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function signProjectTrackToken(projectId: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${projectId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export type ProjectTrackTokenPayload = {
  projectId: string;
  issuedAt: number;
};

export function verifyProjectTrackToken(
  token: string
): ProjectTrackTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [projectId, issuedAtStr, providedSig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!projectId || !Number.isFinite(issuedAt) || !providedSig) return null;
  const payload = `${projectId}.${issuedAtStr}`;
  const expectedSig = sign(payload);
  if (!safeEqual(providedSig, expectedSig)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > TOKEN_TTL_SECONDS) return null;
  return { projectId, issuedAt };
}
