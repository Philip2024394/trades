// src/app/nex-market/page.tsx · NEX Market grid (Hammer-quality card patterns · NEX theme).

import Link from "next/link";
import { listProducts, listCategories } from "@/lib/nex-shop/queries";

export const dynamic = "force-dynamic";

function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }

export default async function NexMarketIndex({ searchParams }: { searchParams?: Promise<{ master?: string; q?: string }> }): Promise<React.JSX.Element> {
  const sp = (await searchParams) ?? {};
  const [products, categories] = await Promise.all([
    listProducts({ masterCategoryKey: sp.master, searchQuery: sp.q }),
    listCategories(),
  ]);
  const activeMaster = sp.master ?? "";

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "36px 24px" }}>
      <section style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 36, fontWeight: 600, margin: 0, marginBottom: 8, letterSpacing: "-0.02em" }}>
          NEX Market
        </h1>
        <p style={{ color: "#666", fontSize: 15, marginBottom: 20 }}>
          Yogyakarta · products from real registered NEX sellers.
        </p>
        <div style={{
          background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14,
          padding: 14, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}>
          <span style={{ color: "#8a8776", fontSize: 14, paddingLeft: 6 }}>What are you looking for?</span>
          <input
            placeholder='"washing machine under 3 million" · "NMAX helmet" · "second-hand sofa"'
            disabled
            style={{ flex: 1, padding: "10px 12px", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, fontSize: 14, background: "#faf7f2" }}
          />
          <span style={{ fontSize: 12, color: "#8a8776", paddingRight: 6 }}>AI shopping coming next</span>
        </div>
      </section>

      <section style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Link href="/nex-market" style={{
            padding: "7px 14px",
            background: activeMaster === "" ? "#1a1a1a" : "#fff",
            color: activeMaster === "" ? "#fff" : "#333",
            border: "1px solid rgba(0,0,0,0.06)", borderRadius: 999,
            fontSize: 13, textDecoration: "none", fontWeight: activeMaster === "" ? 600 : 400,
          }}>All</Link>
          {categories.map((c) => (
            <Link key={c.categoryId} href={`/nex-market?master=${c.key}`} style={{
              padding: "7px 14px",
              background: activeMaster === c.key ? "#1a1a1a" : "#fff",
              color: activeMaster === c.key ? "#fff" : "#333",
              border: "1px solid rgba(0,0,0,0.06)", borderRadius: 999,
              fontSize: 13, textDecoration: "none", fontWeight: activeMaster === c.key ? 600 : 400,
            }}>
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "#1a1a1a" }}>
          {products.length === 0 ? "No listings yet" : `${products.length} listing${products.length === 1 ? "" : "s"}`}
        </h2>
        {products.length === 0 && (
          <p style={{ color: "#8a8776", fontSize: 14 }}>
            Run <code>node scripts/nex-shop/_seed-demo-products.mjs</code> to add the demo listings.
          </p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 18 }}>
          {products.map((p) => {
            const outOfStock = p.totalStock <= 0;
            const isRange = p.minPriceIdr !== p.maxPriceIdr;
            return (
              <Link key={p.productId} href={`/nex-market/product/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                <article style={{
                  background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14, overflow: "hidden",
                  transition: "transform .18s ease, box-shadow .18s ease",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                }}>
                  <div style={{
                    position: "relative",
                    aspectRatio: "1/1", background: "#f4f1eb",
                    backgroundImage: p.primaryImage ? `url("${p.primaryImage}")` : undefined,
                    backgroundSize: "cover", backgroundPosition: "center",
                  }}>
                    {outOfStock && (
                      <span style={{
                        position: "absolute", top: 10, left: 10,
                        padding: "4px 10px", background: "rgba(165,32,32,0.9)", color: "#fff",
                        fontSize: 11, fontWeight: 500, borderRadius: 999,
                      }}>Out of stock</span>
                    )}
                    {p.condition === "used" && (
                      <span style={{
                        position: "absolute", top: 10, right: 10,
                        padding: "4px 10px", background: "rgba(255,255,255,0.95)", color: "#8a8776",
                        fontSize: 11, fontWeight: 500, borderRadius: 999,
                      }}>Used</span>
                    )}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35, marginBottom: 8, minHeight: 38, color: "#1a1a1a" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>
                      {isRange ? fmtIdr(p.minPriceIdr) : fmtIdr(p.minPriceIdr)}
                      {isRange && <span style={{ fontSize: 12, fontWeight: 400, color: "#8a8776", marginLeft: 4 }}>
                        – {fmtIdr(p.maxPriceIdr)}
                      </span>}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#8a8776" }}>
                      {p.sellerDisplayName}
                      {p.city ? ` · ${p.city}` : ""}
                    </div>
                    {p.categoryLabel && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#8a8776" }}>{p.categoryLabel}</div>
                    )}
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
