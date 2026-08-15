// NEX App Builder · JWKS public endpoint (Philip 2026-08-14).
//
// Route: /api/auth/nex-jwks
//
// Serves the PUBLIC half of the ES256 keypair used to sign NEX's own
// tenant-scoped JWTs. Supabase's PostgREST is registered against this
// URL as a Third-Party JWT Issuer, and validates NEX-signed JWTs by
// fetching this document. RLS policies then read `auth.jwt() ->> 'merchant_id'`.
//
// Security:
//   - Public by design (no auth required — this is the public half).
//   - Never contains the private JWK ("d" field is stripped defensively).
//   - Never rotates on request; rotation is a deliberate keypair-swap.
//
// The corresponding PRIVATE JWK lives in NEX_JWT_PRIVATE_KEY_JWK (env only,
// never committed) and is loaded by `src/lib/studio/scopedClient.ts`.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Modest cache — Supabase's PostgREST caches JWKS but we don't want a
// long stale window when we rotate the keypair. 5 minutes is a reasonable
// compromise between fetch load and rotation freshness.
export const revalidate = 300;

type Jwk = Record<string, unknown> & { kty?: string; kid?: string; alg?: string; use?: string };

function loadPublicJwk(): Jwk {
  const raw = process.env.NEX_JWT_PUBLIC_KEY_JWK;
  if (!raw) {
    throw new Error(
      "NEX_JWT_PUBLIC_KEY_JWK is not set. Provision via `scripts/nex-security/generate-keypair.mjs` " +
      "or manually add public JWK to .env.local (and Vercel env)."
    );
  }
  const parsed = JSON.parse(raw) as Jwk;
  // Defensive strip — a public JWK must never contain private material.
  // Even if someone accidentally stored the private JWK in the PUBLIC var,
  // this endpoint refuses to emit the private components.
  delete (parsed as Record<string, unknown>).d;   // EC/RSA private scalar
  delete (parsed as Record<string, unknown>).p;   // RSA primes
  delete (parsed as Record<string, unknown>).q;
  delete (parsed as Record<string, unknown>).dp;
  delete (parsed as Record<string, unknown>).dq;
  delete (parsed as Record<string, unknown>).qi;
  delete (parsed as Record<string, unknown>).oth;
  // Ensure required signing metadata exists
  if (!parsed.use) parsed.use = "sig";
  if (!parsed.alg) parsed.alg = "ES256";
  if (!parsed.kty) throw new Error("NEX_JWT_PUBLIC_KEY_JWK is missing required `kty`");
  if (!parsed.kid) throw new Error("NEX_JWT_PUBLIC_KEY_JWK is missing required `kid` (needed for key selection)");
  return parsed;
}

export async function GET() {
  try {
    const publicJwk = loadPublicJwk();
    const body = { keys: [publicJwk] };
    return new NextResponse(JSON.stringify(body), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300, s-maxage=300",
        // Third-party validators MUST be able to fetch this from any origin
        "access-control-allow-origin": "*"
      }
    });
  } catch (err) {
    // Never leak env-var contents into the response body
    return NextResponse.json(
      { error: "jwks_unavailable", message: (err as Error).message },
      { status: 500 }
    );
  }
}
