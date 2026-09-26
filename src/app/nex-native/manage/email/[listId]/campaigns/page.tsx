// src/app/nex-native/manage/email/[listId]/campaigns/page.tsx
// Wave C Slice 11c · Campaigns list on a specific email list.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as emailService from "@/lib/nex-native/email-service";
import { NexNativeShell } from "../../../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ listId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS = new Set(["campaign_deleted"]);

const STATUS_CLASS: Record<string, string> = {
  draft:     "bg-neutral-100 text-neutral-800 border-neutral-300",
  scheduled: "bg-amber-100   text-amber-900   border-amber-300",
  sent:      "bg-green-100   text-green-900   border-green-300",
  cancelled: "bg-rose-100    text-rose-900    border-rose-300",
};

export default async function Page({ params, searchParams }: PageProps) {
  const { listId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS.has(banner.code) : false;

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const list = await emailService.getListById(listId);
  if (!list) notFound();
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned.find((b) => b.id === list.business_id);
  if (!business) notFound();

  const campaigns = await emailService.listCampaignsByList(list.id);

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Campaigns · {list.name}</h1>
            <p className="text-xs text-neutral-500">
              <Link href={`/nex-native/manage/email/${list.id}`} className="underline">← subscribers</Link>
              {" · "}
              <Link href="/nex-native/manage/email" className="underline">all lists</Link>
              {" · "}
              {business.display_name}
            </p>
          </div>
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
            {banner.code === "campaign_deleted" && <>Campaign deleted · <span className="font-medium">{banner.message}</span></>}
            {!SUCCESS.has(banner.code) && banner.message}
          </div>
        )}

        <section className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Campaigns ({campaigns.length})
            </h2>
            <Link
              href={`/nex-native/manage/email/${list.id}/campaigns/new`}
              className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
            >
              + New campaign
            </Link>
          </div>
          {campaigns.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No campaigns yet. Draft one with &quot;New campaign&quot;.
            </p>
          ) : (
            <ul className="grid gap-2">
              {campaigns.map((c) => (
                <li key={c.id} className="rounded border border-neutral-200 bg-white p-3 text-sm">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <Link
                      href={`/nex-native/manage/email/${list.id}/campaigns/${c.id}`}
                      className="min-w-0 flex-1 truncate font-medium text-neutral-900 underline"
                    >
                      {c.subject}
                    </Link>
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[c.status] ?? STATUS_CLASS.draft}`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {c.status === "sent" && c.sent_at
                      ? <>sent {new Date(c.sent_at).toLocaleString()} · {c.sent_count} recipient{c.sent_count === 1 ? "" : "s"}</>
                      : <>created {new Date(c.created_at).toLocaleString()}</>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-neutral-500">
          Compose a draft here · send infrastructure arrives in a follow-up slice
          (11d). Sent campaigns are preserved for audit and cannot be deleted.
        </p>
      </main>
    </NexNativeShell>
  );
}
