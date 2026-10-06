// POST /api/nex-native/vault/migration/queue
//
// Vault Phase A · Commit A.6 · list files awaiting migration.
//
// Returns owner-scoped list of files in 'legacy' or 'failed' state.
// The client walks this list and calls /migration/start for each
// file in sequence. Returns ONLY metadata the client needs for the
// migration flow · no secrets.
//
// Request body: none (POST for uniformity with other vault routes).
// Response: { ok: true, files: [{ id, byte_size, display_name, mime_type,
//              migration_state, rotation_generation }] }

import { NextResponse, type NextRequest } from "next/server";
import { resolveNexAppSession } from "@/lib/nex-native/app/session";
import { nexSupabaseAdmin } from "@/lib/nex-native/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await resolveNexAppSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_signed_in" }, { status: 401 });
  }
  const { data, error } = await nexSupabaseAdmin
    .from("nex_vault_file")
    .select(
      "id, byte_size, display_name, mime_type, migration_state, rotation_generation, created_at",
    )
    .eq("account_id", session.account.id)
    .in("migration_state", ["legacy", "failed"])
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "queue_failed", detail: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    files: (
      data as Array<{
        id: string;
        byte_size: number;
        display_name: string;
        mime_type: string;
        migration_state: "legacy" | "failed";
        rotation_generation: number;
      }>
    ).map((row) => ({
      id: row.id,
      byte_size: row.byte_size,
      display_name: row.display_name,
      mime_type: row.mime_type,
      migration_state: row.migration_state,
      rotation_generation: row.rotation_generation,
    })),
  });
}
