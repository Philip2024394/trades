// src/app/nex-market/product/[slug]/page.tsx
// Hammer-quality PDP · NEX cream theme.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getSellerById } from "@/lib/nex-shop/queries";
import ProductGallery from "./ProductGallery";
import BuyColumn from "./BuyColumn";

export const dynamic = "force-dynamic";

interface Params { slug: string }

export default async function ProductPage({ params }: { params: Promise<Params> }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const seller = await getSellerById(product.sellerId);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 96px" }}>
      <div style={{ marginBottom: 20, fontSize: 13, color: "#8a8776" }}>
        <Link href="/nex-market" style={{ color: "#8a8776", textDecoration: "none" }}>← All listings</Link>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 1fr)",
        gap: 48,
      }}>
        {/* GALLERY column (Hammer ProductGallery pattern) */}
        <div>
          <ProductGallery images={product.images} productName={product.name} />
        </div>

        {/* BUY column (Hammer BuyColumn pattern) */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "sticky", top: 100 }}>
            <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {product.condition !== "new" && (
                <span style={{ padding: "3px 10px", background: "#fff", color: "#8a8776", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 999, fontSize: 11, fontWeight: 500 }}>
                  {product.condition === "used" ? "Used" : "Refurbished"}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 600, margin: 0, marginBottom: 10, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              {product.name}
            </h1>
            <div style={{ fontSize: 13, color: "#8a8776", marginBottom: 24 }}>
              Sold by{" "}
              {seller ? (
                <Link href={`/nex-market/seller/${seller.slug}`} style={{ color: "#1a1a1a", textDecoration: "underline" }}>
                  {seller.displayName}
                </Link>
              ) : "seller"}
              {seller?.city ? ` · ${seller.city}` : ""}
              {seller?.status && (
                <span style={{ marginLeft: 8, padding: "2px 8px", background: seller.status === "active" ? "#e8f5e9" : "#f5f5f5",
                  color: seller.status === "active" ? "#1f6b1f" : "#8a8776", borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                  {seller.status}
                </span>
              )}
            </div>
            {product.description && (
              <p style={{ fontSize: 14, color: "#444", marginBottom: 24, lineHeight: 1.6 }}>{product.description}</p>
            )}
            <BuyColumn product={product} />
          </div>
        </div>
      </div>

      {/* Section anchors (Hammer PDP pattern · lightweight) */}
      <section style={{ marginTop: 64, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Product details</h2>
        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>
          {product.description ?? "No additional description provided by the seller."}
        </p>
      </section>

      {product.variants.length > 0 && (
        <section style={{ marginTop: 40, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Available variants</h2>
          <div style={{ overflowX: "auto", background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#faf7f2", textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <th style={{ padding: "10px 14px" }}>SKU</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Price</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((v) => (
                  <tr key={v.variantId} style={{ borderBottom: "1px solid #f4f1eb" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>{v.sku}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>Rp {v.priceIdr.toLocaleString("id-ID")}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: v.stock > 0 ? "#1f6b1f" : "#a52020" }}>
                      {v.stock > 0 ? v.stock : "Sold out"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {seller && (
        <section style={{ marginTop: 40, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>About the seller</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, background: "#1a1a1a", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700,
            }}>
              {seller.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{seller.displayName}</div>
              {seller.city && <div style={{ fontSize: 12, color: "#8a8776" }}>📍 {seller.city}</div>}
            </div>
          </div>
          {seller.bio && <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{seller.bio}</p>}
          <Link href={`/nex-market/seller/${seller.slug}`} style={{
            display: "inline-block", marginTop: 12,
            padding: "8px 16px", border: "1px solid #1a1a1a", borderRadius: 999,
            fontSize: 13, color: "#1a1a1a", textDecoration: "none",
          }}>Visit shop →</Link>
        </section>
      )}
    </main>
  );
}
