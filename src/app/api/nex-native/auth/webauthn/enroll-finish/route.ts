// src/app/api/nex-native/auth/webauthn/enroll-finish/route.ts
//
// Verify a WebAuthn registration attestation returned by the browser and
// persist the resulting credential to nex_webauthn_credential.

import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { resolveWebauthnConfig } from "@/lib/nex-native/webauthn-config";
import { saveCredential } from "@/lib/nex-native/webauthn-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const cfg = resolveWebauthnConfig(req);

  const jar = await cookies();
  const challenge = jar.get("nex-webauthn-enroll-challenge")?.value;
  if (!challenge) {
    return NextResponse.json(
      { error: "missing_challenge", detail: "enroll-start was not called or cookie expired" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const response = body.response as RegistrationResponseJSON | undefined;
  const deviceLabelRaw = typeof body.deviceLabel === "string" ? body.deviceLabel.trim() : "";
  const deviceLabel = deviceLabelRaw.length > 0 && deviceLabelRaw.length <= 80 ? deviceLabelRaw : null;
  if (!response) {
    return NextResponse.json({ error: "missing_response" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: cfg.origin,
      expectedRPID: cfg.rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "verification_failed", detail: (e as Error).message },
      { status: 400 },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "not_verified" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  try {
    await saveCredential({
      account_id: session.account.id,
      credential_id: credential.id,
      credential_public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? null,
      device_label: deviceLabel,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "save_failed", detail: (e as Error).message },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true });
  // Clear the challenge cookie now that enrolment succeeded.
  res.cookies.set({
    name: "nex-webauthn-enroll-challenge",
    value: "",
    httpOnly: true,
    sameSite: "strict",
    path: "/api/nex-native/auth/webauthn",
    maxAge: 0,
    secure: cfg.origin.startsWith("https://"),
  });
  // Mark this device as having a face credential so /nex-native/sign-in
  // can render the "SIGN IN WITH FACE" button only on devices where the
  // ceremony has a realistic chance of succeeding. The cookie carries no
  // identity; it's a boolean hint scoped to the device (Apple/Google's
  // Face ID appears on the enrolled device only, same pattern).
  res.cookies.set({
    name: "nex-has-face",
    value: "1",
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: cfg.origin.startsWith("https://"),
  });
  return res;
}
