// src/app/api/nex-native/auth/webauthn/enroll-start/route.ts
//
// Begin a WebAuthn platform-authenticator enrollment for the signed-in
// account. Generates challenge + options for navigator.credentials.create().
// Challenge is echoed back to the client and simultaneously written into a
// short-lived HttpOnly cookie so the enroll-finish handler can bind the
// same ceremony.

import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { resolveWebauthnConfig } from "@/lib/nex-native/webauthn-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const cfg = resolveWebauthnConfig(req);

  const existing = await listCredentialsForAccount(session.account.id);
  const excludeCredentials = existing.map((c) => ({
    id: c.credential_id,
    transports: (c.transports ?? undefined) as
      | ("usb" | "nfc" | "ble" | "internal" | "hybrid")[]
      | undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName: cfg.rpName,
    rpID: cfg.rpID,
    userName:
      session.account.display_name ||
      session.account.nex_handle ||
      session.account.id,
    userID: new TextEncoder().encode(session.account.id),
    userDisplayName:
      session.account.display_name || session.account.nex_handle || "NEX user",
    attestationType: "none",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    excludeCredentials,
    timeout: 60_000,
  });

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set({
    name: "nex-webauthn-enroll-challenge",
    value: options.challenge,
    httpOnly: true,
    sameSite: "strict",
    path: "/api/nex-native/auth/webauthn",
    maxAge: 300,
    secure: cfg.origin.startsWith("https://"),
  });
  return res;
}
