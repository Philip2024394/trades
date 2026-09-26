// src/app/nex-native/manage/banners/page.tsx
//
// Merchant Social Banner surface · Wave B Slice 12a.
// ---------------------------------------------------
// Lists the merchant's banners (draft + live + archived) and offers a
// create form. Status transitions via updateBannerStatusAction. Public
// display of `live` banners happens on the business's public page.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as productService from "@/lib/nex-native/product-service";
import * as bannerService from "@/lib/nex-native/banner-service";
import type { NexBannerRow, NexBannerStatus } from "@/lib/nex-native/banner-service";
import {
  createBannerAction,
  updateBannerStatusAction,
  signOutAction,
} from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS_CODES = new Set(["banner_created", "banner_live", "banner_archived", "banner_draft"]);

const PALETTE_PREVIEW: Record<string, string> = {
  ink:    "bg-neutral-900 text-neutral-50",
  blush:  "bg-pink-100    text-pink-900",
  gold:   "bg-amber-100   text-amber-900",
  night:  "bg-blue-950    text-blue-50",
  ivory:  "bg-yellow-50   text-yellow-900 border border-yellow-200",
};

const STATUS_CLASS: Record<NexBannerStatus, string> = {
  draft:    "bg-amber-100    text-amber-900   border-amber-300",
  live:     "bg-emerald-100  text-emerald-900 border-emerald-300",
  archived: "bg-neutral-200  text-neutral-700 border-neutral-300",
};

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

  const [banners, products] = await Promise.all([
    bannerService.listBannersByBusiness(business.id),
    productService.listProductsByBusiness(business.id),
  ]);

  return (
    <NexNativeShell themeId={themeId}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              Banners · {business.display_name}
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage" className="underline">← back to manage</Link>
              {" · "}
              <Link href={`/nex-native/${business.slug}`} className="underline">your NEX</Link>
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
            {banner.code === "banner_created" && <>Banner created · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "banner_live"    && <>Banner is now live · shows on your NEX</>}
            {banner.code === "banner_archived"&& <>Banner archived</>}
            {banner.code === "banner_draft"   && <>Banner moved back to draft</>}
            {!SUCCESS_CODES.has(banner.code) && banner.message}
          </div>
        )}

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Your banners ({banners.length})
          </h2>
          {banners.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No banners yet. Create your first below.
            </p>
          ) : (
            <ul className="grid gap-3">
              {banners.map((b) => (
                <li key={b.id} className="rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-800">
                  <div className={`mb-2 rounded p-4 text-center ${PALETTE_PREVIEW[b.palette] ?? PALETTE_PREVIEW.ink}`}>
                    <div className="text-base font-semibold">{b.headline}</div>
                    {b.subline && <div className="mt-1 text-sm opacity-90">{b.subline}</div>}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-neutral-500">
                      palette <code className="font-mono">{b.palette}</code>{" "}
                      · created {new Date(b.created_at).toLocaleDateString()}
                    </div>
                    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.status !== "live" && (
                      <form action={updateBannerStatusAction}>
                        <input type="hidden" name="banner_id" value={b.id} />
                        <input type="hidden" name="status" value="live" />
                        <SubmitButton label="Publish" pendingLabel="Publishing…" variant="secondary" />
                      </form>
                    )}
                    {b.status === "live" && (
                      <form action={updateBannerStatusAction}>
                        <input type="hidden" name="banner_id" value={b.id} />
                        <input type="hidden" name="status" value="draft" />
                        <SubmitButton label="Unpublish (draft)" pendingLabel="Unpublishing…" variant="secondary" />
                      </form>
                    )}
                    {b.status !== "archived" && (
                      <form action={updateBannerStatusAction}>
                        <input type="hidden" name="banner_id" value={b.id} />
                        <input type="hidden" name="status" value="archived" />
                        <SubmitButton label="Archive" pendingLabel="Archiving…" variant="secondary" />
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Create new banner
          </h2>
          <form action={createBannerAction} className="rounded border border-neutral-300 bg-white p-4">
            <label className="mb-3 block text-xs text-neutral-600">
              Headline (required · max 80 chars)
              <input
                required
                type="text"
                name="headline"
                maxLength={80}
                placeholder="e.g. Winter oak sale · 20% off"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="mb-3 block text-xs text-neutral-600">
              Subline (optional · max 160 chars)
              <input
                type="text"
                name="subline"
                maxLength={160}
                placeholder="e.g. Handcrafted staircases · finished + fitted"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <label className="mb-3 block text-xs text-neutral-600">
              Palette
              <select
                name="palette"
                defaultValue="ink"
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
              >
                <option value="ink">Ink (dark neutral)</option>
                <option value="blush">Blush (soft pink)</option>
                <option value="gold">Gold (warm)</option>
                <option value="night">Night (deep blue)</option>
                <option value="ivory">Ivory (light warm)</option>
              </select>
            </label>
            <label className="mb-4 block text-xs text-neutral-600">
              Attach a product (optional)
              <select
                name="product_id"
                defaultValue=""
                className="mt-1 block min-h-[44px] w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm"
              >
                <option value="">— none —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-neutral-500">
                Product ties the banner to a specific listing · optional.
              </span>
            </label>
            <SubmitButton label="Create draft" pendingLabel="Creating…" fullWidth />
          </form>
          <p className="mt-2 text-[11px] text-neutral-500">
            Banners start as drafts · publish them explicitly when ready.
            Live banners appear at the top of your public business page.
          </p>
        </section>
      </main>
    </NexNativeShell>
  );
}
