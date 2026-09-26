// src/app/nex-native/manage/email/[listId]/page.tsx
// Wave C Slice 11b · Single-list subscriber management.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as emailService from "@/lib/nex-native/email-service";
import { addEmailSubscriberAction, unsubscribeEmailSubscriberAction, signOutAction } from "../../../_actions";
import { SubmitButton } from "../../../_submit-button";
import { NexNativeShell } from "../../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ e?: string; m?: string; include?: string }>;
}

const SUCCESS = new Set(["subscriber_added", "subscriber_unsubscribed"]);

export default async function Page({ params, searchParams }: PageProps) {
  const { listId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS.has(banner.code) : false;
  const includeUnsubscribed = sp.include === "all";

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const list = await emailService.getListById(listId);
  if (!list) notFound();
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned.find((b) => b.id === list.business_id);
  if (!business) notFound();  // not the owner

  const subscribers = await emailService.listSubscribers(list.id, {
    include_unsubscribed: includeUnsubscribed,
    limit: 500,
  });
  const activeCount = subscribers.filter((s) => s.unsubscribed_at === null).length;
  const totalCount = subscribers.length;

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {list.name}
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage/email" className="underline">← all lists</Link>
              {" · "}
              <Link href={`/nex-native/manage/email/${list.id}/campaigns`} className="underline">campaigns</Link>
              {" · "}
              {business.display_name}
            </p>
            {list.description && (
              <p className="mt-1 text-xs text-neutral-700">{list.description}</p>
            )}
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
            {banner.code === "subscriber_added" && <>Subscriber added · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "subscriber_unsubscribed" && <>Unsubscribed · <span className="font-mono">{banner.message}</span></>}
            {!SUCCESS.has(banner.code) && banner.message}
          </div>
        )}

        <nav className="mb-3 flex gap-2 text-xs">
          <Link
            href={`/nex-native/manage/email/${list.id}`}
            className={`rounded border px-3 py-1 ${!includeUnsubscribed ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}`}
          >
            Active only
          </Link>
          <Link
            href={`/nex-native/manage/email/${list.id}?include=all`}
            className={`rounded border px-3 py-1 ${includeUnsubscribed ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"}`}
          >
            Include unsubscribed
          </Link>
        </nav>

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Subscribers ({activeCount} active{includeUnsubscribed && ` · ${totalCount} total`})
          </h2>
          {subscribers.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No subscribers on this list yet. Add one below.
            </p>
          ) : (
            <ul className="grid gap-1">
              {subscribers.map((s) => {
                const isUnsub = s.unsubscribed_at !== null;
                return (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                      isUnsub ? "border-neutral-200 bg-neutral-50 text-neutral-500 line-through" : "border-neutral-200 bg-white text-neutral-800"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">{s.email}</span>
                    <span className="text-[10px] text-neutral-500">
                      {isUnsub
                        ? `unsubscribed ${new Date(s.unsubscribed_at!).toLocaleDateString()}`
                        : `subscribed ${new Date(s.subscribed_at).toLocaleDateString()}`}
                    </span>
                    {!isUnsub && (
                      <form action={unsubscribeEmailSubscriberAction}>
                        <input type="hidden" name="list_id" value={list.id} />
                        <input type="hidden" name="subscriber_id" value={s.id} />
                        <SubmitButton label="Unsub" pendingLabel="…" variant="secondary" />
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Add subscriber
          </h2>
          <form action={addEmailSubscriberAction} className="rounded border border-neutral-300 bg-white p-4">
            <input type="hidden" name="list_id" value={list.id} />
            <label className="mb-3 block text-xs text-neutral-600">
              Email address
              <input required type="email" name="email" maxLength={320}
                placeholder="alice@example.com"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"/>
            </label>
            <div className="mb-2 flex justify-end">
              <SubmitButton label="Add subscriber" pendingLabel="Adding…" />
            </div>
            <p className="text-[10px] text-neutral-500">
              Re-adding an unsubscribed email re-subscribes them · idempotent.
            </p>
          </form>
        </section>
      </main>
    </NexNativeShell>
  );
}
