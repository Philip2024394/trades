// src/app/nex-native/contacts/page.tsx
//
// Wave B Slice 3f-b · Contacts panel (real data · replaces /nex-app mock).
// -------------------------------------------------------------------------
// Two sections stacked:
//   1. Personal friends · from friendService.listFriends (accepted-only).
//   2. Business contacts · from conversationService.listConversationsForAccount
//      filtered to my_side === "customer" (buyers), grouped by business so
//      one card per business regardless of how many product-scoped threads
//      exist between us.
//
// Per-card theme-share toggle · calls setThemeShareAction which writes to
// nex_account_relationship_prefs (migration 033). Toggling on means "the
// other party can see my chat_theme applied when we chat".

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as friendService from "@/lib/nex-native/friend-service";
import * as conversationService from "@/lib/nex-native/conversation-service";
import * as accountService from "@/lib/nex-native/account-service";
import * as relationshipService from "@/lib/nex-native/relationship-service";
import { setThemeShareAction, signOutAction } from "../_actions";
import { SubmitButton } from "../_submit-button";
import { NexNativeShell } from "../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS_CODES = new Set(["theme_shared", "theme_unshared"]);

async function hydrateFriend(accountId: string) {
  const acc = await accountService.getAccountById(accountId);
  return {
    id: accountId,
    handle: acc?.nex_handle ?? null,
    display_name: acc?.display_name ?? "unknown",
  };
}

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;

  // Personal friends (accepted)
  const friendIds = await friendService.listFriends(session.account.id);
  const friends = await Promise.all(
    friendIds.map((v) => hydrateFriend(typeof v === "string" ? v : (v as { id: string }).id)),
  );

  // Business contacts · dedupe by business_id, keep the most recent
  const convs = await conversationService.listConversationsForAccount(session.account.id);
  const businessMap = new Map<
    string,
    { business_id: string; display_name: string; slug: string; owner_account_id?: string; last_conversation_id: string; unread_count: number }
  >();
  for (const s of convs) {
    if (s.my_side !== "customer") continue;
    if (!businessMap.has(s.business.id)) {
      businessMap.set(s.business.id, {
        business_id: s.business.id,
        display_name: s.business.display_name,
        slug: s.business.slug,
        last_conversation_id: s.conversation.id,
        unread_count: s.unread_count,
      });
    }
  }
  const businessContacts = Array.from(businessMap.values());

  // Load owner account for each business so we can resolve theme-share per relationship.
  // (Business contact's "other party" for theme sharing is the business owner account.)
  const businessesWithOwner: Array<typeof businessContacts[number] & { owner_account_id: string | null }> = [];
  for (const bc of businessContacts) {
    // Business owner id isn't in the summary · minimal query directly.
    const businessSvc = await import("@/lib/nex-native/business-service");
    const biz = await businessSvc.getBusinessById(bc.business_id);
    businessesWithOwner.push({ ...bc, owner_account_id: biz?.owner_account_id ?? null });
  }

  // Load prefs for all relationships in one pass.
  const otherIds = [
    ...friends.map((f) => f.id),
    ...businessesWithOwner.map((b) => b.owner_account_id).filter((v): v is string => !!v),
  ];
  const prefsMap = new Map<string, boolean>();  // key: otherId · value: whether actor_shares_theme
  for (const otherId of otherIds) {
    try {
      const p = await relationshipService.getPrefs(session.account.id, otherId);
      prefsMap.set(otherId, p.actor_shares_theme);
    } catch {
      prefsMap.set(otherId, false);
    }
  }

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Contacts</h1>
            <p className="text-xs text-neutral-500">
              Signed in as{" "}
              <span className="font-medium text-neutral-800">{session.account.display_name}</span>
              {" · "}
              {session.account.nex_handle && (
                <Link href={`/nex-native/u/${session.account.nex_handle}`} className="font-mono underline">
                  {session.account.nex_handle}
                </Link>
              )}
              {" · "}
              <Link href="/nex-native/conversations" className="underline">inbox</Link>
              {" · "}
              <Link href="/nex-native/friends" className="underline">manage friends</Link>
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
            {banner.code === "theme_shared" && <>Theme shared with contact <code className="font-mono">{banner.message}</code></>}
            {banner.code === "theme_unshared" && <>Theme sharing stopped for <code className="font-mono">{banner.message}</code></>}
            {!SUCCESS_CODES.has(banner.code) && banner.message}
          </div>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Personal friends ({friends.length})
          </h2>
          {friends.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No friends yet.{" "}
              <Link href="/nex-native/friends" className="underline">Add someone by handle</Link>.
            </p>
          ) : (
            <ul className="grid gap-2">
              {friends.map((f) => {
                const currentlyShared = prefsMap.get(f.id) === true;
                return (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded border border-neutral-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-neutral-900">
                        {f.display_name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {f.handle ? (
                          <Link href={`/nex-native/u/${f.handle}`} className="font-mono underline">{f.handle}</Link>
                        ) : (
                          <code className="font-mono">{f.id.slice(0, 8)}…</code>
                        )}
                      </div>
                    </div>
                    <form action={setThemeShareAction} className="flex items-center gap-1">
                      <input type="hidden" name="other_account_id" value={f.id} />
                      <input type="hidden" name="share" value={currentlyShared ? "false" : "true"} />
                      <SubmitButton
                        label={currentlyShared ? "Theme: ON" : "Theme: off"}
                        pendingLabel="…"
                        variant="secondary"
                      />
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Business contacts ({businessesWithOwner.length})
          </h2>
          {businessesWithOwner.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No business chats yet. Visit a business page and place an order or message a live banner.
            </p>
          ) : (
            <ul className="grid gap-2">
              {businessesWithOwner.map((bc) => {
                const currentlyShared = bc.owner_account_id ? prefsMap.get(bc.owner_account_id) === true : false;
                return (
                  <li
                    key={bc.business_id}
                    className="flex items-center justify-between gap-3 rounded border border-neutral-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/nex-native/conversations/${bc.last_conversation_id}`}
                        className="block truncate text-sm font-medium text-neutral-900 underline"
                      >
                        {bc.display_name}
                      </Link>
                      <div className="text-xs text-neutral-500">
                        <Link href={`/nex-native/${bc.slug}`} className="font-mono underline">
                          /nex-native/{bc.slug}
                        </Link>
                        {bc.unread_count > 0 && (
                          <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded bg-neutral-900 px-1 text-[10px] font-semibold text-white">
                            {bc.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                    {bc.owner_account_id ? (
                      <form action={setThemeShareAction} className="flex items-center gap-1">
                        <input type="hidden" name="other_account_id" value={bc.owner_account_id} />
                        <input type="hidden" name="share" value={currentlyShared ? "false" : "true"} />
                        <SubmitButton
                          label={currentlyShared ? "Theme: ON" : "Theme: off"}
                          pendingLabel="…"
                          variant="secondary"
                        />
                      </form>
                    ) : (
                      <span className="text-[11px] text-neutral-400">owner unknown</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-neutral-500">
          Theme sharing is per-relationship · opt-in (both start off) · toggling on lets the
          other party see your chat theme (Slice 7a-b) when they chat with you. Backed by
          nex_account_relationship_prefs (migration 033).
        </p>
      </main>
    </NexNativeShell>
  );
}
