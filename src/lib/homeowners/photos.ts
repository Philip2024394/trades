// SiteBook Photos — homeowner-scoped loader for the gallery card.
//
// Photos survive post deletion (post_id FK is ON DELETE SET NULL —
// see migration 20260718140000_hammerex_sitebook_posts.sql). So the
// gallery is a stable record even when feed items get removed.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SiteBookPhoto = {
  id:                 string;
  project_id:         string;
  post_id:            string | null;    // null if source post was deleted OR photo was uploaded directly
  uploaded_by_type:   "homeowner" | "trade";
  uploaded_by_name:   string | null;
  storage_url:        string;
  caption:            string | null;
  stage:              "before" | "in-progress" | "after" | null;
  created_at:         string;
};

/** All photos across every project this homeowner owns. Newest first.
 *  Includes photos whose parent post has been deleted (post_id null). */
export async function loadHomeownerPhotos(homeownerId: string, limit = 60): Promise<SiteBookPhoto[]> {
  // First get all project IDs the homeowner owns
  const projects = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("homeowner_id", homeownerId);
  const projIds = (projects.data as { id: string }[] ?? []).map((p) => p.id);
  if (projIds.length === 0) return [];

  const res = await supabaseAdmin
    .from("hammerex_sitebook_photos")
    .select("id, project_id, post_id, uploaded_by_type, uploaded_by_name, storage_url, caption, stage, created_at")
    .in("project_id", projIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (res.data as SiteBookPhoto[]) ?? [];
}
