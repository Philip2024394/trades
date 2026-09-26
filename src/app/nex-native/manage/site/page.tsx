// src/app/nex-native/manage/site/page.tsx
// Wave D Slice 16a · Site builder index page for the merchant.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as siteService from "@/lib/nex-native/site-service";
import { createSiteAction, deleteSiteAction, generateSiteFromPromptAction, signOutAction } from "../../_actions";
import { SubmitButton } from "../../_submit-button";
import { NexNativeShell } from "../../_shell";
import { YourNexCard } from "../../_your-nex-card";
import { nexAddressForBusiness } from "@/lib/nex-native/nex-address";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string }>;
}

const SUCCESS = new Set(["site_deleted"]);

export default async function Page({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;
  const isSuccess = banner ? SUCCESS.has(banner.code) : false;

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0];
  const sites = await siteService.listSitesByBusiness(business.id);

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-[var(--nex-neutral-300)] pb-3">
          <div>
            <h1 className="text-lg font-semibold text-[var(--nex-neutral-900)]">
              Your NEX · {business.display_name}
            </h1>
            <p className="text-xs text-[var(--nex-neutral-500)]">
              <Link href="/nex-native/manage" className="underline">← back to manage</Link>
            </p>
            <p className="mt-1 max-w-md text-[11px] text-[var(--nex-neutral-500)]">
              Your NEX is your public presence · one link to share everywhere ·
              visitors arrive, see who you are, and enter your NEX Chat to
              continue the conversation.
            </p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="text-xs text-[var(--nex-neutral-500)] underline">sign out</button>
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
            {banner.code === "site_deleted" && <>Site deleted · <span className="font-medium">{banner.message}</span></>}
            {!SUCCESS.has(banner.code) && banner.message}
          </div>
        )}

        {(() => {
          const addr = nexAddressForBusiness(business);
          return addr ? <YourNexCard address={addr} /> : null;
        })()}

        <section className="mb-6 rounded-2xl border border-[var(--nex-accent-100)] bg-white/70 p-4 backdrop-blur-sm">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--nex-accent-600)]">
            Recommended · Template Intent
          </h2>
          <p className="mb-3 text-sm text-[var(--nex-neutral-700)]">
            Pick a real NEX template (bakery, restaurant, tradesperson, salon,
            construction, consultant, ecommerce, local-service…) and we&apos;ll
            build a coherent site from your real business data · no
            mixed-subject drift.
          </p>
          <Link
            href="/nex-native/manage/site/new"
            className="inline-flex items-center rounded-md bg-[var(--nex-accent-600)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--nex-accent-700)]"
            data-nex-picker-cta
          >
            Choose a template →
          </Link>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Your sites ({sites.length})
          </h2>
          {sites.length === 0 ? (
            <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
              No sites yet. Draft your first below.
            </p>
          ) : (
            <ul className="grid gap-2">
              {sites.map((s) => (
                <li key={s.id} className="rounded border border-neutral-200 bg-white p-3 text-sm">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/nex-native/manage/site/${s.id}`} className="min-w-0 flex-1 truncate font-medium text-neutral-900 underline">
                      {s.params.hero_headline}
                    </Link>
                    <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${
                      s.published_at
                        ? "border-green-300 bg-green-50 text-green-900"
                        : "border-neutral-300 bg-neutral-100 text-neutral-700"
                    }`}>
                      {s.published_at ? "live" : "draft"}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    template <code className="font-mono">{s.template_name}</code>
                    {" · "}
                    accent <code className="font-mono">{s.params.accent}</code>
                    {s.published_at && (
                      <>
                        {" · "}
                        <Link href={`/nex-native/site/${s.view_token}`} className="underline">
                          /site/{s.view_token.slice(0, 6)}…
                        </Link>
                      </>
                    )}
                  </div>
                  <form action={deleteSiteAction} className="mt-2">
                    <input type="hidden" name="site_id" value={s.id} />
                    <SubmitButton label="Delete" pendingLabel="Deleting…" variant="secondary" />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6 rounded border-2 border-dashed border-purple-300 bg-purple-50 p-4">
          <h2 className="mb-2 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-purple-900">
            NEX AI Builder <span className="text-[10px] normal-case text-purple-700">· Engine 2 · spec-driven</span>
          </h2>
          <p className="mb-3 text-[11px] text-purple-800">
            Send a prompt to the NEX Generation Engine · it returns a validated
            NEX Site Specification · NEX renders it. No external AI provider is
            called · currently in dry-run stub while the model call is being wired.
          </p>
          <form action={generateSiteFromPromptAction} className="grid gap-2">
            <textarea
              required
              name="prompt"
              rows={3}
              maxLength={2000}
              placeholder="e.g. Modern cake shop in Jogja · pink hero · gallery of cakes · order via chat"
              className="block w-full rounded border border-purple-400 bg-white px-2 py-2 text-sm"
            />
            <SubmitButton label="NEX · generate from prompt" pendingLabel="Generating…" fullWidth />
          </form>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Manual · describe what you want (Engine 1)
          </h2>
          <form action={createSiteAction} className="rounded border border-neutral-300 bg-white p-4">
            <label className="mb-4 block text-xs text-neutral-600">
              Prompt (free-form · max 2000)
              <textarea
                required
                name="prompt"
                rows={5}
                maxLength={2000}
                placeholder={"e.g. Modern minimal, slate accent, bespoke joinery, focus on staircases · headline: Bespoke staircases fitted in Manchester"}
                className="mt-1 block w-full rounded border border-neutral-300 px-2 py-2 text-sm"
              />
            </label>
            <fieldset className="mb-4">
              <legend className="mb-1 block text-xs text-neutral-600">Template</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-2 rounded border border-neutral-300 p-3 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-50">
                  <input type="radio" name="template_name" value="modern-minimal" defaultChecked className="mt-1" />
                  <span className="text-xs">
                    <span className="block font-medium text-neutral-900">modern-minimal</span>
                    <span className="block text-neutral-500">Flat neutral · full-width hero · sans</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded border border-neutral-300 p-3 has-[:checked]:border-amber-800 has-[:checked]:bg-amber-50">
                  <input type="radio" name="template_name" value="warm-artisan" className="mt-1" />
                  <span className="text-xs">
                    <span className="block font-medium text-neutral-900">warm-artisan</span>
                    <span className="block text-neutral-500">Serif headline · earthy palette · softer edges</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <SubmitButton label="Draft site" pendingLabel="Drafting…" fullWidth />
            <p className="mt-2 text-[11px] text-neutral-500">
              NEX picks accent colour + hero microcopy from the prompt · your products,
              hours, banners are pulled from your business page automatically · Message
              button routes buyers back into your NEX inbox.
            </p>
          </form>
        </section>
      </main>
    </NexNativeShell>
  );
}
