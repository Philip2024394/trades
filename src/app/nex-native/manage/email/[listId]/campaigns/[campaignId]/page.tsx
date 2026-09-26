// src/app/nex-native/manage/email/[listId]/campaigns/[campaignId]/page.tsx
// Wave C Slice 11c · Campaign edit + preview.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as emailService from "@/lib/nex-native/email-service";
import { deleteCampaignAction, dispatchCampaignAction, updateCampaignAction } from "../../../../../../_actions";
import { SubmitButton } from "../../../../../../_submit-button";
import { NexNativeShell } from "../../../../../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ listId: string; campaignId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS = new Set(["campaign_updated", "campaign_dispatched"]);

export default async function Page({ params, searchParams }: PageProps) {
  const { listId, campaignId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS.has(banner.code) : false;

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const campaign = await emailService.getCampaignById(campaignId);
  if (!campaign || campaign.list_id !== listId) notFound();
  const list = await emailService.getListById(listId);
  if (!list) notFound();
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned.find((b) => b.id === list.business_id);
  if (!business) notFound();

  const editable = campaign.status === "draft";
  // Slice 11d · load send log for non-draft campaigns
  const sendLog = editable ? [] : await emailService.listSendLogForCampaign(campaign.id);
  const sendCounts = sendLog.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 border-b border-neutral-300 pb-3">
          <h1 className="text-lg font-semibold text-neutral-900">
            {campaign.subject}
            <span className={`ml-2 rounded border px-2 py-0.5 text-[10px] font-medium ${
              editable
                ? "border-neutral-300 bg-neutral-100 text-neutral-800"
                : "border-green-300 bg-green-100 text-green-900"
            }`}>{campaign.status}</span>
          </h1>
          <p className="text-xs text-neutral-500">
            <Link href={`/nex-native/manage/email/${list.id}/campaigns`} className="underline">← campaigns</Link>
            {" · "}
            list <span className="font-medium">{list.name}</span>
          </p>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              isSuccess ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {banner.code === "campaign_updated" && <>Campaign updated · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "campaign_dispatched" && <>Dispatched · <span className="font-medium">{banner.message}</span></>}
            {!SUCCESS.has(banner.code) && banner.message}
          </div>
        )}

        {editable ? (
          <form action={updateCampaignAction} className="rounded border border-neutral-300 bg-white p-4">
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <label className="mb-3 block text-xs text-neutral-600">
              Subject
              <input required type="text" name="subject" maxLength={200}
                defaultValue={campaign.subject}
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"/>
            </label>
            <label className="mb-3 block text-xs text-neutral-600">
              Body (plain text)
              <textarea required name="body_text" rows={12} maxLength={50000}
                defaultValue={campaign.body_text}
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"/>
            </label>
            <label className="mb-4 block text-xs text-neutral-600">
              HTML body (optional)
              <textarea name="body_html" rows={6} maxLength={50000}
                defaultValue={campaign.body_html ?? ""}
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 font-mono text-xs"/>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SubmitButton label="Save draft" pendingLabel="Saving…" />
              <div className="flex gap-2">
                <form action={dispatchCampaignAction}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <SubmitButton label="Dispatch now" pendingLabel="Dispatching…" />
                </form>
                <form action={deleteCampaignAction}>
                  <input type="hidden" name="campaign_id" value={campaign.id} />
                  <SubmitButton label="Delete draft" pendingLabel="Deleting…" variant="secondary" />
                </form>
              </div>
            </div>
          </form>
          <p className="mt-2 text-[11px] text-amber-800">
            <strong>Dispatch note.</strong> The default send adapter is a dry-run console logger ·
            no external email is delivered until you wire a provider (Resend/Postmark/SMTP).
            Dispatch marks the campaign sent, records one log row per subscriber (sent/skipped),
            and freezes the campaign for audit.
          </p>
        ) : (
          <section className="rounded border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Preview (read-only)</div>
            <p className="mb-3 text-xs text-neutral-500">
              {campaign.status === "sent" && campaign.sent_at && (
                <>Sent {new Date(campaign.sent_at).toLocaleString()} to {campaign.sent_count} recipient{campaign.sent_count === 1 ? "" : "s"}.</>
              )}
            </p>
            <pre className="whitespace-pre-wrap rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-800">
              {campaign.body_text}
            </pre>
            {campaign.body_html && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-neutral-600">HTML body</summary>
                <pre className="mt-1 whitespace-pre-wrap rounded border border-neutral-200 bg-white p-3 font-mono text-[10px] text-neutral-700">
                  {campaign.body_html}
                </pre>
              </details>
            )}
            {sendLog.length > 0 && (
              <details className="mt-3 rounded border border-neutral-200 bg-white p-2 text-xs">
                <summary className="cursor-pointer font-medium text-neutral-800">
                  Send log ({sendLog.length} rows ·{" "}
                  {["sent", "skipped", "failed", "queued"]
                    .filter((s) => sendCounts[s])
                    .map((s) => `${sendCounts[s]} ${s}`)
                    .join(" · ")})
                </summary>
                <ol className="mt-2 space-y-0.5">
                  {sendLog.map((r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-2">
                      <span
                        className={`inline-block w-16 rounded px-1 py-0.5 text-[10px] font-medium ${
                          r.status === "sent" ? "bg-green-100 text-green-900"
                          : r.status === "skipped" ? "bg-neutral-100 text-neutral-700"
                          : r.status === "failed" ? "bg-rose-100 text-rose-900"
                          : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-600">
                        subscriber {r.subscriber_id.slice(0, 8)}…
                      </span>
                      {r.error_message && (
                        <span className="truncate text-[10px] text-neutral-500">· {r.error_message.slice(0, 40)}</span>
                      )}
                      <span className="text-[10px] text-neutral-400">
                        {new Date(r.created_at).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
        )}
      </main>
    </NexNativeShell>
  );
}
