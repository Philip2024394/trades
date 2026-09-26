// src/app/nex-native/manage/email/[listId]/campaigns/new/page.tsx
// Wave C Slice 11c · Compose new draft campaign form.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as emailService from "@/lib/nex-native/email-service";
import { createCampaignAction } from "../../../../../_actions";
import { SubmitButton } from "../../../../../_submit-button";
import { NexNativeShell } from "../../../../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const list = await emailService.getListById(listId);
  if (!list) notFound();
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned.find((b) => b.id === list.business_id);
  if (!business) notFound();

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 border-b border-neutral-300 pb-3">
          <h1 className="text-lg font-semibold text-neutral-900">Compose campaign</h1>
          <p className="text-xs text-neutral-500">
            <Link href={`/nex-native/manage/email/${list.id}/campaigns`} className="underline">← campaigns</Link>
            {" · "}
            for list <span className="font-medium">{list.name}</span>
          </p>
        </header>

        <form action={createCampaignAction} className="rounded border border-neutral-300 bg-white p-4">
          <input type="hidden" name="list_id" value={list.id} />
          <label className="mb-3 block text-xs text-neutral-600">
            Subject (required · max 200)
            <input
              required
              type="text"
              name="subject"
              maxLength={200}
              placeholder="e.g. Autumn joinery slots open"
              className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="mb-3 block text-xs text-neutral-600">
            Body (plain text · required · max 50000)
            <textarea
              required
              name="body_text"
              rows={12}
              maxLength={50000}
              placeholder={"Hi,\n\nWe have a few consultation slots open next week...\n\nBest,\nThe team"}
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
            />
          </label>
          <label className="mb-4 block text-xs text-neutral-600">
            HTML body (optional · max 50000 · leave blank to fallback to plain text)
            <textarea
              name="body_html"
              rows={6}
              maxLength={50000}
              placeholder="<p>Hi,</p><p>We have a few consultation slots open...</p>"
              className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 font-mono text-xs"
            />
          </label>
          <SubmitButton label="Save draft" pendingLabel="Saving…" fullWidth />
        </form>
        <p className="mt-2 text-[11px] text-neutral-500">
          Saves as a DRAFT · you can edit it before Slice 11d (send infrastructure) lands.
        </p>
      </main>
    </NexNativeShell>
  );
}
