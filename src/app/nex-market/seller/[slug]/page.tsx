// src/app/nex-market/seller/[slug]/page.tsx

import Link from "next/link";
import { notFound } from "next/navigation";
import { getSellerBySlug, listProducts } from "@/lib/nex-shop/queries";

export const dynamic = "force-dynamic";

interface Params { slug: string }

function fmtIdr(n: number): string { return "Rp " + n.toLocaleString("id-ID"); }

export default async function SellerShopPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const [seller, allProducts] = await Promise.all([getSellerBySlug(slug), listProducts()]);
  if (!seller) notFound();
  const products = allProducts.filter((p) => p.sellerId === seller.sellerId);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 96px" }}>
      <div style={{ marginBottom: 16, fontSize: 13, color: "#8a8776" }}>
        <Link href="/nex-market" style={{ color: "#8a8776", textDecoration: "none" }}>← NEX Market</Link>
      </div>
      <header style={{
        background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 16, padding: 28, marginBottom: 28,
        display: "flex", alignItems: "center", gap: 24, boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 999, background: "#1a1a1a", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700,
        }}>
          {seller.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>{seller.displayName}</h1>
          <div style={{ fontSize: 13, color: "#8a8776", marginTop: 6 }}>
            {seller.city ? `📍 ${seller.city}` : ""}
            <span style={{ marginLeft: seller.city ? 8 : 0, padding: "2px 10px", background: seller.status === "active" ? "#e8f5e9" : "#f5f5f5",
              color: seller.status === "active" ? "#1f6b1f" : "#8a8776", borderRadius: 999, fontSize: 11, fontWeight: 500 }}>
              {seller.status}
            </span>
          </div>
          {seller.bio && <p style={{ marginTop: 10, fontSize: 13, color: "#555" }}>{seller.bio}</p>}
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{products.length} product{products.length === 1 ? "" : "s"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 18 }}>
          {products.map((p) => (
            <Link key={p.productId} href={`/nex-market/product/${p.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
              <article style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{
                  aspectRatio: "1/1", background: "#f4f1eb",
                  backgroundImage: p.primaryImage ? `url("${p.primaryImage}")` : undefined,
                  backgroundSize: "cover", backgroundPosition: "center",
                }} />
                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>
                    {p.minPriceIdr === p.maxPriceIdr ? fmtIdr(p.minPriceIdr) : `${fmtIdr(p.minPriceIdr)} – ${fmtIdr(p.maxPriceIdr)}`}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
