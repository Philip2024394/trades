// src/app/api/nex-native/auth/webauthn/assert-start/route.ts
//
// Begin a WebAuthn sign-in ceremony. Accepts an optional email hint that
// scopes the allowed credentials to that account's registered ones. If no
// email is provided, we return an "empty allowList" options object so the
// browser lets the user pick from any resident credential on the device.

import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { resolveWebauthnConfig } from "@/lib/nex-native/webauthn-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body { email?: string }

export async function POST(req: Request) {
  const cfg = resolveWebauthnConfig(req);
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* body optional */ }

  let allowCredentials: { id: string; transports?: ("usb" | "nfc" | "ble" | "internal" | "hybrid")[] }[] | undefined;

  if (body.email && typeof body.email === "string" && body.email.includes("@")) {
    // Resolve email → auth user → nex_account → list credentials.
    const list = await nexSupabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = list.data?.users.find((u) => u.email?.toLowerCase() === body.email!.toLowerCase());
    if (found) {
      const acc = await nexSupabaseAdmin
        .from("nex_account")
        .select("id")
        .eq("supabase_user_id", found.id)
        .maybeSingle();
      if (acc.data) {
        const creds = await listCredentialsForAccount((acc.data as { id: string }).id);
        if (creds.length > 0) {
          allowCredentials = creds.map((c) => ({
            id: c.credential_id,
            transports: (c.transports ?? undefined) as
              | ("usb" | "nfc" | "ble" | "internal" | "hybrid")[]
              | undefined,
          }));
        }
      }
    }
    // If no credentials were resolved we still return options with an
    // empty allowList · browsers with resident-key credentials will
    // discover them on their own; otherwise the user sees "no passkey
    // available" which is honest.
  }

  const options = await generateAuthenticationOptions({
    rpID: cfg.rpID,
    allowCredentials,
    userVerification: "required",
    timeout: 60_000,
  });

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set({
    name: "nex-webauthn-assert-challenge",
    value: options.challenge,
    httpOnly: true,
    sameSite: "strict",
    path: "/api/nex-native/auth/webauthn",
    maxAge: 300,
    secure: cfg.origin.startsWith("https://"),
  });
  return res;
}
