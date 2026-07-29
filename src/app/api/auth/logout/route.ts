// POST /api/auth/logout
//
// D1 Turn 2 · End the current session (Philip 2026-07-28)
//
// Body: optional { session_id } — if provided, marks that specific
// hammerex_nex_sessions row logout_at. If not, the most recent open
// session for the current user is marked logged-out.
//
// Always calls supabase.auth.signOut regardless of audit outcome.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { brainSupabase } from "@/lib/nex/brains/_supabase";
import { recordLogout } from "@/lib/nex/brains/_session_audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { session_id?: string };

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* body optional */ }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch { /* route handler cookie mutation limit — safe to ignore */ }
      },
    },
  });

  // Best-effort session audit: mark the specific or most-recent open session
  let auditedSessionId: string | null = null;
  const sb = brainSupabase();
  if (sb) {
    try {
      if (body.session_id) {
        await recordLogout(body.session_id);
        auditedSessionId = body.session_id;
      } else {
        // Find user's most recent open session and mark logged out
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: nexUser } = await sb
            .from("hammerex_nex_users")
            .select("id")
            .eq("supabase_user_id", userData.user.id)
            .maybeSingle();
          if (nexUser) {
            const { data: openSession } = await sb
              .from("hammerex_nex_sessions")
              .select("id")
              .eq("user_id", (nexUser as { id: string }).id)
              .is("logout_at", null)
              .is("revoked_at", null)
              .order("login_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (openSession) {
              await recordLogout((openSession as { id: string }).id);
              auditedSessionId = (openSession as { id: string }).id;
            }
          }
        }
      }
    } catch (err) {
      console.error("[logout] session audit failed:", err);
    }
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true, audited_session_id: auditedSessionId });
}
