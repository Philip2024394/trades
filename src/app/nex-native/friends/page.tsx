// src/app/nex-native/friends/page.tsx
//
// NEX Friends · Wave B Slice 9b.
// -------------------------------
// Server Component · lists incoming pending invites, outgoing pending
// invites, and the caller's current friends. Send-invite form takes a
// nex-XXXXX handle (or bare digits).
//
// Doctrine · Identity Doctrine intact:
//   · Every friend row is a nex_account.id UUID · display is via nex_handle
//   · Sender cannot accept their own invite (enforced at service layer)

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as friendService from "@/lib/nex-native/friend-service";
import * as vaultEntryService from "@/lib/nex-native/vault-entry-service";
import {
  acceptFriendInviteAction,
  blockAccountAction,
  declineFriendInviteAction,
  removeFriendAction,
  unblockAccountAction,
  sendFriendInviteAction,
  signOutAction,
} from "../_actions";
import { SubmitButton } from "../_submit-button";
import { NexNativeShell } from "../_shell";
import { MoveToVaultAffordance } from "../vault/_move-to-vault-affordance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS_CODES = new Set(["invite_sent", "accepted", "declined", "friend_removed", "blocked", "unblocked"]);

/** Hydrate an account id into { handle, display_name } for rendering. */
async function hydrate(id: string): Promise<{ id: string; handle: string | null; display_name: string }> {
  const acc = await accountService.getAccountById(id);
  return {
    id,
    handle: acc?.nex_handle ?? null,
    display_name: acc?.display_name ?? "(removed)",
  };
}

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect(`/nex-native/conversations?e=unauthenticated&m=${encodeURIComponent("sign in to see your friends")}`);
  }
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;
  const themeId = session.account.chat_theme ?? undefined;

  const me = session.account.id;
  // Vault-filtered: friends the viewer has moved to Vault are hidden from
  // the main Contacts / Friends surface. See doctrine/vault-build-plan-
  // 2026-10-03.md D1. Pending invites are NOT filtered — the vault flag
  // applies to accepted friendships only.
  const [incoming, outgoing, friendIds] = await Promise.all([
    friendService.listPendingIncoming(me),
    friendService.listPendingOutgoing(me),
    vaultEntryService.listMainContactsFriendIdsForAccount(me),
  ]);

  const otherFromEdge = (r: { a_account_id: string; b_account_id: string }) =>
    r.a_account_id === me ? r.b_account_id : r.a_account_id;

  const incomingHydrated = await Promise.all(incoming.map((e) => hydrate(otherFromEdge(e))));
  const outgoingHydrated = await Promise.all(outgoing.map((e) => hydrate(otherFromEdge(e))));
  const friendsHydrated  = await Promise.all(friendIds.map((id) => hydrate(id)));
  const blockedIds = await friendService.listBlockedByMe(me);
  const blockedHydrated = await Promise.all(blockedIds.map((id) => hydrate(id)));

  const nameFromHydrated = (h: { handle: string | null; display_name: string }) =>
    h.handle ?? h.display_name;

  return (
    <NexNativeShell themeId={themeId}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Friends</h1>
            <p className="text-xs text-neutral-500">
              Add friends by their NEX handle · once accepted you both see each other.
            </p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-neutral-500 underline">sign out</button>
          </form>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              isSuccess
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {banner.code === "invite_sent" && <>Invite sent to <span className="font-mono">{banner.message}</span></>}
            {banner.code === "accepted"    && <>Friend accepted</>}
            {banner.code === "declined"    && <>Invite declined</>}
            {banner.code === "friend_removed" && <>Friendship removed</>}
            {banner.code === "blocked" && <>Account blocked · they cannot re-invite you</>}
            {banner.code === "unblocked" && <>Block lifted · re-invite is possible again</>}
            {!SUCCESS_CODES.has(banner.code) && banner.message}
          </div>
        )}

        <section className="mb-4 rounded border border-neutral-200 bg-white p-3">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Add a friend by handle
          </h2>
          <form action={sendFriendInviteAction} className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-xs text-neutral-600">
              NEX handle
              <input
                type="text"
                name="handle"
                required
                placeholder="nex-36474"
                pattern="^(nex-)?[0-9]{5,}$"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 font-mono text-sm"
              />
            </label>
            <SubmitButton label="Send invite" pendingLabel="Sending…" />
          </form>
          <p className="mt-1 text-[11px] text-neutral-500">
            Your own handle: {session.account.nex_handle ? (
              <Link href={`/nex-native/u/${session.account.nex_handle}`} className="font-mono underline">
                {session.account.nex_handle}
              </Link>
            ) : "(pending)"}
          </p>
        </section>

        <section className="mb-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Incoming invites ({incomingHydrated.length})
          </h2>
          {incomingHydrated.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              Nothing pending.
            </p>
          ) : (
            <ul className="grid gap-2">
              {incomingHydrated.map((h) => (
                <li key={h.id} className="rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{h.display_name}</div>
                      <div className="text-xs text-neutral-500">
                        {h.handle ? (
                          <Link href={`/nex-native/u/${h.handle}`} className="font-mono underline">{h.handle}</Link>
                        ) : (
                          <code className="font-mono">{h.id.slice(0,8)}…</code>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <form action={acceptFriendInviteAction}>
                        <input type="hidden" name="other_account_id" value={h.id} />
                        <SubmitButton label="Accept" pendingLabel="Accepting…" variant="secondary" />
                      </form>
                      <form action={declineFriendInviteAction}>
                        <input type="hidden" name="other_account_id" value={h.id} />
                        <SubmitButton label="Decline" pendingLabel="Declining…" variant="secondary" />
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Outgoing invites ({outgoingHydrated.length})
          </h2>
          {outgoingHydrated.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              No invites awaiting response.
            </p>
          ) : (
            <ul className="grid gap-2">
              {outgoingHydrated.map((h) => (
                <li key={h.id} className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
                  <div className="font-medium">{h.display_name}</div>
                  <div className="text-xs text-neutral-500">
                    {h.handle ? (
                      <Link href={`/nex-native/u/${h.handle}`} className="font-mono underline">{h.handle}</Link>
                    ) : (
                      <code className="font-mono">{h.id.slice(0,8)}…</code>
                    )}
                    {" · "}awaiting response
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Your friends ({friendsHydrated.length})
          </h2>
          {friendsHydrated.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              No friends yet. Send someone your handle · <code className="font-mono">{session.account.nex_handle ?? "…"}</code>.
            </p>
          ) : (
            <ul className="grid gap-2">
              {friendsHydrated.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.display_name}</div>
                    <div className="text-xs text-neutral-500">
                      {h.handle ? (
                        <Link href={`/nex-native/u/${h.handle}`} className="font-mono underline">{h.handle}</Link>
                      ) : (
                        <code className="font-mono">{h.id.slice(0,8)}…</code>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MoveToVaultAffordance
                      mode={{
                        kind: "move-friend",
                        friendId: h.id,
                        friendName: h.display_name,
                      }}
                      showChip={false}
                    >
                      <button
                        type="button"
                        className="inline-flex min-h-[36px] items-center rounded border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800 hover:bg-neutral-100"
                      >
                        Move to Vault
                      </button>
                    </MoveToVaultAffordance>
                    <form action={removeFriendAction}>
                      <input type="hidden" name="other_account_id" value={h.id} />
                      <SubmitButton label="Remove" pendingLabel="Removing…" variant="secondary" />
                    </form>
                    <form action={blockAccountAction}>
                      <input type="hidden" name="other_account_id" value={h.id} />
                      <SubmitButton label="Block" pendingLabel="Blocking…" variant="secondary" />
                    </form>
                    <Link
                      href={`/nex-native/report/${h.id}?back=${encodeURIComponent("/nex-native/friends")}`}
                      className="inline-flex min-h-[36px] items-center rounded border border-red-300 bg-red-50 px-3 text-xs font-medium text-red-800 hover:bg-red-100"
                    >
                      Report
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {blockedHydrated.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Blocked by you ({blockedHydrated.length})
            </h2>
            <ul className="grid gap-2">
              {blockedHydrated.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.display_name}</div>
                    <div className="text-xs">
                      {h.handle ? (
                        <Link href={`/nex-native/u/${h.handle}`} className="font-mono underline">{h.handle}</Link>
                      ) : (
                        <code className="font-mono">{h.id.slice(0,8)}…</code>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={unblockAccountAction}>
                      <input type="hidden" name="other_account_id" value={h.id} />
                      <SubmitButton label="Unblock" pendingLabel="Unblocking…" variant="secondary" />
                    </form>
                    <Link
                      href={`/nex-native/report/${h.id}?back=${encodeURIComponent("/nex-native/friends")}`}
                      className="inline-flex min-h-[36px] items-center rounded border border-red-300 bg-red-100 px-3 text-xs font-medium text-red-800 hover:bg-red-200"
                    >
                      Report
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[11px] text-neutral-500">
          Friend links are canonical · one relationship per pair · sender cannot accept their own invite.
          Blocked entries prevent re-invite from either side · only the blocker can unblock.
          Underlying schema at nex_friend_edge · migrations 025 + 034.
        </p>
      </main>
    </NexNativeShell>
  );
}
