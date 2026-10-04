// src/app/nex-native/calls/page.tsx
//
// NEX Calls · the "Call someone" hub.
// -----------------------------------
// Founder spec 2026-10-04 (reference image: call center.png) + the
// 2026-10-04 call-architecture audit. Builds the page scaffold per
// the sealed design and wires voice/video action cards to the real
// PeerCall engine (Bridge 68) via a `?start_call=voice|video` query
// param on `/nex-native/chat/peer/{peerId}`.
//
// Honest status (per the audit):
//   · Voice / Video cards      · WIRED to the live PeerCall client.
//   · Group call / Call link   · NOT YET — no backing infrastructure.
//                                Rendered as visibly disabled tiles
//                                with "coming later" tooltips so no
//                                dead button masquerades as a feature.
//   · Invite                   · navigates to the existing friends
//                                invite surface.
//   · "People" section         · shows the viewer's accepted friends.
//                                Labelled "People" rather than
//                                "Favourites" because no favourites
//                                table exists yet · a real favourites
//                                feature is a separate decision.
//   · "Recent calls" section   · HONEST empty-state. No call-history
//                                table exists. Filter pills still
//                                render for layout parity with the
//                                reference image but all map to the
//                                same empty state until a call_log
//                                migration ships.
//
// Recording is NOT addressed on this page by design — it is a call-
// active control, not a hub control, and its consent / storage /
// jurisdictional implications are a separate founder decision.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as friendService from "@/lib/nex-native/friend-service";
import * as accountService from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";
import { CallsClient, type CallsPerson } from "./_calls-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CallsPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/calls");
  }

  // Load accepted friends · the only "contacts" the Calls hub exposes
  // today. Fails soft to an empty list so an unexpected service error
  // doesn't nuke the page.
  const friendIds = await friendService
    .listFriends(session.account.id)
    .catch(() => [] as string[]);

  const people: CallsPerson[] = await Promise.all(
    friendIds.map(async (id) => {
      const [acc, profile] = await Promise.all([
        accountService.getAccountById(id).catch(() => null),
        getProfileByAccountId(id).catch(() => null),
      ]);
      return {
        id,
        displayName: acc?.display_name ?? "Unknown",
        handle: acc?.nex_handle ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      };
    }),
  );

  return <CallsClient viewerId={session.account.id} people={people} />;
}
