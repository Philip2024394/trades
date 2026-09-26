// src/app/nex-native/page.tsx
//
// NEX first-entry router · sealed 2026-09-26 (three-doorway follow-up).
//   · signed-in  → /nex-native/home (three-doorway hub)
//   · signed-out → /nex-native/create-account (first-entry surface)
// The sign-in gate lives at /nex-native/sign-in. The Create-your-NEX
// page links back to it for returning users.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  if (session) {
    redirect("/nex-native/home");
  }
  redirect("/nex-native/create-account");
}
