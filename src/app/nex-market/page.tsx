// src/app/nex-market/page.tsx · NEX Market · Products-only marketplace.
//
// Philip 2026-08-27 (revert): marketplace = things people SELL.
// Services are in /services/[category] · not merged here. The Shopee-style
// browse polish stays (category tiles, filter sidebar, sort, tag chips,
// denser cards) · but the tile bar and grid are scoped to product data only.
//
// Cross-links to /services/* live in a small "Explore local services" panel
// below the grid so users can discover the directory without confusing it
// with SKUs on sale.
//
// URL query params (products-only):
//   ?master=<key>     legacy master-category filter (electronics, fashion, etc.)
//   ?tag=<text>       tag/keyword filter on product name + category_label
//   ?city=<city>      city filter (mp_seller.city)
//   ?withImage=1      only products with images
//   ?condition=new|used
//   ?minPrice=<idr>   min price
//   ?maxPrice=<idr>   max price
//   ?sort=<mode>      'latest' | 'price-asc' | 'price-desc' | 'name'

import Link from "next/link";
import { listProducts, listCategories } from "@/lib/nex-shop/queries";
import { loadJobs } from "@/lib/nex-hq/workforce-jobs";

export const dynamic = "force-dynamic";

function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }

type SortMode = "latest" | "price-asc" | "price-desc" | "name";
const SORT_MODES: Array<{ key: SortMode; label: string }> = [
  { key: "latest",     label: "Latest" },
  { key: "price-asc",  label: "Price · low to high" },
  { key: "price-desc", label: "Price · high to low" },
  { key: "name",       label: "Name (A–Z)" },
];

interface FilterState {
  master:    string;
  tag:       string;
  city:      string;
  withImage: boolean;
  condition: "" | "new" | "used";
  minPrice:  number | null;
  maxPrice:  number | null;
  sort:      SortMode;
}

function parseSearchParams(sp: Record<string, string | undefined>): FilterState {
  const sortIn = (sp.sort ?? "").trim() as SortMode;
  const sort: SortMode = SORT_MODES.some((s) => s.key === sortIn) ? sortIn : "latest";
  const conditionIn = (sp.condition ?? "").trim();
  return {
    master:    (sp.master ?? "").trim(),
    tag:       (sp.tag ?? "").trim(),
    city:      (sp.city ?? "").trim(),
    withImage: sp.withImage === "1" || sp.withImage === "true",
    condition: conditionIn === "new" || conditionIn === "used" ? conditionIn : "",
    minPrice:  sp.minPrice ? Math.max(0, parseInt(sp.minPrice, 10) || 0) : null,
    maxPrice:  sp.maxPrice ? Math.max(0, parseInt(sp.maxPrice, 10) || 0) : null,
    sort,
  };
}

function buildHref(base: FilterState, override: Partial<FilterState>): string {
  const merged = { ...base, ...override };
  const parts: string[] = [];
  if (merged.master)    parts.push(`master=${encodeURIComponent(merged.master)}`);
  if (merged.tag)       parts.push(`tag=${encodeURIComponent(merged.tag)}`);
  if (merged.city)      parts.push(`city=${encodeURIComponent(merged.city)}`);
  if (merged.withImage) parts.push(`withImage=1`);
  if (merged.condition) parts.push(`condition=${merged.condition}`);
  if (merged.minPrice != null) parts.push(`minPrice=${merged.minPrice}`);
  if (merged.maxPrice != null) parts.push(`maxPrice=${merged.maxPrice}`);
  if (merged.sort && merged.sort !== "latest") parts.push(`sort=${merged.sort}`);
  return "/nex-market" + (parts.length > 0 ? `?${parts.join("&")}` : "");
}

