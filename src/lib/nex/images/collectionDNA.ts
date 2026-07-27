// Collection DNA reader — Rule #11 of ADR-0027.
//
// Loads data/nex-collection-dna.json and returns the transformation
// policy for a given collection_id. Used by:
//   - the parser to validate whether an image_type is allowed in
//     a collection
//   - image generation surfaces to load default rules ("make me a
//     hero image for the luxury_staircases collection" → NO TEXT
//     NO PRICES NO LOGO MAX QUALITY 1920x1080)
//   - the matcher to prefer images from a collection when a user
//     query targets that collection

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImageType } from "./knowledgeParser";

export type CollectionDNA = {
  collection_id: string;
  display_name: string;
  allowed_types: ImageType[];
  default_sizes: string[];
  allows_text: boolean;
  allows_prices: boolean;
  allows_whatsapp: boolean;
  allows_logo: boolean;
  requires_transparent: boolean;
  notes?: string;
};

let cached: Record<string, CollectionDNA> | null = null;
let cachedAt = 0;
const CACHE_MS = 5_000;

export async function loadCollectionDNA(
  force = false
): Promise<Record<string, CollectionDNA>> {
  if (!force && cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const p = path.join(process.cwd(), "data", "nex-collection-dna.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const parsed = JSON.parse(raw) as {
      collections?: Record<string, CollectionDNA>;
    };
    cached = parsed.collections ?? {};
    cachedAt = Date.now();
    return cached;
  } catch {
    cached = {};
    cachedAt = Date.now();
    return cached;
  }
}

export async function getCollectionDNA(
  collectionId: string
): Promise<CollectionDNA | undefined> {
  const all = await loadCollectionDNA();
  return all[collectionId];
}

/** Rule #11 validation — is an image_type allowed in this collection? */
export async function isImageTypeAllowedInCollection(
  collectionId: string,
  imageType: ImageType
): Promise<boolean> {
  const dna = await getCollectionDNA(collectionId);
  if (!dna) return true; // unknown collection = no restriction (yet)
  return dna.allowed_types.includes(imageType);
}
