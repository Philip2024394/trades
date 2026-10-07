// src/app/nex-native/nex-socials/discover/page.tsx
//
// NEX Socials · Discover (floating profiles) · founder-sealed 2026-10-07.
// Moved from /nex-app/discover during the /nex-app route-tree retirement.
// The underlying DiscoverShell component (and its physics canvas + mock
// profile layer) is unchanged · only the route location moved.
//
// NEX acts as the introduction layer; messaging only begins after the
// invitation is accepted.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { DiscoverShell } from "@/components/nex-app/discover/DiscoverShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NexSocialsDiscoverPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/nex-socials/discover");
  }
  return <DiscoverShell />;
}
