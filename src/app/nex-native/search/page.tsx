// src/app/nex-native/search/page.tsx
//
// Discovery MVP · Wave B Slice 8a.
// ---------------------------------
// Server Component · reads `?q=` param and runs discovery-service search
// across live products + businesses. Doctrine-compliant · never calls an
// LLM · never fabricates · empty query renders the form only.

import Link from "next/link";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as businessService from "@/lib/nex-native/business-service";
import * as discoveryService from "@/lib/nex-native/discovery-service";
import { NEX_BUSINESS_CATEGORIES } from "@/lib/nex-native/site-templates";
import { NexNativeShell } from "../_shell";

function CategoryFacetRow({
  query,
  activeCategory,
}: {
  query: string;
  activeCategory: string;
}) {
  function labelFor(slug: string): string {
    return slug
      .split("-")
      .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  function href(category: string | null): string {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("category", category);
    const qs = p.toString();
    return qs ? `/nex-native/search?${qs}` : "/nex-native/search";
  }
  return (
    <div
      className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-200 pt-3"
      aria-label="Browse by category"
    >
      <Link
        href={href(null)}
        className={
          !activeCategory
            ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-white"
            : "rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] text-neutral-700 hover:border-neutral-500"
        }
      >
        All
      </Link>
      {NEX_BUSINESS_CATEGORIES.map((c) => {
        const active = c === activeCategory;
        return (
          <Link
            key={c}
            href={href(c)}
            className={
              active
                ? "rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-[11px] font-medium text-white"
                : "rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] text-neutral-700 hover:border-neutral-500"
            }
          >
            {labelFor(c)}
          </Link>
        );
      })}
    </div>
  );
}

async function PopularTagsBlock() {
  let popular: Awaited<ReturnType<typeof discoveryService.getPopularTags>> = [];
  try {
    popular = await discoveryService.getPopularTags(10);
  } catch {
    /* non-fatal · fall through to the empty-state hint */
  }
  return (
    <div className="grid gap-3">
      <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-3 text-xs text-neutral-600">
        Type a query above · try a product name · a business slug · or a tag like <code className="font-mono">oak</code>.
      </p>
      {popular.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Popular tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {popular.map((t) => (
              <Link
                key={t.tag}
                href={`/nex-native/search?q=${encodeURIComponent(t.tag)}`}
                className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 hover:border-neutral-500 hover:bg-neutral-50"
              >
                <span>{t.tag}</span>
                <span className="text-[10px] text-neutral-500">{t.count}</span>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-500">
            Aggregated from real product tags · sorted by count · zero fabrication.
          </p>
        </section>
      )}
    </div>
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; category?: string }>;
}

const PAGE_SIZE = 20;

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;
  // Bridge 55 · Phase 1 launch gate · marketplace search hidden.
  const { commerceEnabledForRequest } = await import(
    "@/lib/nex-native/launch-flags"
  );
  if (!commerceEnabledForRequest(sp)) {
    const { redirect } = await import("next/navigation");
    redirect("/nex-native/home");
  }
  const rawQuery = sp.q ?? "";
  const query = rawQuery.trim();
  // Bridge 14 · category facet · query-only search still works,
  // but adding ?category=restaurant scopes businesses (and turns
  // a category-only browse into a valid request).
  const rawCategory = sp.category ?? "";
  const category = (rawCategory as string).trim().toLowerCase();
  // Slice 8c · pagination
  const pageRaw = Number(sp.page ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const offset = (page - 1) * PAGE_SIZE;

  const session = await resolveNexAppSessionFromContext();
  const themeId = session?.account?.chat_theme ?? undefined;

  let errorMsg: string | null = null;
  let products: Awaited<ReturnType<typeof discoveryService.searchProducts>> = [];
  let businesses: Awaited<ReturnType<typeof discoveryService.searchBusinesses>> = [];
  let productCount = 0;
  let businessCount = 0;
  const hasSearch = query.length > 0 || category.length > 0;
  if (hasSearch) {
    try {
      const businessFilter = category ? { category } : {};
      [products, businesses, productCount, businessCount] = await Promise.all([
        // Product search stays query-driven · category doesn't apply
        // at the product level (a shop's category doesn't tag its
        // products individually).
        query.length > 0
          ? discoveryService.searchProducts(query, { limit: PAGE_SIZE, offset })
          : Promise.resolve([]),
        discoveryService.searchBusinesses(
          query,
          { limit: PAGE_SIZE, offset },
          businessFilter,
        ),
        query.length > 0
          ? discoveryService.countProducts(query)
          : Promise.resolve(0),
        discoveryService.countBusinesses(query, businessFilter),
      ]);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }
  }
  const hasPrev = page > 1;
  const hasNextProducts = offset + products.length < productCount;
  const hasNextBusinesses = offset + businesses.length < businessCount;
  const hasNext = hasNextProducts || hasNextBusinesses;
  function pageLink(newPage: number): string {
    const p = new URLSearchParams({ page: String(newPage) });
    if (query) p.set("q", query);
    if (category) p.set("category", category);
    return `/nex-native/search?${p.toString()}`;
  }

  // Enrich product results with business slug for the "view business" link
  const bizIds = Array.from(new Set(products.map((p) => p.business_id)));
  const bizRows = await Promise.all(bizIds.map((id) => businessService.getBusinessById(id)));
  const bizById = new Map(bizRows.filter(Boolean).map((b) => [b!.id, b!]));

  return (
    <NexNativeShell themeId={themeId}>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-4 border-b border-neutral-300 pb-3">
          <h1 className="text-lg font-semibold text-neutral-900">Discovery</h1>
          <p className="text-xs text-neutral-500">
            Search live products and businesses on NEX. Results come from real
            persisted rows · never fabricated · Discovery does not decide
            intelligence (sealed doctrine).
          </p>
          <form action="/nex-native/search" method="get" className="mt-3 flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="e.g. oak staircase · kitchen · cake"
              maxLength={100}
              autoFocus
              className="min-h-[44px] flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            {category && (
              <input type="hidden" name="category" value={category} />
            )}
            <button
              type="submit"
              className="min-h-[44px] rounded bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Search
            </button>
          </form>
          {/* Bridge 14 · category facet · always visible · clicking a
              chip scopes results to that vertical · "All" clears. */}
          <CategoryFacetRow query={query} activeCategory={category} />
          <p className="mt-2 text-xs text-neutral-500">
            <Link href="/nex-native/conversations" className="underline">← inbox</Link>
          </p>
        </header>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800" role="status">
            {errorMsg}
          </div>
        )}

        {!hasSearch ? (
          <PopularTagsBlock />
        ) : (
          <>
            <section className="mb-4">
              <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <span>Businesses ({businessCount} total)</span>
                {businessCount > 0 && (
                  <span className="text-[10px] normal-case text-neutral-500">
                    showing {offset + 1}-{offset + businesses.length}
                  </span>
                )}
              </h2>
              {businesses.length === 0 ? (
                <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  No matching businesses.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {businesses.map((b) => (
                    <li
                      key={b.id}
                      className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                    >
                      <div className="flex items-start gap-3">
                        {b.logo_url && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={b.logo_url}
                            alt=""
                            className="h-10 w-10 flex-shrink-0 rounded border border-neutral-200 object-contain bg-white"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <Link href={`/nex-native/${b.slug}`} className="font-medium hover:underline">
                            {b.display_name}
                          </Link>
                          <div className="text-xs text-neutral-500">
                            <span className="rounded border border-neutral-300 bg-neutral-100 px-1 py-0.5 font-mono">business</span>
                            {" · "}
                            <code className="font-mono">/{b.slug}</code>
                          </div>
                          {b.description && (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-700 line-clamp-2">
                              {b.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-4">
              <h2 className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
                <span>Products ({productCount} total)</span>
                {productCount > 0 && (
                  <span className="text-[10px] normal-case text-neutral-500">
                    showing {offset + 1}-{offset + products.length}
                  </span>
                )}
              </h2>
              {products.length === 0 ? (
                <p className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                  No matching products.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {products.map((p) => {
                    const biz = bizById.get(p.business_id);
                    return (
                      <li
                        key={p.id}
                        className="rounded border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                      >
                        <div className="flex items-start gap-3">
                          {p.image_url && (
                            <Link
                              href={`/nex-native/product/${p.id}`}
                              className="flex-shrink-0"
                              data-nex-product-result-image
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.image_url}
                                alt=""
                                className="h-12 w-12 rounded border border-neutral-200 object-contain bg-white"
                              />
                            </Link>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/nex-native/product/${p.id}`}
                              className="font-medium hover:underline"
                              data-nex-product-result-link
                            >
                              {p.name}
                            </Link>
                            <div className="text-xs text-neutral-500">
                              <span className="rounded border border-neutral-300 bg-neutral-100 px-1 py-0.5 font-mono">product</span>
                              {" · "}
                              {p.currency} {(p.price_pence / 100).toFixed(2)}
                              {biz && (
                                <>
                                  {" · "}
                                  <Link href={`/nex-native/${biz.slug}`} className="underline">
                                    {biz.display_name}
                                  </Link>
                                </>
                              )}
                            </div>
                            {p.description && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-700 line-clamp-2">
                                {p.description}
                              </p>
                            )}
                            {p.tags && p.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {p.tags.map((t) => (
                                  <Link
                                    key={t}
                                    href={`/nex-native/search?q=${encodeURIComponent(t)}`}
                                    className="inline-block rounded border border-neutral-300 bg-neutral-50 px-1.5 py-0.5 text-[10px] text-neutral-700 hover:border-neutral-500 hover:bg-neutral-100"
                                  >
                                    {t}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {businesses.length === 0 && products.length === 0 && (
              <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No matches. Try a shorter query, different words, or an exact tag / slug.
              </p>
            )}

            {(hasPrev || hasNext) && (
              <nav className="mt-4 flex items-center justify-between gap-2 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
                <div>
                  {hasPrev ? (
                    <a href={pageLink(page - 1)} className="underline">← previous</a>
                  ) : (
                    <span className="text-neutral-400">← previous</span>
                  )}
                </div>
                <span className="text-neutral-500">page {page}</span>
                <div>
                  {hasNext ? (
                    <a href={pageLink(page + 1)} className="underline">next →</a>
                  ) : (
                    <span className="text-neutral-400">next →</span>
                  )}
                </div>
              </nav>
            )}

            <p className="mt-3 text-[11px] text-neutral-500">
              Discovery searches REAL persisted rows only. No AI intelligence layer is queried · no
              speculative results are fabricated · empty results are shown honestly.
            </p>
          </>
        )}
      </main>
    </NexNativeShell>
  );
}
