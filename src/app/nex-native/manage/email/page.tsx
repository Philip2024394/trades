// src/app/nex-native/manage/email/page.tsx
// Wave C Slice 11b · Email lists index page.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as emailService from "@/lib/nex-native/email-service";
import { createEmailListAction, deleteEmailListAction, signOutAction } from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS = new Set(["list_created", "list_deleted"]);

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS.has(banner.code) : false;

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0];

  const lists = await emailService.listListsByBusiness(business.id);
  // Fetch active subscriber counts per list (parallel · 1 lookup each)
  const activeCountsByList = new Map<string, number>();
  await Promise.all(lists.map(async (l) => {
    const subs = await emailService.listSubscribers(l.id);
    activeCountsByList.set(l.id, subs.length);
  }));

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Email Marketing · {business.display_name}
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage" className="underline">← back to manage</Link>
              {" · "}
              <Link href={`/nex-native/${business.slug}`} className="underline">your NEX</Link>
            </p>
            <p className="mt-1 max-w-md text-[11px] text-[var(--nex-neutral-500)]">
              Lists and subscribers are ready · compose and send from here.
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
            {banner.code === "list_created" && <>List created · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "list_deleted" && <>List deleted · <span className="font-medium">{banner.message}</span></>}
            {!SUCCESS.has(banner.code) && banner.message}
          </div>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Your lists ({lists.length})
          </h2>
          {lists.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No lists yet. Create one below.
            </p>
          ) : (
            <ul className="grid gap-2">
              {lists.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded border border-neutral-200 bg-white p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/nex-native/manage/email/${l.id}`} className="block truncate font-medium text-neutral-900 underline">
                      {l.name}
                    </Link>
                    <div className="text-xs text-neutral-500">
                      {activeCountsByList.get(l.id) ?? 0} active subscriber{activeCountsByList.get(l.id) === 1 ? "" : "s"}
                      {l.description && <> · <span className="text-neutral-700">{l.description}</span></>}
                    </div>
                  </div>
                  <form action={deleteEmailListAction}>
                    <input type="hidden" name="list_id" value={l.id} />
                    <SubmitButton label="Delete" pendingLabel="Deleting…" variant="secondary" />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            New list
          </h2>
          <form action={createEmailListAction} className="rounded border border-neutral-300 bg-white p-4">
            <label className="mb-3 block text-xs text-neutral-600">
              Name (required · max 100)
              <input required type="text" name="name" maxLength={100}
                placeholder="e.g. Newsletter · Repeat customers"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"/>
            </label>
            <label className="mb-4 block text-xs text-neutral-600">
              Description (optional · max 500)
              <textarea name="description" maxLength={500} rows={2}
                placeholder="Who this list is for + how often you send"
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"/>
            </label>
            <SubmitButton label="Create list" pendingLabel="Creating…" fullWidth />
          </form>
        </section>
      </main>
    </NexNativeShell>
  );
}
