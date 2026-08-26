// src/app/nex-market/create-listing/page.tsx
// Server-rendered form + server action for creating a NEX Market listing.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getFoodDbPool } from "@/lib/nex-food/db";
import { loadCategoryTree } from "@/lib/nex-shop/queries";
import { validateQtyPriceTiers } from "@/lib/nex-shop/pricing";
import CategoryCascade from "./CategoryCascade";
import QuantityPricingEditor from "./QuantityPricingEditor";

export const dynamic = "force-dynamic";

async function slugify(s: string): Promise<string> {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
}

async function createListing(formData: FormData): Promise<void> {
  "use server";
  const pool = getFoodDbPool();
  if (!pool) throw new Error("no db");

  const name        = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryId  = String(formData.get("categoryId") ?? "").trim() || null;
  const condition   = String(formData.get("condition") ?? "new");
  const imageUrl    = String(formData.get("imageUrl") ?? "").trim() || null;
  const hasVariants = formData.get("hasVariants") === "on";

  const basePrice = formData.get("basePrice") ? parseInt(String(formData.get("basePrice")), 10) : null;
  const baseStock = formData.get("baseStock") ? parseInt(String(formData.get("baseStock")), 10) : null;
  const baseSku   = String(formData.get("baseSku") ?? "").trim() || null;

  if (!name) throw new Error("Product name required");

  // Quantity pricing tiers · JSON string from client editor · validated
  // triple-defence (client → server → DB CHECK).
  let qtyTiersJson: string = "[]";
  const rawTiers = String(formData.get("qtyPriceTiers") ?? "[]").trim();
  if (!hasVariants && rawTiers && rawTiers !== "[]") {
    if (basePrice === null || !Number.isFinite(basePrice) || basePrice <= 0) {
      throw new Error("Base price required when quantity pricing tiers are set");
    }
    let parsed: unknown;
    try { parsed = JSON.parse(rawTiers); }
    catch { throw new Error("Quantity pricing tiers were not valid JSON"); }
    const v = validateQtyPriceTiers(parsed, basePrice);
    if (!v.ok) throw new Error(`Quantity pricing invalid: ${v.error}`);
    qtyTiersJson = JSON.stringify(v.tiers);
  }

  const seller = await pool.query(`SELECT seller_id FROM nex.mp_seller WHERE slug = 'toko-nex-demo'`);
  if (seller.rowCount === 0) throw new Error("Demo seller not seeded · run the seeder first");
  const sellerId = seller.rows[0].seller_id;

  const slug = await slugify(name);
  const p = await pool.query(
    `INSERT INTO nex.mp_product (seller_id, category_id, slug, name, description, condition, has_variants, base_price_idr, base_stock, base_sku, qty_price_tiers, active)
     VALUES ($1,$2,$3,$4,$5,$6::nex.mp_product_condition,$7,$8,$9,$10,$11::jsonb,true) RETURNING product_id, slug`,
    [sellerId, categoryId, slug, name, description, condition, hasVariants, hasVariants ? null : basePrice, hasVariants ? null : baseStock, hasVariants ? null : baseSku, qtyTiersJson],
  );
  const productId = p.rows[0].product_id;
  const productSlug = p.rows[0].slug;

  if (imageUrl) {
    await pool.query(`INSERT INTO nex.mp_product_image (product_id, url, sort_order) VALUES ($1,$2,10)`, [productId, imageUrl]);
  }

  if (hasVariants) {
    // Parse option lines: "Color: Black, White" · "Size: S, M, L"
    const optionLines = String(formData.get("options") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const optionValueIdsByName: Record<string, Record<string, string>> = {};
    for (let i = 0; i < optionLines.length; i++) {
      const line = optionLines[i];
      const [rawName, rawValues] = line.split(":", 2);
      const optName = rawName.trim();
      const values  = (rawValues ?? "").split(",").map((v) => v.trim()).filter(Boolean);
      if (!optName || values.length === 0) continue;
      const optRow = await pool.query(
        `INSERT INTO nex.mp_product_option (product_id, name, sort_order) VALUES ($1,$2,$3) RETURNING option_id`,
        [productId, optName, (i + 1) * 10],
      );
      const optId = optRow.rows[0].option_id;
      optionValueIdsByName[optName] = {};
      for (let j = 0; j < values.length; j++) {
        const vRow = await pool.query(
          `INSERT INTO nex.mp_product_option_value (option_id, value, sort_order) VALUES ($1,$2,$3) RETURNING option_value_id`,
          [optId, values[j], (j + 1) * 10],
        );
        optionValueIdsByName[optName][values[j].toLowerCase()] = vRow.rows[0].option_value_id;
      }
    }
    // Parse variant lines: "Black|L|NEX-BLK-L|150000|8" (values separated by |)
    const variantLines = String(formData.get("variants") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const optionNames = optionLines.map((l) => l.split(":", 1)[0].trim());
    for (const vLine of variantLines) {
      const parts = vLine.split("|").map((p) => p.trim());
      // Expect: value1|value2|...|SKU|price|stock
      if (parts.length < optionNames.length + 3) continue;
      const chosenValues = parts.slice(0, optionNames.length);
      const sku = parts[optionNames.length];
      const price = parseInt(parts[optionNames.length + 1], 10);
      const stock = parseInt(parts[optionNames.length + 2], 10);
      if (!sku || !Number.isFinite(price) || !Number.isFinite(stock)) continue;
      const valueIds = chosenValues.map((v, i) => optionValueIdsByName[optionNames[i]]?.[v.toLowerCase()]).filter(Boolean);
      if (valueIds.length !== optionNames.length) continue;
      const sortedIds = [...valueIds].sort();
      await pool.query(
        `INSERT INTO nex.mp_product_variant (product_id, sku, price_idr, stock, active, option_value_ids)
         VALUES ($1,$2,$3,$4,true,$5::uuid[])`,
        [productId, sku, price, stock, sortedIds],
      );
    }
  }

  redirect(`/nex-market/product/${productSlug}`);
}

export default async function CreateListingPage(): Promise<React.JSX.Element> {
  const categoryTree = await loadCategoryTree();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 16, fontSize: 13, color: "#8a8776" }}>
        <Link href="/nex-market" style={{ color: "#8a8776" }}>← NEX Market</Link>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 600, marginBottom: 4 }}>Create listing</h1>
      <p style={{ color: "#8a8776", fontSize: 13, marginBottom: 24 }}>
        Demo listing · attributed to the seed seller <strong>Toko NEX Demo</strong>.
      </p>

      <form action={createListing} style={{ display: "grid", gap: 16 }}>
        <Field label="Product name" name="name" required />
        <Field label="Description" name="description" as="textarea" />
        <Field label="Image URL (optional)" name="imageUrl" placeholder="https://..." />

        <CategoryCascade tree={categoryTree} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <Field label="Condition" name="condition" as="select" options={[{ value: "new", label: "New" }, { value: "used", label: "Used" }, { value: "refurbished", label: "Refurbished" }]} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
          <input type="checkbox" name="hasVariants" /> This product has variants
        </label>

        <fieldset style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <legend style={{ fontSize: 12, color: "#8a8776", padding: "0 6px" }}>If NO variants · fill these</legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Base price (IDR)" name="basePrice" type="number" />
            <Field label="Base stock" name="baseStock" type="number" />
            <Field label="Base SKU" name="baseSku" />
          </div>
          <div style={{ height: 18 }} />
          <QuantityPricingEditor />
        </fieldset>

        <fieldset style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
          <legend style={{ fontSize: 12, color: "#8a8776", padding: "0 6px" }}>If YES variants · fill these</legend>
          <Field
            label="Options (one per line · &lsquo;Name: Value1, Value2&rsquo;)"
            name="options"
            as="textarea"
            placeholder={"Color: Black, White\nSize: S, M, L"}
            rows={4}
          />
          <div style={{ height: 12 }} />
          <Field
            label="Variants (one per line · &lsquo;Value1|Value2|SKU|PriceIDR|Stock&rsquo;)"
            name="variants"
            as="textarea"
            placeholder={"Black|L|NEX-BLK-L|150000|8\nWhite|XL|NEX-WHT-XL|155000|3"}
            rows={5}
          />
        </fieldset>

        <button type="submit" style={{
          padding: "12px 20px", background: "#1a1a1a", color: "#fff",
          border: "none", borderRadius: 999, fontSize: 14, fontWeight: 500, cursor: "pointer",
        }}>
          Save listing
        </button>
      </form>
    </main>
  );
}

function Field({
  label, name, as = "input", type = "text", placeholder, required, options, rows,
}: {
  label: string; name: string;
  as?: "input" | "textarea" | "select";
  type?: string; placeholder?: string; required?: boolean;
  options?: { value: string; label: string }[];
  rows?: number;
}): React.JSX.Element {
  const style = { padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box" as const, fontFamily: "inherit" };
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, color: "#8a8776", marginBottom: 6 }}>{label}</div>
      {as === "textarea" ? (
        <textarea name={name} required={required} placeholder={placeholder} rows={rows ?? 3} style={{ ...style, resize: "vertical" }} />
      ) : as === "select" ? (
        <select name={name} style={style} defaultValue="">
          <option value="">—</option>
          {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input name={name} type={type} required={required} placeholder={placeholder} style={style} />
      )}
    </label>
  );
}
