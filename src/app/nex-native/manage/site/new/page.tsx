// src/app/nex-native/manage/site/new/page.tsx
//
// Wave 4A · NEX Template Picker · 2026-09-25.
// Mobile-first Server Component that lets a merchant choose a
// deterministic Template Intent rather than typing free-form prompts.
// Every card is a real NEX_TEMPLATE_REGISTRY entry · every "Use template"
// button runs startTemplateBuildAction which fires the Wave 3 coherence
// gate against the merchant's real business data.
//
// Founder-sealed doctrine (see doctrine_nex_app_builder_templates):
//   Template Intent System solves mixed-subject BEFORE generation.
//   The LLM is not called on this path · deterministic + coherent by
//   construction. Prompt-driven Engine 2 remains available via the
//   existing /nex-native/manage/site index page for advanced users.

import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import {
  listTemplates,
  NEX_BUSINESS_CATEGORIES,
  type NexBusinessCategory,
} from "@/lib/nex-native/site-templates";
import { startTemplateBuildAction, signOutAction } from "../../../_actions";
import { SubmitButton } from "../../../_submit-button";
import { NexNativeShell } from "../../../_shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ e?: string; m?: string; category?: string }>;
}

export default async function TemplatePickerPage({ searchParams }: PageProps) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const sp = await searchParams;
  const banner = sp.e && sp.m ? { code: sp.e, message: sp.m } : null;

  const owned = await businessService.listBusinessesByOwner(session.account.id);
  if (owned.length === 0) redirect("/nex-native/onboarding");
  const business = owned[0]!;

  // Wave 4A · Scope filter: if ?category is supplied and valid, only show
  // templates matching that category · otherwise show all with a category
  // filter chip row.
  const rawCategory = (sp.category ?? "").trim();
  const activeCategory: NexBusinessCategory | null =
    rawCategory && (NEX_BUSINESS_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as NexBusinessCategory)
      : null;
  const allTemplates = listTemplates();
  const templatesForView = activeCategory
    ? allTemplates.filter((t) => t.business_category === activeCategory)
    : allTemplates;

  return (
    <NexNativeShell themeId={session.account.chat_theme ?? undefined}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-[var(--nex-neutral-300)] pb-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--nex-neutral-900)]">
              Choose a starting template
            </h1>
            <p className="mt-1 text-xs text-[var(--nex-neutral-500)]">
              <Link
                href="/nex-native/manage/site"
                className="underline hover:text-[var(--nex-accent-600)]"
              >
                ← back to your sites
              </Link>
              {" · building for "}
              <span className="font-medium text-[var(--nex-neutral-900)]">
                {business.display_name}
              </span>
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-xs text-[var(--nex-neutral-500)] underline"
            >
              sign out
            </button>
          </form>
        </header>

        {banner && (
          <div
            className="mb-4 rounded-lg border border-[var(--nex-error-500)]/40 bg-white/70 p-3 text-xs text-[var(--nex-neutral-900)]"
            role="status"
          >
            <strong className="font-medium">{banner.code}:</strong> {banner.message}
          </div>
        )}

        <section
          className="mb-6 rounded-2xl border border-[var(--nex-neutral-200)] bg-white/70 p-4 backdrop-blur-sm"
          data-nex-picker-intro
        >
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--nex-accent-600)]">
            Template Intent · what are you building?
          </h2>
          <p className="text-sm text-[var(--nex-neutral-700)]">
            Templates guarantee a <strong>coherent subject</strong>: a bakery
            template will never surface construction imagery, and a
            tradesperson template will never surface bakery copy. Pick a
            template that matches your business · we bind your real NEX
            business + product data into it, no fabrication.
          </p>
        </section>

        <section
          className="mb-6"
          data-nex-picker-categories
          aria-label="Filter templates by business category"
        >
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--nex-neutral-500)]">
            Filter by category ({templatesForView.length} shown)
          </h2>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/nex-native/manage/site/new"
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
                activeCategory === null
                  ? "border-[var(--nex-accent-600)] bg-[var(--nex-accent-50)] text-[var(--nex-accent-700)]"
                  : "border-[var(--nex-neutral-300)] bg-white/70 text-[var(--nex-neutral-700)]"
              }`}
              data-nex-picker-category-chip="all"
            >
              All
            </Link>
            {[...new Set(allTemplates.map((t) => t.business_category))].map((cat) => (
              <Link
                key={cat}
                href={`/nex-native/manage/site/new?category=${encodeURIComponent(cat)}`}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${
                  activeCategory === cat
                    ? "border-[var(--nex-accent-600)] bg-[var(--nex-accent-50)] text-[var(--nex-accent-700)]"
                    : "border-[var(--nex-neutral-300)] bg-white/70 text-[var(--nex-neutral-700)]"
                }`}
                data-nex-picker-category-chip={cat}
              >
                {cat}
              </Link>
            ))}
          </div>
        </section>

        <section
          className="mb-8 grid gap-4 sm:grid-cols-2"
          data-nex-picker-grid
          aria-label="Template cards"
        >
          {templatesForView.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--nex-neutral-300)] bg-white/60 p-6 text-sm text-[var(--nex-neutral-600)]">
              No templates for <code>{activeCategory}</code> yet · more
              families are coming soon.
            </div>
          ) : (
            templatesForView.map((t) => (
              <article
                key={t.id}
                className="flex flex-col rounded-2xl border border-[var(--nex-neutral-200)] bg-white/85 p-4 shadow-[var(--nex-shadow-sm)] transition hover:shadow-[var(--nex-shadow-md)]"
                data-nex-picker-card={t.id}
              >
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[var(--nex-neutral-900)]">
                      {t.display_name}
                    </h3>
                    <p className="text-[11px] uppercase tracking-wider text-[var(--nex-neutral-500)]">
                      {t.business_category} · {t.primary_purpose} · {t.visual_direction}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium`}
                    style={{
                      background: "var(--nex-accent-50)",
                      color: "var(--nex-accent-700)",
                      border: "1px solid var(--nex-accent-100)",
                    }}
                  >
                    v{t.version}
                  </span>
                </header>
                <p className="mb-3 flex-1 text-sm text-[var(--nex-neutral-700)]">
                  {t.short_description}
                </p>
                <p className="mb-3 text-[11px] text-[var(--nex-neutral-500)]">
                  <strong>Suitable for:</strong> {t.suitable_for.join(" · ")}
                </p>
                <p className="mb-3 text-[11px] text-[var(--nex-neutral-500)]">
                  <strong>Sections:</strong>{" "}
                  <code className="rounded bg-[var(--nex-neutral-100)] px-1">
                    {t.required_sections.join(" · ")}
                  </code>
                </p>
                <form action={startTemplateBuildAction} className="mt-auto">
                  <input type="hidden" name="template_id" value={t.id} />
                  <SubmitButton
                    label={`Use ${t.display_name}`}
                    pendingLabel="Building coherent site…"
                    fullWidth
                  />
                </form>
              </article>
            ))
          )}
        </section>

        <section
          className="rounded-2xl border border-dashed border-[var(--nex-neutral-300)] bg-white/60 p-4 text-xs text-[var(--nex-neutral-600)]"
          data-nex-picker-footer
        >
          <p>
            <strong>Advanced:</strong> if none of these templates fit, you can
            still use the{" "}
            <Link
              href="/nex-native/manage/site"
              className="underline hover:text-[var(--nex-accent-600)]"
            >
              free-form prompt builder
            </Link>{" "}
            (Engine 1) or the{" "}
            <Link
              href="/nex-native/manage/site"
              className="underline hover:text-[var(--nex-accent-600)]"
            >
              NEX AI Builder
            </Link>{" "}
            (Engine 2 · dry-run until R4 activates the local model).
          </p>
        </section>
      </main>
    </NexNativeShell>
  );
}
