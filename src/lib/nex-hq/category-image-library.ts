// src/lib/nex-hq/category-image-library.ts
//
// NEX HQ · Category Image Library data + Server Actions · Philip 2026-08-27 (E).
//
// The library is where Philip stores curated per-category fallback images.
// This module provides:
//   · loadLibrary()      — read all rows for HQ display
//   · addImage(...)      — Server Action: add a new library entry
//   · toggleActive(...)  — Server Action: soft-delete / reactivate
//   · deleteImage(...)   — Server Action: hard-delete

"use server";

import { getFoodDbPool } from "@/lib/nex-food/db";
import { revalidatePath } from "next/cache";

export interface LibraryRow {
  id: string;
  category_slug: string;
  variant_tag: string | null;
  url: string;
  attribution: string | null;
  licence: string | null;
  intrinsic_width: number | null;
  intrinsic_height: number | null;
  priority: number;
  active: boolean;
  notes: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function loadLibrary(): Promise<LibraryRow[]> {
  const pool = getFoodDbPool();
  const r = await pool.query<LibraryRow>(
    `SELECT id::text, category_slug, variant_tag, url, attribution, licence,
            intrinsic_width, intrinsic_height, priority, active, notes, added_by,
            created_at::text, updated_at::text
       FROM nex.category_image_library
      ORDER BY category_slug, priority ASC, created_at DESC`,
  );
  return r.rows;
}

export async function addImage(input: {
  category_slug: string;
  variant_tag?: string | null;
  url: string;
  attribution?: string | null;
  licence?: string | null;
  intrinsic_width?: number | null;
  intrinsic_height?: number | null;
  priority?: number;
  notes?: string | null;
}): Promise<{ id: string }> {
  const pool = getFoodDbPool();

  // Basic input hygiene · schema CHECK constraints back this up.
  if (!/^([a-z][a-z0-9-]*|\*)$/.test(input.category_slug)) {
    throw new Error(`category_slug must be lowercase-hyphenated or '*', got "${input.category_slug}"`);
  }
  if (input.variant_tag && !/^[a-z][a-z0-9-]*$/.test(input.variant_tag)) {
    throw new Error(`variant_tag must be lowercase-hyphenated, got "${input.variant_tag}"`);
  }
  if (!/^https?:\/\//i.test(input.url)) throw new Error("url must be http(s)");

  const r = await pool.query<{ id: string }>(
    `INSERT INTO nex.category_image_library
       (category_slug, variant_tag, url, attribution, licence,
        intrinsic_width, intrinsic_height, priority, notes, added_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 100), $9, 'hq-admin')
     RETURNING id::text`,
    [
      input.category_slug,
      input.variant_tag ?? null,
      input.url,
      input.attribution ?? null,
      input.licence ?? null,
      input.intrinsic_width ?? null,
      input.intrinsic_height ?? null,
      input.priority,
      input.notes ?? null,
    ],
  );
  revalidatePath("/nex-head-quarters/category-images");
  return { id: r.rows[0].id };
}

export async function toggleActive(id: string, active: boolean): Promise<void> {
  const pool = getFoodDbPool();
  await pool.query(
    `UPDATE nex.category_image_library
        SET active = $2, updated_at = now()
      WHERE id = $1::uuid`,
    [id, active],
  );
  revalidatePath("/nex-head-quarters/category-images");
}

export async function deleteImage(id: string): Promise<void> {
  const pool = getFoodDbPool();
  await pool.query(`DELETE FROM nex.category_image_library WHERE id = $1::uuid`, [id]);
  revalidatePath("/nex-head-quarters/category-images");
}
