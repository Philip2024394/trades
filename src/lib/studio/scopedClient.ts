// NEX App Builder · scoped Supabase client (Philip 2026-08-14).
//
// This is the merchant-scoped counterpart to `supabaseAdmin`. It signs a
// short-lived ES256 JWT with a `merchant_id` claim and hands it to
// PostgREST via the Authorization header. Supabase validates the JWT via
// the JWKS URL registered under third-party-auth (`/api/auth/nex-jwks`),
// and RLS policies on tenant tables gate on `auth.jwt() ->> 'merchant_id'`.
//
// USE THIS instead of supabaseAdmin for every read/write on a
// merchant-owned table (studio_layouts first; other tables migrate over
// time). supabaseAdmin remains quarantined to legitimate bootstrap paths
// (edit_token → merchant lookup, cross-tenant admin flows, cron jobs).
//
// Security constitution:
//   - Private key NEVER leaves the server process (env only).
//   - JWT is signed per-request with exp=60s.
//   - No fallback to service_role if signing fails — we return an error
//     rather than escalate privilege.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT, importJWK } from "jose";
import type { StudioSession } from "@/lib/studio/session";

// jose v6 removed the KeyLike export; importJWK returns CryptoKey | Uint8Array
type SigningKey = CryptoKey | Uint8Array;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const NEX_JWT_PRIVATE_KEY_JWK = process.env.NEX_JWT_PRIVATE_KEY_JWK;
const NEX_JWT_ISSUER =
  process.env.NEX_JWT_ISSUER ||
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  "https://thenetworkers.app";

if (!SUPABASE_URL) throw new Error("scopedClient: missing NEXT_PUBLIC_SUPABASE_URL");
if (!SUPABASE_ANON_KEY) throw new Error("scopedClient: missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

// Cache the parsed private KeyLike per process (private JWK parsing is not
// free; it's the same key for the lifetime of the deployment).
let cachedPrivateKey: SigningKey | null = null;
let cachedKid: string | null = null;

async function loadPrivateKey(): Promise<{ key: SigningKey; kid: string }> {
  if (cachedPrivateKey && cachedKid) return { key: cachedPrivateKey, kid: cachedKid };
  if (!NEX_JWT_PRIVATE_KEY_JWK) {
    throw new Error(
      "scopedClient: NEX_JWT_PRIVATE_KEY_JWK is not set. Provision the private ES256 JWK in " +
      ".env.local (locally) and Vercel env (production). See scripts/nex-security/generate-keypair.mjs."
    );
  }
  const jwk = JSON.parse(NEX_JWT_PRIVATE_KEY_JWK) as Record<string, unknown>;
  if (!jwk.d) {
    throw new Error("scopedClient: NEX_JWT_PRIVATE_KEY_JWK does not contain a private scalar `d`");
  }
  if (!jwk.kid || typeof jwk.kid !== "string") {
    throw new Error("scopedClient: NEX_JWT_PRIVATE_KEY_JWK is missing required `kid`");
  }
  const key = (await importJWK(jwk as never, "ES256")) as SigningKey;
  cachedPrivateKey = key;
  cachedKid = jwk.kid;
  return { key, kid: jwk.kid };
}

export type ScopedJwtClaims = {
  merchant_id: string;
  role: "authenticated";
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
};

/** Sign a short-lived ES256 JWT with a `merchant_id` claim.
 *  Exposed for testing; production code should use `scopedStudioClient()`. */
export async function signMerchantJwt(
  merchantId: string,
  opts?: { audience?: string; ttlSeconds?: number }
): Promise<string> {
  const { key, kid } = await loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.max(10, Math.min(300, opts?.ttlSeconds ?? 60));
  const audience = opts?.audience ?? "authenticated";
  return await new SignJWT({
    merchant_id: merchantId,
    role: "authenticated"
  })
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
    .setIssuer(NEX_JWT_ISSUER)
    .setSubject(merchantId)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
}

/** Returns a Supabase client scoped to a merchant via a per-request JWT.
 *  All queries run as the `authenticated` role — RLS applies. */
export async function scopedStudioClient(session: StudioSession): Promise<SupabaseClient> {
  const jwt = await signMerchantJwt(session.merchant.id);
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/** For tests / scripts that construct a synthetic session. */
export async function scopedClientForMerchantId(merchantId: string): Promise<SupabaseClient> {
  const jwt = await signMerchantJwt(merchantId);
  return createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
