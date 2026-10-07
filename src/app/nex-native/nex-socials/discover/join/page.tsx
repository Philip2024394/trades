// src/app/nex-native/nex-socials/discover/join/page.tsx
//
// NEX Socials · Discover join (signup pool) · founder-sealed 2026-10-07.
// Moved from /nex-app/discover/join during the /nex-app route-tree
// retirement. The underlying JoinDiscoverShell component is unchanged.
//
// Simple form for a new user to be added to the discovery pool:
// Name · Country · Age · Occupation · Looking for.
// Deliberately NO interests field (spec: user removed it).

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { JoinDiscoverShell } from "@/components/nex-app/discover/JoinDiscoverShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function NexSocialsDiscoverJoinPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/nex-socials/discover/join");
  }
  return <JoinDiscoverShell />;
}
