// Site Board — server-side helpers.
//
// Cookie-scoped owner_key so anonymous visitors can save Site
// Interest images to a personal pinboard without a sign-up flow.
// The cookie carries an opaque uuid; every write validates the
// cookie identity against the row's owner_key.

import "server-only";
import { cookies } from "next/headers";
import { randomBytes, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const SITEBOARD_COOKIE_NAME = "siteboard_owner";
const OWNER_KEY_PREFIX = "cookie:";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export type SiteBoard = {
  id:             string;
  slug:           string;
  name:           string;
  description:    string | null;
  isPublic:       boolean;
  coverImageUrl:  string | null;
  itemCount:      number;
  createdAt:      string;
  updatedAt:      string;
};

export type SiteBoardItem = {
  id:          string;
  boardId:     string;
  imageUrl:    string;
  subject:     string | null;
  sourceJson:  Record<string, unknown>;
  note:        string | null;
  addedAt:     string;
};

/** Read the owner cookie without setting one. Returns null when the
 *  visitor has no cookie yet — caller decides whether to create one
 *  (writes always create, reads may not need to). */
export async function readSiteBoardOwnerKey(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SITEBOARD_COOKIE_NAME)?.value;
  if (!raw) return null;
  // Cookie value is the raw uuid; owner_key stored in DB has the
  // "cookie:" prefix so a future homeowner-auth migration can
  // distinguish anonymous rows from account-owned rows.
  return `${OWNER_KEY_PREFIX}${raw}`;
}

/** Ensure the visitor has an owner cookie set; return the owner_key
 *  ready for DB writes. Idempotent — reuses an existing cookie. */
export async function ensureSiteBoardOwnerKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(SITEBOARD_COOKIE_NAME)?.value;
  if (existing) return `${OWNER_KEY_PREFIX}${existing}`;
  const fresh = randomUUID();
  jar.set(SITEBOARD_COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    maxAge:   COOKIE_MAX_AGE_SECONDS
  });
  return `${OWNER_KEY_PREFIX}${fresh}`;
}

/** Random URL-safe slug for shareable board URLs. Not guessable —
 *  keeps unlisted boards effectively private even when is_public
 *  is left true. */
function generateBoardSlug(): string {
  return randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
}

// ─── Reads ────────────────────────────────────────────────────

/** Every board the current owner has created. Empty when the
 *  visitor has no cookie yet. */
export async function boardsForOwner(): Promise<SiteBoard[]> {
  const ownerKey = await readSiteBoardOwnerKey();
  if (!ownerKey) return [];
  const res = await supabaseAdmin
    .from("networkers_site_boards")
    .select("*")
    .eq("owner_key", ownerKey)
    .order("updated_at", { ascending: false });
  if (res.error || !res.data) return [];
  return res.data.map(shapeBoard);
}

/** Single board by slug (used by the public share URL). Returns
 *  null when not found OR when the board is private and the caller
 *  doesn't own it. */
export async function boardBySlug(slug: string): Promise<{ board: SiteBoard; items: SiteBoardItem[] } | null> {
  const boardRes = await supabaseAdmin
    .from("networkers_site_boards")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (boardRes.error || !boardRes.data) return null;
  const board = shapeBoard(boardRes.data);

  if (!board.isPublic) {
    const ownerKey = await readSiteBoardOwnerKey();
    if (!ownerKey || ownerKey !== boardRes.data.owner_key) return null;
  }

  const itemsRes = await supabaseAdmin
    .from("networkers_site_board_items")
    .select("*")
    .eq("board_id", board.id)
    .order("added_at", { ascending: false });
  const items = (itemsRes.data ?? []).map(shapeItem);
  return { board, items };
}

// ─── Writes ───────────────────────────────────────────────────

export async function createBoard(params: {
  name:         string;
  description?: string | null;
  isPublic?:    boolean;
}): Promise<SiteBoard | null> {
  const ownerKey = await ensureSiteBoardOwnerKey();
  const name = params.name.trim().slice(0, 120) || "My Site Board";
  // Retry on the (very rare) slug collision — 10-char base64url from
  // randomBytes has ~40 bits of entropy, so collisions are effectively
  // impossible until many millions of boards, but the retry keeps us
  // honest at scale.
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = generateBoardSlug();
    const res = await supabaseAdmin
      .from("networkers_site_boards")
      .insert({
        owner_key:   ownerKey,
        name,
        slug,
        description: params.description ?? null,
        is_public:   params.isPublic ?? true
      })
      .select("*")
      .single();
    if (!res.error && res.data) return shapeBoard(res.data);
  }
  return null;
}

export async function addBoardItem(params: {
  boardId:    string;
  imageUrl:   string;
  subject?:   string | null;
  sourceJson?: Record<string, unknown>;
  note?:      string | null;
}): Promise<SiteBoardItem | null> {
  const ownerKey = await readSiteBoardOwnerKey();
  if (!ownerKey) return null;
  // Ownership check — never let cookie A add items to cookie B's
  // board even if they know the id.
  const own = await supabaseAdmin
    .from("networkers_site_boards")
    .select("id, owner_key")
    .eq("id", params.boardId)
    .maybeSingle();
  if (own.error || !own.data || own.data.owner_key !== ownerKey) return null;

  const res = await supabaseAdmin
    .from("networkers_site_board_items")
    .insert({
      board_id:    params.boardId,
      image_url:   params.imageUrl,
      subject:     params.subject ?? null,
      source_json: params.sourceJson ?? {},
      note:        params.note ?? null
    })
    .select("*")
    .single();
  if (res.error || !res.data) return null;
  return shapeItem(res.data);
}

export async function removeBoardItem(params: {
  boardId:  string;
  itemId:   string;
}): Promise<boolean> {
  const ownerKey = await readSiteBoardOwnerKey();
  if (!ownerKey) return false;
  const own = await supabaseAdmin
    .from("networkers_site_boards")
    .select("id, owner_key")
    .eq("id", params.boardId)
    .maybeSingle();
  if (own.error || !own.data || own.data.owner_key !== ownerKey) return false;
  const res = await supabaseAdmin
    .from("networkers_site_board_items")
    .delete()
    .eq("id", params.itemId)
    .eq("board_id", params.boardId);
  return !res.error;
}

// ─── Shape helpers ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeBoard(r: any): SiteBoard {
  return {
    id:            r.id,
    slug:          r.slug,
    name:          r.name,
    description:   r.description ?? null,
    isPublic:      r.is_public,
    coverImageUrl: r.cover_image_url ?? null,
    itemCount:     r.item_count ?? 0,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeItem(r: any): SiteBoardItem {
  return {
    id:         r.id,
    boardId:    r.board_id,
    imageUrl:   r.image_url,
    subject:    r.subject ?? null,
    sourceJson: (r.source_json ?? {}) as Record<string, unknown>,
    note:       r.note ?? null,
    addedAt:    r.added_at
  };
}