export default async function NexMarketIndex({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}): Promise<React.JSX.Element> {
  const sp = (await searchParams) ?? {};
  const f = parseSearchParams(sp);

  const [products, productCategories] = await Promise.all([
    listProducts({ masterCategoryKey: f.master || undefined, searchQuery: f.tag || undefined }),
    listCategories(),
  ]);

  // Apply cross-filters in memory (small enough after SQL narrowing).
  let filtered = products;
  if (f.city)      filtered = filtered.filter((p) => p.city === f.city);
  if (f.withImage) filtered = filtered.filter((p) => !!p.primaryImage);
  if (f.condition) filtered = filtered.filter((p) => p.condition === f.condition);
  if (f.minPrice != null) filtered = filtered.filter((p) => p.minPriceIdr >= f.minPrice!);
  if (f.maxPrice != null) filtered = filtered.filter((p) => p.maxPriceIdr <= f.maxPrice!);
  if (f.sort === "price-asc")  filtered = [...filtered].sort((a, b) => a.minPriceIdr - b.minPriceIdr);
  if (f.sort === "price-desc") filtered = [...filtered].sort((a, b) => b.minPriceIdr - a.minPriceIdr);
  if (f.sort === "name")       filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

  const cities = Array.from(new Set(products.map((p) => p.city).filter(Boolean) as string[])).sort();

  // Service categories still loaded from Job Registry — but ONLY for the
  // "Explore local services" cross-link panel below the grid. NOT in the
  // main tile bar. Philip 2026-08-27: marketplace = products · services = directory.
  const serviceJobs = loadJobs().filter((j) => j.target_table === "nex.service_business");

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* Header */}
      <section style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 30, fontWeight: 600, margin: 0, marginBottom: 4, letterSpacing: "-0.02em" }}>
          NEX Market
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: 0 }}>
          Indonesia · products from real registered NEX sellers.{" "}
          <Link href="/services/gyms" style={{ color: "#dc2626", textDecoration: "underline" }}>
            Looking for local services instead?
          </Link>
        </p>
      </section>

      {/* Category tile carousel · PRODUCT categories only */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 4px", scrollSnapType: "x mandatory" }}>
          <CategoryTile href={buildHref(f, { master: "" })} active={f.master === ""} emoji="🛍️" label="All products" count={products.length} />
          {productCategories.map((c) => (
            <CategoryTile
              key={c.categoryId}
              href={buildHref(f, { master: c.key })}
              active={f.master === c.key}
              emoji={emojiForProductCategory(c.key)}
              label={c.label}
            />
          ))}
        </div>
      </section>

      {/* Two-column layout · filter sidebar + grid */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        {/* Filter sidebar */}
        <aside style={{ position: "sticky", top: 24, alignSelf: "start", background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a8776", marginBottom: 12, fontWeight: 600 }}>Filters</div>

          <FilterBlock label="City">
            <select defaultValue={f.city} name="city" form="market-filters-form" style={selectStyle}>
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterBlock>

          <FilterBlock label="Photo">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked={f.withImage} name="withImage" value="1" form="market-filters-form" />
              With image only
            </label>
          </FilterBlock>

          <FilterBlock label="Condition">
            <select defaultValue={f.condition} name="condition" form="market-filters-form" style={selectStyle}>
              <option value="">Any</option>
              <option value="new">New</option>
              <option value="used">Used</option>
            </select>
          </FilterBlock>

          <FilterBlock label="Price range · IDR">
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" defaultValue={f.minPrice ?? ""} placeholder="Min" name="minPrice" form="market-filters-form" style={{ ...inputStyle, width: "50%" }} />
              <input type="number" defaultValue={f.maxPrice ?? ""} placeholder="Max" name="maxPrice" form="market-filters-form" style={{ ...inputStyle, width: "50%" }} />
            </div>
          </FilterBlock>

          <form id="market-filters-form" method="GET" action="/nex-market">
            <input type="hidden" name="master" value={f.master} />
            <input type="hidden" name="tag" value={f.tag} />
            <input type="hidden" name="sort" value={f.sort} />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button type="submit" style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Apply filters
              </button>
              <Link href={buildHref(f, { city: "", withImage: false, condition: "", minPrice: null, maxPrice: null })}
                    style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", background: "#fff", color: "#666", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>
                Clear
              </Link>
            </div>
          </form>

          {f.tag && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8a8776", marginBottom: 6 }}>Tag filter</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ padding: "3px 10px", background: "#fef3c7", color: "#78350f", borderRadius: 999, fontSize: 12, fontWeight: 500 }}>#{f.tag}</span>
                <Link href={buildHref(f, { tag: "" })} style={{ fontSize: 11, color: "#8a8776", textDecoration: "underline" }}>clear</Link>
              </div>
            </div>
          )}
        </aside>

        {/* Grid + sort */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>
              {filtered.length === 0 ? "No products match" : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#666" }}>
              <span>Sort:</span>
              {SORT_MODES.map((s) => (
                <Link key={s.key} href={buildHref(f, { sort: s.key })} style={{
                  padding: "4px 10px", borderRadius: 6, textDecoration: "none",
                  background: f.sort === s.key ? "#1a1a1a" : "transparent",
                  color: f.sort === s.key ? "#fff" : "#666",
                  fontWeight: f.sort === s.key ? 600 : 400,
                }}>{s.label}</Link>
              ))}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div style={gridStyle}>
              {filtered.map((p) => {
                const outOfStock = p.totalStock <= 0;
                const isRange = p.minPriceIdr !== p.maxPriceIdr;
                return (
                  <article key={p.productId} style={cardStyle}>
                    <Link href={`/nex-market/product/${p.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                      <div style={{
                        position: "relative", aspectRatio: "1/1", background: "#f4f1eb",
                        backgroundImage: p.primaryImage ? `url("${p.primaryImage}")` : undefined,
                        backgroundSize: "cover", backgroundPosition: "center",
                      }}>
                        {outOfStock && (
                          <span style={{ position: "absolute", top: 6, left: 6, padding: "2px 7px", background: "rgba(165,32,32,0.9)", color: "#fff", fontSize: 10, fontWeight: 500, borderRadius: 999 }}>Out of stock</span>
                        )}
                        {p.condition === "used" && (
                          <span style={{ position: "absolute", top: 6, right: 6, padding: "2px 7px", background: "rgba(255,255,255,0.95)", color: "#8a8776", fontSize: 10, fontWeight: 500, borderRadius: 999 }}>Used</span>
                        )}
                      </div>
                    </Link>
                    <div style={{ padding: 10 }}>
                      <Link href={`/nex-market/product/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: "#1a1a1a", minHeight: 34, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>
                          {fmtIdr(p.minPriceIdr)}
                          {isRange && <span style={{ fontSize: 11, fontWeight: 400, color: "#8a8776", marginLeft: 3 }}>–{fmtIdr(p.maxPriceIdr)}</span>}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "#8a8776" }}>
                          📍 {p.sellerDisplayName}{p.city ? ` · ${p.city}` : ""}
                        </div>
                      </Link>
                      {p.categoryLabel && (
                        <div style={{ marginTop: 6 }}>
                          <Link href={buildHref(f, { tag: p.categoryLabel! })} style={tagChipStyle(f.tag.toLowerCase() === p.categoryLabel.toLowerCase())}>
                            #{p.categoryLabel}
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>No products match your filters.</div>
              <Link href="/nex-market" style={{ fontSize: 12, color: "#dc2626", textDecoration: "underline" }}>Clear all filters</Link>
            </div>
          )}

          {/* Cross-link panel to services directory · not merged into grid */}
          <section style={{ marginTop: 40, padding: 20, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#8a8776", marginBottom: 4, fontWeight: 600 }}>
              Not shopping today?
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>
              Explore local services in Indonesia
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {serviceJobs.map((j) => (
                <Link key={j.category_slug} href={`/services/${j.category_slug}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", background: "#faf7f2",
                  border: "1px solid rgba(0,0,0,0.06)", borderRadius: 999,
                  textDecoration: "none", color: "#333", fontSize: 13, fontWeight: 500,
                }}>
                  <span>{j.emoji}</span>
                  <span>{j.name}</span>
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#8a8776" }}>
              Also available: <Link href="/accommodation" style={{ color: "#dc2626" }}>🏨 Hotels & guesthouses</Link> · <Link href="/food" style={{ color: "#dc2626" }}>🍜 Restaurants & cafés</Link>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

// ── Emoji per legacy product master category · best-effort mapping ──────

function emojiForProductCategory(key: string): string {
  const map: Record<string, string> = {
    electronics: "📱", phones: "📱", computers: "💻",
    fashion: "👗", furniture: "🛋️", home: "🏠",
    appliances: "🔌", building_hardware: "🧱", tools: "🔧",
    motorbike: "🏍️", parts_accessories: "⚙️",
    food_beverage: "🥐", beauty: "💄", sports: "⚽",
  };
  return map[key] ?? "🛒";
}

// ── Small components ────────────────────────────────────────────────

function CategoryTile({ href, active, emoji, label, count }: { href: string; active: boolean; emoji: string; label: string; count?: number }) {
  return (
    <Link href={href} style={{
      flex: "0 0 auto", minWidth: 88, padding: "12px 10px",
      background: active ? "#1a1a1a" : "#fff",
      color: active ? "#fff" : "#333",
      border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12,
      textDecoration: "none", textAlign: "center", scrollSnapAlign: "start",
    }}>
      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 4 }}>{emoji}</div>
      <div style={{ fontSize: 11, fontWeight: active ? 600 : 500 }}>{label}</div>
      {count != null && count > 0 && (
        <div style={{ fontSize: 9, marginTop: 2, opacity: 0.65 }}>{count.toLocaleString("en-GB")}</div>
      )}
    </Link>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#666", marginBottom: 6, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 10,
};
const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, overflow: "hidden",
  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
};
function tagChipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 6px", fontSize: 10, fontWeight: 500, borderRadius: 4,
    background: active ? "#1a1a1a" : "rgba(0,0,0,0.05)",
    color: active ? "#fff" : "#666", textDecoration: "none",
  };
}
const selectStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
};
const inputStyle: React.CSSProperties = {
  padding: "6px 8px", fontSize: 12, borderRadius: 6,
  border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
};
