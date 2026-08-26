// src/lib/nex-shop/queries.ts
//
// Server-side queries for the NEX Marketplace slice. Reads only.

import { getFoodDbPool } from "@/lib/nex-food/db";
import type { Product, Seller, Category } from "./types";

export interface ProductListItem {
  productId: string;
  slug: string;
  name: string;
  sellerId: string;
  sellerSlug: string;
  sellerDisplayName: string;
  city: string | null;
  categoryLabel: string | null;
  minPriceIdr: number;
  maxPriceIdr: number;
  totalStock: number;
  primaryImage: string | null;
  condition: string;
}

export interface ListProductsArgs {
  masterCategoryKey?: string;
  searchQuery?: string;
}

export async function listProducts(args: ListProductsArgs = {}): Promise<ProductListItem[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  const where: string[] = ["p.active"];
  const params: unknown[] = [];
  if (args.masterCategoryKey && args.masterCategoryKey.trim().length > 0) {
    params.push(args.masterCategoryKey);
    params.push(`${args.masterCategoryKey}/%`);
    where.push(`(c.key = $${params.length - 1} OR c.key LIKE $${params.length})`);
  }
  if (args.searchQuery && args.searchQuery.trim().length > 0) {
    params.push(`%${args.searchQuery.trim()}%`);
    where.push(`p.name ILIKE $${params.length}`);
  }
  const q = await pool.query(`
    WITH prices AS (
      SELECT p.product_id,
             CASE WHEN p.has_variants THEN COALESCE(MIN(v.price_idr), 0) ELSE p.base_price_idr END AS min_p,
             CASE WHEN p.has_variants THEN COALESCE(MAX(v.price_idr), 0) ELSE p.base_price_idr END AS max_p,
             CASE WHEN p.has_variants THEN COALESCE(SUM(v.stock), 0)     ELSE p.base_stock     END AS total_stock
        FROM nex.mp_product p
        LEFT JOIN nex.mp_product_variant v ON v.product_id = p.product_id AND v.active
       WHERE p.active
       GROUP BY p.product_id
    ),
    imgs AS (
      SELECT product_id, url
        FROM (
          SELECT product_id, url,
                 ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY sort_order, image_id) AS rn
            FROM nex.mp_product_image
        ) t WHERE rn = 1
    )
    SELECT p.product_id, p.slug, p.name, p.condition, p.seller_id,
           s.slug AS seller_slug, s.display_name AS seller_display_name, s.city,
           c.label AS category_label,
           pr.min_p AS min_price, pr.max_p AS max_price, pr.total_stock,
           i.url AS primary_image
      FROM nex.mp_product p
      JOIN nex.mp_seller s ON s.seller_id = p.seller_id
      LEFT JOIN nex.mp_category c ON c.category_id = p.category_id
      JOIN prices pr ON pr.product_id = p.product_id
      LEFT JOIN imgs   i  ON i.product_id  = p.product_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC
  `, params);
  return q.rows.map((r: Record<string, unknown>) => ({
    productId: String(r.product_id),
    slug: String(r.slug),
    name: String(r.name),
    condition: String(r.condition),
    sellerId: String(r.seller_id),
    sellerSlug: String(r.seller_slug),
    sellerDisplayName: String(r.seller_display_name),
    city: r.city ? String(r.city) : null,
    categoryLabel: r.category_label ? String(r.category_label) : null,
    minPriceIdr: Number(r.min_price ?? 0),
    maxPriceIdr: Number(r.max_price ?? 0),
    totalStock: Number(r.total_stock ?? 0),
    primaryImage: r.primary_image ? String(r.primary_image) : null,
  }));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const pool = getFoodDbPool();
  if (!pool) return null;
  const p = await pool.query(`SELECT * FROM nex.mp_product WHERE slug = $1 AND active`, [slug]);
  if (p.rowCount === 0) return null;
  const row = p.rows[0] as Record<string, unknown>;
  const productId = String(row.product_id);

  const [imgs, options, variants] = await Promise.all([
    pool.query(`SELECT * FROM nex.mp_product_image WHERE product_id=$1 ORDER BY sort_order`, [productId]),
    pool.query(`SELECT * FROM nex.mp_product_option WHERE product_id=$1 ORDER BY sort_order`, [productId]),
    pool.query(`SELECT * FROM nex.mp_product_variant WHERE product_id=$1`, [productId]),
  ]);
  const optionIds = options.rows.map((o: Record<string, unknown>) => String(o.option_id));
  const values = optionIds.length === 0
    ? { rows: [] }
    : await pool.query(`SELECT * FROM nex.mp_product_option_value WHERE option_id = ANY($1::uuid[]) ORDER BY sort_order`, [optionIds]);
  const valueByOption = new Map<string, Record<string, unknown>[]>();
  for (const v of (values as { rows: Record<string, unknown>[] }).rows) {
    const oid = String(v.option_id);
    if (!valueByOption.has(oid)) valueByOption.set(oid, []);
    valueByOption.get(oid)!.push(v);
  }

  const rawTiers = Array.isArray(row.qty_price_tiers) ? row.qty_price_tiers as unknown[] : [];
  const qtyPriceTiers = rawTiers
    .map((t) => {
      const r = t as Record<string, unknown>;
      return { minQty: Number(r.minQty), pricePerUnitIdr: Number(r.pricePerUnitIdr) };
    })
    .filter((t) => Number.isFinite(t.minQty) && Number.isFinite(t.pricePerUnitIdr));

  return {
    productId,
    sellerId: String(row.seller_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    slug: String(row.slug),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    condition: row.condition as Product["condition"],
    hasVariants: Boolean(row.has_variants),
    basePriceIdr: row.base_price_idr == null ? null : Number(row.base_price_idr),
    baseStock: row.base_stock == null ? null : Number(row.base_stock),
    baseSku: row.base_sku ? String(row.base_sku) : null,
    active: Boolean(row.active),
    qtyPriceTiers,
    images: imgs.rows.map((i: Record<string, unknown>) => ({
      imageId: String(i.image_id),
      url: String(i.url),
      sortOrder: Number(i.sort_order),
      altText: i.alt_text ? String(i.alt_text) : null,
    })),
    options: options.rows.map((o: Record<string, unknown>) => ({
      optionId: String(o.option_id),
      productId,
      name: String(o.name),
      sortOrder: Number(o.sort_order),
      values: (valueByOption.get(String(o.option_id)) ?? []).map((v) => ({
        optionValueId: String(v.option_value_id),
        optionId: String(v.option_id),
        value: String(v.value),
        sortOrder: Number(v.sort_order),
      })),
    })),
    variants: variants.rows.map((v: Record<string, unknown>) => ({
      variantId: String(v.variant_id),
      productId,
      sku: String(v.sku),
      priceIdr: Number(v.price_idr),
      stock: Number(v.stock),
      active: Boolean(v.active),
      optionValueIds: (v.option_value_ids as string[]).map(String),
    })),
  };
}

export async function getSellerById(id: string): Promise<Seller | null> {
  const pool = getFoodDbPool();
  if (!pool) return null;
  const q = await pool.query(`SELECT * FROM nex.mp_seller WHERE seller_id=$1`, [id]);
  if (q.rowCount === 0) return null;
  const r = q.rows[0] as Record<string, unknown>;
  return {
    sellerId: String(r.seller_id),
    slug: String(r.slug),
    displayName: String(r.display_name),
    city: r.city ? String(r.city) : null,
    jurisdiction: String(r.jurisdiction),
    status: r.status as Seller["status"],
    bio: r.bio ? String(r.bio) : null,
    logoImageRef: r.logo_image_ref ? String(r.logo_image_ref) : null,
    coverImageRef: r.cover_image_ref ? String(r.cover_image_ref) : null,
  };
}

export async function getSellerBySlug(slug: string): Promise<Seller | null> {
  const pool = getFoodDbPool();
  if (!pool) return null;
  const q = await pool.query(`SELECT * FROM nex.mp_seller WHERE slug=$1`, [slug]);
  if (q.rowCount === 0) return null;
  const r = q.rows[0] as Record<string, unknown>;
  return {
    sellerId: String(r.seller_id),
    slug: String(r.slug),
    displayName: String(r.display_name),
    city: r.city ? String(r.city) : null,
    jurisdiction: String(r.jurisdiction),
    status: r.status as Seller["status"],
    bio: r.bio ? String(r.bio) : null,
    logoImageRef: r.logo_image_ref ? String(r.logo_image_ref) : null,
    coverImageRef: r.cover_image_ref ? String(r.cover_image_ref) : null,
  };
}

// Per-city seller directory (2026-08-24) · used by /nex-market/city/[city].
// Reads mp_seller filtered by jurisdiction · returns discovered sellers +
// their status. This is the market side of "one reusable city template."
export interface SellerCityListing {
  sellerId: string;
  slug: string;
  displayName: string;
  city: string | null;
  jurisdiction: string;
  status: string;               // discovered · claimable · claimed · registered · verified · active
  bio: string | null;
  productCount: number;
}

export async function listSellersByCityCanonical(canonicalCity: string): Promise<SellerCityListing[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  // Jurisdiction stored as e.g. "ID/DIY/Sleman" · match by SUFFIX (city segment)
  // Case + hyphen tolerant: "Kulon Progo" ↔ "ID/DIY/Kulon-Progo"
  const suffixCandidates = [canonicalCity, canonicalCity.replace(/ /g, "-")];
  const q = await pool.query(
    `SELECT s.seller_id, s.slug, s.display_name, s.city, s.jurisdiction, s.status, s.bio,
            (SELECT COUNT(*)::int FROM nex.mp_product p WHERE p.seller_id = s.seller_id AND p.active) AS product_count
       FROM nex.mp_seller s
      WHERE s.jurisdiction ILIKE '%/' || $1 || '' OR s.jurisdiction ILIKE '%/' || $2 || ''
      ORDER BY (s.status = 'active') DESC, product_count DESC, s.display_name ASC
      LIMIT 500`,
    suffixCandidates,
  );
  return q.rows.map((r: Record<string, unknown>) => ({
    sellerId:     String(r.seller_id),
    slug:         String(r.slug),
    displayName:  String(r.display_name),
    city:         r.city ? String(r.city) : null,
    jurisdiction: String(r.jurisdiction),
    status:       String(r.status),
    bio:          r.bio ? String(r.bio) : null,
    productCount: Number(r.product_count ?? 0),
  }));
}

export async function listCategories(): Promise<Category[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  // Only master (level=1) rows for card chips · full hierarchy via loadCategoryTree
  const q = await pool.query(`SELECT * FROM nex.mp_category WHERE level = 1 ORDER BY sort_order, label`);
  return q.rows.map((r: Record<string, unknown>) => ({
    categoryId: String(r.category_id),
    key: String(r.key),
    label: String(r.label),
    parentId: r.parent_id ? String(r.parent_id) : null,
    sortOrder: Number(r.sort_order),
  }));
}

// ── 3-level hierarchy loader (for cascade dropdowns + filter drilldown) ─
export interface CategoryTreeNode {
  categoryId: string;
  key: string;
  label: string;
  level: number;
  parentId: string | null;
  path: string | null;
  sortOrder: number;
  children: CategoryTreeNode[];
}

export async function loadCategoryTree(): Promise<CategoryTreeNode[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  const q = await pool.query(`
    SELECT category_id, key, label, level, parent_id, path, sort_order
      FROM nex.mp_category
     WHERE level IS NOT NULL
     ORDER BY level, sort_order, label
  `);
  const nodes = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];
  for (const r of q.rows as Record<string, unknown>[]) {
    nodes.set(String(r.category_id), {
      categoryId: String(r.category_id),
      key: String(r.key),
      label: String(r.label),
      level: Number(r.level),
      parentId: r.parent_id ? String(r.parent_id) : null,
      path: r.path ? String(r.path) : null,
      sortOrder: Number(r.sort_order),
      children: [],
    });
  }
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) nodes.get(node.parentId)!.children.push(node);
    else if (node.level === 1) roots.push(node);
  }
  return roots;
}

export interface CommerceHqCounts {
  businessesDiscovered: number;
  registeredSellers: number;
  activeSellers: number;
  productsListed: number;
  variantsListed: number;
}

export async function getCommerceHqCounts(): Promise<CommerceHqCounts> {
  const pool = getFoodDbPool();
  if (!pool) return { businessesDiscovered: 0, registeredSellers: 0, activeSellers: 0, productsListed: 0, variantsListed: 0 };
  const q = await pool.query(`
    SELECT
      (SELECT count(*) FROM nex.mp_seller WHERE status = 'discovered') AS discovered,
      (SELECT count(*) FROM nex.mp_seller WHERE status = 'registered') AS registered,
      (SELECT count(*) FROM nex.mp_seller WHERE status = 'active')     AS active,
      (SELECT count(*) FROM nex.mp_product WHERE active)               AS products,
      (SELECT count(*) FROM nex.mp_product_variant WHERE active)       AS variants
  `);
  const r = q.rows[0] as Record<string, unknown>;
  return {
    businessesDiscovered: Number(r.discovered),
    registeredSellers: Number(r.registered),
    activeSellers: Number(r.active),
    productsListed: Number(r.products),
    variantsListed: Number(r.variants),
  };
}
