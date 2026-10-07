// src/app/nex-native/nex-socials/discover/[intent]/page.tsx
//
// NEX Socials · per-intent discover · founder-sealed 2026-10-07.
//
// Dynamic server route that validates the URL [intent] segment against
// the sealed four-value catalog (business / new_friends / dating /
// nightlife) and renders a lens wrapper over the shared DiscoverShell.
// Unknown intents redirect to the chooser landing so the URL space
// cannot leak into dead ends.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { parseIntentToken } from "../../_intent-catalog";
import { NexSocialsLensShell } from "./_lens-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ intent: string }>;
}

export default async function NexSocialsIntentPage({ params }: PageProps) {
  const { intent: raw } = await params;
  const intent = parseIntentToken(raw);
  if (!intent) {
    redirect("/nex-native/nex-socials");
  }

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(
      `/nex-native/sign-in?next=/nex-native/nex-socials/discover/${intent}`,
    );
  }

  return <NexSocialsLensShell intent={intent} />;
}
