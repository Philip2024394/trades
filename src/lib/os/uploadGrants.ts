// Signed upload grants — one-time HMAC tokens that authorise a
// homeowner to upload a file into a specific (merchant, homeowner)
// scope for a short window (5 minutes).
//
// Historically the AI Visualiser upload route trusted client-supplied
// merchantId + homeownerId in the form body — anyone could pump files
// into any merchant's storage prefix. The register + render routes now
// issue a grant along with the homeowner id, and the upload route
// verifies the grant instead of trusting the body.
//
// Grants are stateless: HMAC signature carries all context. No DB row.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const GRANT_TTL_SECONDS = 300; // 5 minutes

function secret(): string {
  const s =
    process.env.OS_UPLOAD_GRANT_SECRET ||
    process.env.HOMEOWNER_COOKIE_SECRET;
  if (!s || s.length < 24) {
    throw new Error(
      "OS_UPLOAD_GRANT_SECRET (or HOMEOWNER_COOKIE_SECRET fallback) must be at least 24 chars"
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

export type IssueUploadGrantInput = {
  merchantId: string;
  homeownerId: string;
  category: "ai-visualiser";
};

export function issueUploadGrant(input: IssueUploadGrantInput): string {
  const expiresAt = Math.floor(Date.now() / 1000) + GRANT_TTL_SECONDS;
  const payload = `${input.category}.${input.merchantId}.${input.homeownerId}.${expiresAt}`;
  const sig = sign(`ug:${payload}`);
  return `${payload}.${sig}`;
}

export type VerifiedGrant = {
  merchantId: string;
  homeownerId: string;
  category: "ai-visualiser";
};

export function verifyUploadGrant(
  token: string
): { ok: true; grant: VerifiedGrant } | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 5) return { ok: false, error: "invalid" };
  const [category, merchantId, homeownerId, expiresAtStr, sig] = parts;
  if (!category || !merchantId || !homeownerId || !expiresAtStr || !sig) {
    return { ok: false, error: "invalid" };
  }
  if (category !== "ai-visualiser") {
    return { ok: false, error: "invalid-category" };
  }
  const payload = `${category}.${merchantId}.${homeownerId}.${expiresAtStr}`;
  if (!safeEqual(sig, sign(`ug:${payload}`))) {
    return { ok: false, error: "bad-signature" };
  }
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt)) return { ok: false, error: "invalid" };
  if (Math.floor(Date.now() / 1000) > expiresAt) {
    return { ok: false, error: "expired" };
  }
  return {
    ok: true,
    grant: {
      merchantId,
      homeownerId,
      category: "ai-visualiser"
    }
  };
}
