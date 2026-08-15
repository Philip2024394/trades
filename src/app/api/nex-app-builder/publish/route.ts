// NEX App Builder · POST /api/nex-app-builder/publish (Philip 2026-08-14 · Phase 18).
//
// Publishes a completed Blueprint · registers the business · creates an
// owner account for the caller (or reuses an existing one) · mints a
// SCOPED owner session cookie · returns { slug, redirectTo }.
//
// This is the "click Publish" endpoint that turns an App Builder chat
// into a live NEX-powered business branch. After the response, the client
// deep-links to `/b/{slug}/workspace` and the scoped cookie is presented
// on that request so the owner arrives already authenticated.
//
// Constitutional locks:
//   - The publish path MUST NOT downgrade any prior mutation governance
//   - Cookie is HttpOnly + signed HMAC-SHA256 (existing session-signer)
//   - Cookie is SCOPED · `nex_owner_<slug>` · doesn't collide with any
//     existing customer session the same browser holds

import { NextResponse } from "next/server";
import type { AppBlueprint } from "@/lib/app-builder/blueprint-schema";
import { registerBusiness, getBusiness } from "@/lib/nex/business-context";
import { registerOwner } from "@/lib/nex/auth/accounts";
import { signSession, serializeSessionCookie } from "@/lib/nex/auth/session-signer";
import { ownerCookieName } from "@/lib/nex/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublishBody = {
  blueprint: AppBlueprint;
  /** Owner email · either provided by the App Builder chat or defaulted. */
  ownerEmail?: string;
};

export async function POST(req: Request): Promise<Response> {
  let body: PublishBody;
  try { body = await req.json() as PublishBody; }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  if (!body.blueprint || typeof body.blueprint !== "object") {
    return NextResponse.json({ ok: false, error: "missing-blueprint" }, { status: 400 });
  }
  const slug = String((body.blueprint as { slug?: string; id?: string }).slug ?? (body.blueprint as { id?: string }).id ?? "").trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "blueprint must have a valid slug/id (lowercase-hyphen)" }, { status: 400 });
  }

  // Reject clashes with a seeded/pre-existing business unless caller is the
  // recorded owner · Phase 18 pubish doesn't yet do ownership handover.
  const existing = getBusiness(slug);
  if (existing) {
    return NextResponse.json({
      ok: false,
      error: `slug "${slug}" already exists · pick a different slug or claim the existing business`,
      resolution: "Choose a unique slug in the Blueprint identity block."
    }, { status: 409 });
  }

  // Register the business in the in-memory registry (real DB is deferred).
  registerBusiness(slug, body.blueprint);

  // Create or reuse an owner account. In Phase 18 we accept a supplied
  // email · Phase 19 will bind this to a verified email flow.
  const email = (body.ownerEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.ownerEmail))
    ? body.ownerEmail.trim().toLowerCase()
    : `owner+${slug}@nex.local`;
  const owner = registerOwner(email, [slug]);

  // Mint the SCOPED owner session cookie (Phase 18 · dual-session support).
  const cookieValue = signSession({
    role: "owner",
    businessSlug: slug,
    ownerAccountId: owner.ownerAccountId,
    email: owner.email
  });
  const cookieHeader = serializeSessionCookie(ownerCookieName(slug), cookieValue);

  return new NextResponse(JSON.stringify({
    ok: true,
    slug,
    redirectTo: `/b/${slug}/workspace`,
    ownerAccountId: owner.ownerAccountId,
    say: `Published. Taking you to your NEX workspace for "${slug}"…`
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": cookieHeader
    }
  });
}
