// src/app/nex-native/live/page.tsx
//
// Public NEX Live feed · Wave B Slice 13a (phase-1).
// ----------------------------------------------------
// Shows currently-active Live posts across all NEX businesses, most-recent
// first. Phase-1 has NO geo-filter — the page labels itself honestly so
// readers know a geo-boundary is phase-2 work.

import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as liveService from "@/lib/nex-native/live-service";
import * as businessService from "@/lib/nex-native/business-service";
import type { NexBusinessRow } from "@/lib/nex-native/business-service";
import { NexNativeShell } from "../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export default async function Page() {
  const session = await resolveNexAppSessionFromContext();
  const themeId = session?.account.chat_theme ?? undefined;

  const posts = await liveService.listActiveGlobal({ limit: 100 });

  // Fetch business rows for the businesses referenced (unique).
  const businessIds = Array.from(new Set(posts.map((p) => p.business_id)));
  const businesses: NexBusinessRow[] = [];
  for (const id of businessIds) {
    const b = await businessService.getBusinessById(id);
    if (b) businesses.push(b);
  }
  const byId = new Map(businesses.map((b) => [b.id, b] as const));

  return (
    <NexNativeShell themeId={themeId}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 border-b border-neutral-300 pb-3">
          <h1 className="text-lg font-semibold text-neutral-900">NEX Live</h1>
          <p className="text-xs text-neutral-500">
            <Link href="/nex-native/conversations" className="underline">← inbox</Link>
            {session && (
              <>
                {" · "}
                <Link href="/nex-native/manage/live" className="underline">post on Live</Link>
              </>
            )}
          </p>
          <p className="mt-2 max-w-lg text-[11px] text-amber-800">
            <strong>Phase 1 · global feed.</strong> All active NEX-business Live posts appear here
            newest-first. A geo-boundary filter (only show posts near you) is phase-2 work per
            NEX doctrine and is not yet enabled.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
            No active Live posts right now. Come back later.
          </p>
        ) : (
          <ul className="grid gap-3">
            {posts.map((p) => {
              const biz = byId.get(p.business_id);
              return (
                <li key={p.id} className="rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-800">
                  <div className="mb-1 whitespace-pre-wrap">{p.body}</div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <div>
                      {biz ? (
                        <Link href={`/nex-native/${biz.slug}`} className="font-medium text-neutral-800 underline">
                          {biz.display_name}
                        </Link>
                      ) : (
                        <span>unknown business</span>
                      )}
                      {" · "}
                      posted {new Date(p.created_at).toLocaleString()}
                    </div>
                    <div>{formatExpiresIn(p.expires_at)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </NexNativeShell>
  );
}
