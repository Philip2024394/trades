// src/app/nex-native/manage/live/page.tsx
//
// Merchant Live-post management surface · Wave B Slice 13a (phase-1).
// ---------------------------------------------------------------------
// Phase-1 shape per sealed doctrine · business-anchored short-lived
// announcements with optional expiry. Explicitly NOT the full Live feed
// (which requires geo-boundary + moderation · phase-2). The page labels
// itself honestly.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as liveService from "@/lib/nex-native/live-service";
import {
  createLivePostAction,
  expireLivePostAction,
  extendLivePostExpiryAction,
  signOutAction,
  updateLivePostBodyAction,
} from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS_CODES = new Set(["live_created", "live_expired", "live_body_updated", "live_expiry_extended"]);

function formatExpiresIn(iso: string | null): string {
  if (!iso) return "no expiry";
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return "invalid expiry";
  if (ms <= 0) return "expired";
  const hours = ms / 3_600_000;
  if (hours < 1) return `expires in ${Math.max(1, Math.round(ms / 60_000))}m`;
  if (hours < 24) return `expires in ${Math.round(hours)}h`;
  return `expires in ${Math.round(hours / 24)}d`;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const params = await searchParams;
  const banner = params.e && params.m ? { code: params.e, message: params.m } : null;
  const isSuccess = banner ? SUCCESS_CODES.has(banner.code) : false;
  const themeId = session.account.chat_theme ?? undefined;

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0];

  const [activePosts, allPosts] = await Promise.all([
    liveService.listActiveByBusiness(business.id),
    liveService.listActiveByBusiness(business.id, { include_expired: true, limit: 100 }),
  ]);
  const expiredPosts = allPosts.filter((p) => !activePosts.some((a) => a.id === p.id));

  return (
    <NexNativeShell themeId={themeId}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Live · {business.display_name}
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage" className="underline">← back to manage</Link>
              {" · "}
              <Link href="/nex-native/live" className="underline">public Live feed</Link>
              {" · "}
              <Link href={`/nex-native/${business.slug}`} className="underline">your NEX</Link>
            </p>
            <p className="mt-1 max-w-md text-[11px] text-[var(--nex-neutral-500)]">
              Business-anchored announcements. Posts appear on the public
              Live feed globally today · a geo-boundary filter (only-nearby businesses) is phase-2
              work and not yet enabled.
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
            {banner.code === "live_created" && <>Live post published · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "live_expired" && <>Live post retired</>}
            {banner.code === "live_body_updated" && <>Body updated · post <code className="font-mono">{banner.message}</code></>}
            {banner.code === "live_expiry_extended" && <>Expiry extended · <span className="font-medium">{banner.message}</span></>}
            {!SUCCESS_CODES.has(banner.code) && banner.message}
          </div>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Active posts ({activePosts.length})
          </h2>
          {activePosts.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No active Live posts. Create one below.
            </p>
          ) : (
            <ul className="grid gap-3">
              {activePosts.map((p) => (
                <li key={p.id} className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-neutral-800">
                  <form action={updateLivePostBodyAction} className="mb-2">
                    <input type="hidden" name="post_id" value={p.id} />
                    <label className="block text-[11px] text-neutral-600">
                      Body (max 280 chars)
                      <textarea
                        name="body"
                        rows={2}
                        maxLength={280}
                        required
                        defaultValue={p.body}
                        className="mt-1 block w-full rounded border border-emerald-300 bg-white px-2 py-1 text-sm"
                      />
                    </label>
                    <div className="mt-1 flex justify-end">
                      <SubmitButton label="Save body" pendingLabel="Saving…" variant="secondary" />
                    </div>
                  </form>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-neutral-500">
                      posted {new Date(p.created_at).toLocaleString()} · {formatExpiresIn(p.expires_at)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <form action={extendLivePostExpiryAction} className="inline-flex items-center gap-1">
                        <input type="hidden" name="post_id" value={p.id} />
                        <input
                          type="number"
                          name="hours"
                          min={1}
                          max={168}
                          defaultValue={6}
                          className="min-h-[32px] w-16 rounded border border-emerald-300 bg-white px-1 py-0.5 text-xs"
                        />
                        <SubmitButton label="Extend (h)" pendingLabel="Extending…" variant="secondary" />
                      </form>
                      <form action={expireLivePostAction}>
                        <input type="hidden" name="post_id" value={p.id} />
                        <SubmitButton label="Retire now" pendingLabel="Retiring…" variant="secondary" />
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {expiredPosts.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Expired posts ({expiredPosts.length})
            </h2>
            <ul className="grid gap-2">
              {expiredPosts.map((p) => (
                <li key={p.id} className="rounded border border-neutral-200 bg-white p-2 text-xs text-neutral-500">
                  <div className="mb-0.5 whitespace-pre-wrap text-neutral-700 line-through">{p.body}</div>
                  <div>posted {new Date(p.created_at).toLocaleString()} · retired</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            New Live post
          </h2>
          <form action={createLivePostAction} className="rounded border border-neutral-300 bg-white p-4">
            <label className="mb-3 block text-xs text-neutral-600">
              Body (required · max 280 chars)
              <textarea
                required
                name="body"
                maxLength={280}
                rows={3}
                placeholder="e.g. Open until 8pm tonight · fresh sourdough loaves 50% off"
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="mb-4 block text-xs text-neutral-600">
              Expires in (hours · optional · 1..168)
              <input
                type="number"
                name="expires_in_hours"
                min={1}
                max={168}
                placeholder="e.g. 6"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
              <span className="mt-1 block text-[11px] text-neutral-500">
                Leave blank for a post without an explicit expiry.
              </span>
            </label>
            <SubmitButton label="Publish Live post" pendingLabel="Publishing…" fullWidth />
          </form>
        </section>
      </main>
    </NexNativeShell>
  );
}
