"use server";

// Server action: list the viewer's friends with profile hydration so
// the AddToCallModal can render landscape contact cards. Excludes the
// current peer (already on the call) and the viewer themselves.

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as friendService from "@/lib/nex-native/friend-service";
import { getAccountById } from "@/lib/nex-native/account-service";
import { getProfileByAccountId } from "@/lib/nex-native/account-profile-service";

export interface AddPickContact {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  profession: string | null;
  headline: string | null;
  locationLabel: string | null;
  handle: string | null;
}

export async function listContactsForAddAction(
  excludeAccountId: string,
): Promise<AddPickContact[]> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return [];
  const friendIds = await friendService
    .listFriends(session.account.id)
    .catch(() => [] as string[]);
  const filtered = friendIds.filter(
    (id) => id !== excludeAccountId && id !== session.account.id,
  );
  const rows = await Promise.all(
    filtered.map(async (id) => {
      const [acc, profile] = await Promise.all([
        getAccountById(id).catch(() => null),
        getProfileByAccountId(id).catch(() => null),
      ]);
      return {
        id,
        displayName: acc?.display_name ?? "Unknown",
        handle: acc?.nex_handle ?? null,
        avatarUrl: profile?.avatar_url ?? null,
        profession: profile?.profession ?? null,
        headline: profile?.headline ?? null,
        locationLabel: profile?.location_label ?? null,
      };
    }),
  );
  rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return rows;
}
