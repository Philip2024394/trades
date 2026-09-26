// src/app/nex-native/manage/site/[siteId]/page.tsx
// Wave D Slice 16a · Site edit + publish view.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as siteService from "@/lib/nex-native/site-service";
import { publishSiteAction, unpublishSiteAction, updateSitePromptAction, updateSiteSectionsAction, updateSiteFieldAction, deleteSiteAction, signOutAction } from "../../../_actions";
import { effectiveSections, NEX_SITE_SECTIONS, NEX_SITE_ACCENTS } from "@/lib/nex-native/site-service";
import { InlineTextEdit } from "./_inline-edit";
import { SubmitButton } from "../../../_submit-button";
import { NexNativeShell } from "../../../_shell";
import { YourNexCard } from "../../../_your-nex-card";
import { nexAddressForBusiness } from "@/lib/nex-native/nex-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS = new Set(["site_updated", "site_published", "site_unpublished"]);

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from < 0 || from >= arr.length) return arr;
  if (to < 0 || to >= arr.length) return arr;
  const out = [...arr];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { siteId } = await params;
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS.has(banner.code) : false;

  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const site = await siteService.getSiteById(siteId);
  if (!site) notFound();
  const owned = await businessService.listBusinessesByOwner(session.account.id);
  const business = owned.find((b) => b.id === site.business_id);
  if (!business) notFound();

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-neutral-300 pb-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">
              {site.params.hero_headline}
              <span className={`ml-2 rounded border px-2 py-0.5 text-[10px] font-medium ${
                site.published_at
                  ? "border-green-300 bg-green-50 text-green-900"
                  : "border-neutral-300 bg-neutral-100 text-neutral-700"
              }`}>
                {site.published_at ? "live" : "draft"}
              </span>
            </h1>
            <p className="text-xs text-neutral-500">
              <Link href="/nex-native/manage/site" className="underline">← all sites</Link>
              {" · "}
              template <code className="font-mono">{site.template_name}</code>
              {" · "}
              accent <code className="font-mono">{site.params.accent}</code>
            </p>
            {site.published_at && (
              <p className="mt-1 text-xs">
                Public URL:{" "}
                <Link href={`/nex-native/site/${site.view_token}`} className="font-mono text-neutral-700 underline">
                  /nex-native/site/{site.view_token}
                </Link>
              </p>
            )}
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-neutral-500 underline">sign out</button>
          </form>
        </header>

        {banner && (
          <div
            className={`mb-4 rounded border p-3 text-xs ${
              isSuccess ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"
            }`}
            role="status"
          >
            {banner.code === "site_updated" && <>Site regenerated · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "site_published" && <>Site is live · <span className="font-medium">{banner.message}</span></>}
            {banner.code === "site_unpublished" && <>Site is now a draft · <span className="font-medium">{banner.message}</span></>}
            {!SUCCESS.has(banner.code) && banner.message}
          </div>
        )}

        {(() => {
          const addr = nexAddressForBusiness(business);
          return addr ? <YourNexCard address={addr} /> : null;
        })()}

        {/* Wave 4 · Founder §4 · the merchant sees the ACTUAL generated site
            first (via the real Builder Engine at /nex-native/site/[token]),
            with the edit controls below. Not a screenshot · a live iframe. */}
        <section className="mb-6" data-nex-site-preview-top>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--nex-accent-600)]">
              This is your site · live preview
            </h2>
            <Link
              href={`/nex-native/site/${site.view_token}`}
              target="_blank"
              className="text-xs text-[var(--nex-neutral-700)] underline hover:text-[var(--nex-accent-600)]"
            >
              open full ↗
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[var(--nex-neutral-200)] bg-white shadow-[var(--nex-shadow-md)]">
            <iframe
              src={`/nex-native/site/${site.view_token}`}
              title="Site preview"
              className="h-[560px] w-full"
              data-nex-site-preview-iframe
            />
          </div>
          <p className="mt-2 text-[11px] text-[var(--nex-neutral-500)]">
            Real render from the NEX Builder Engine · edits below refresh this
            frame on save.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Prompt</h2>
          <form action={updateSitePromptAction} className="rounded border border-neutral-300 bg-white p-4">
            <input type="hidden" name="site_id" value={site.id} />
            <label className="mb-3 block text-xs text-neutral-600">
              Regenerate style + microcopy from a new prompt (max 2000)
              <textarea
                required
                name="prompt"
                rows={5}
                maxLength={2000}
                defaultValue={site.prompt}
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <SubmitButton label="Regenerate" pendingLabel="Regenerating…" />
          </form>
        </section>

        {/* Slice 16e · inline click-to-edit for hero fields · Engine 1 · deterministic */}
        <section className="mb-6 rounded border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Direct edit · click any field
          </h2>
          <div className="space-y-2">
            <InlineTextEdit
              siteId={site.id}
              field="hero_headline"
              initial={site.params.hero_headline}
              label="Headline"
              submit={updateSiteFieldAction}
            />
            <InlineTextEdit
              siteId={site.id}
              field="hero_subline"
              initial={site.params.hero_subline}
              label="Subline"
              multiline
              submit={updateSiteFieldAction}
            />
            <InlineTextEdit
              siteId={site.id}
              field="cta_label"
              initial={site.params.cta_label}
              label="CTA label"
              submit={updateSiteFieldAction}
            />
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Accent</div>
            <div className="flex flex-wrap gap-2">
              {NEX_SITE_ACCENTS.map((a) => (
                <form key={a} action={updateSiteFieldAction}>
                  <input type="hidden" name="site_id" value={site.id} />
                  <input type="hidden" name="field" value="accent" />
                  <input type="hidden" name="value" value={a} />
                  <button
                    type="submit"
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      site.params.accent === a
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
                    }`}
                  >
                    {a}
                  </button>
                </form>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-neutral-500">
            Direct edits change one field at a time · they never regenerate from
            the prompt, so your headline and CTA copy stay stable when you refine.
          </p>
        </section>

        {/* Slice 16d · section composer */}
        {(() => {
          const current = effectiveSections(site.params);
          const inactive = NEX_SITE_SECTIONS.filter((s) => !current.includes(s));
          return (
            <section className="mb-6 rounded border border-neutral-200 bg-white p-4">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Sections · in order
              </h2>
              <ol className="mb-3 space-y-1 text-sm">
                {current.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="w-6 text-right text-xs text-neutral-500">{i + 1}.</span>
                    <span className="flex-1 rounded border border-neutral-200 bg-neutral-50 px-3 py-1 font-mono text-xs">{s}</span>
                    <form action={updateSiteSectionsAction} className="inline">
                      <input type="hidden" name="site_id" value={site.id} />
                      <input type="hidden" name="sections_ordered"
                        value={move(current, i, i - 1).join(",")} />
                      <button type="submit" disabled={i === 0}
                        className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-40">↑</button>
                    </form>
                    <form action={updateSiteSectionsAction} className="inline">
                      <input type="hidden" name="site_id" value={site.id} />
                      <input type="hidden" name="sections_ordered"
                        value={move(current, i, i + 1).join(",")} />
                      <button type="submit" disabled={i === current.length - 1}
                        className="rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-40">↓</button>
                    </form>
                    <form action={updateSiteSectionsAction} className="inline">
                      <input type="hidden" name="site_id" value={site.id} />
                      <input type="hidden" name="sections_ordered" value={current.filter((_, j) => j !== i).join(",")} />
                      <button type="submit"
                        disabled={current.length <= 1}
                        className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800 disabled:opacity-40">✕</button>
                    </form>
                  </li>
                ))}
              </ol>
              {inactive.length > 0 && (
                <div>
                  <div className="mb-1 text-xs text-neutral-500">Add section</div>
                  <div className="flex flex-wrap gap-2">
                    {inactive.map((s) => (
                      <form key={s} action={updateSiteSectionsAction} className="inline">
                        <input type="hidden" name="site_id" value={site.id} />
                        <input type="hidden" name="sections_ordered" value={[...current, s].join(",")} />
                        <button type="submit"
                          className="rounded border border-neutral-300 bg-white px-3 py-1 text-xs hover:border-neutral-900 hover:bg-neutral-50">
                          + {s}
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })()}

        {/* Slice 16d · live iframe preview has been PROMOTED to top-of-page
            per Wave 4 Founder §4 · this stub kept intentionally empty so the
            surrounding page structure (publish/unpublish buttons below) is
            unchanged. Preview lives above under data-nex-site-preview-top. */}

        <section className="flex flex-wrap items-center gap-2">
          {site.published_at ? (
            <>
              <Link
                href={`/nex-native/site/${site.view_token}`}
                target="_blank"
                className="rounded border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Open live site ↗
              </Link>
              <form action={unpublishSiteAction}>
                <input type="hidden" name="site_id" value={site.id} />
                <SubmitButton label="Unpublish" pendingLabel="Unpublishing…" variant="secondary" />
              </form>
            </>
          ) : (
            <>
              <form action={publishSiteAction}>
                <input type="hidden" name="site_id" value={site.id} />
                <SubmitButton label="Publish site" pendingLabel="Publishing…" />
              </form>
              <Link
                href={`/nex-native/site/${site.view_token}`}
                className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                Preview draft
              </Link>
            </>
          )}
          <form action={deleteSiteAction} className="ml-auto">
            <input type="hidden" name="site_id" value={site.id} />
            <SubmitButton label="Delete" pendingLabel="Deleting…" variant="secondary" />
          </form>
        </section>
      </main>
    </NexNativeShell>
  );
}
