// POST /api/homeowner/signup — create homeowner account + session cookie.

import { NextResponse } from "next/server";
import { signupHomeowner } from "@/lib/homeowners/auth";
import { track } from "@/lib/analytics/track";
import { notify } from "@/lib/notifications/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    email?: string; password?: string; firstName?: string;
    postcode?: string; city?: string; whatsappNumber?: string;
    houseNickname?: string;
  } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });

  const res = await signupHomeowner({
    email:          (body.email || "").trim(),
    password:       body.password || "",
    firstName:      (body.firstName || "").trim(),
    postcode:       body.postcode || undefined,
    city:           body.city || undefined,
    whatsappNumber: body.whatsappNumber || undefined,
    houseNickname:  body.houseNickname || undefined
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  // Notification Engine · welcome email + in-app notification
  void notify({
    to: {
      kind:    "homeowner",
      id:      res.homeowner.id,
      email:   res.homeowner.email,
      display: res.homeowner.first_name || "Homeowner"
    },
    template: "homeowner.welcome",
    data:     { firstName: res.homeowner.first_name || "there" },
    channels: ["email", "in_app"],
    product:  "auth",
    relatedTargetKind: "homeowner",
    relatedTargetId:   res.homeowner.id
  });

  // Analytics · signup event (feeds Growth Engine acquisition funnel)
  void track({
    slug:         "homeowner.signup",
    product:      "auth",
    actorKind:    "homeowner",
    actorId:      res.homeowner.id,
    actorDisplay: res.homeowner.first_name || "Homeowner",
    city:         (body.city || body.postcode || null) as string | null,
    // acquisitionChannel populated by future middleware that reads
    // the ?mref / ?ref / utm_ params from the landing URL cookie.
    metadata:     { has_nickname: !!body.houseNickname, has_whatsapp: !!body.whatsappNumber }
  });

  return NextResponse.json({ ok: true, homeownerId: res.homeowner.id });
}
