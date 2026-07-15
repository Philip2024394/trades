// GET /api/admin/red-zone — aggregated issue feed for the operational
// command centre. Reads directly from Supabase and returns the shape
// RedZoneShell expects. Missing tables are treated as "no issues" so
// the endpoint keeps working while producers are being wired.
//
// Categories returned (each is a list of Issue rows):
//   - washer:  hammerex_washer_spam_flags where status='pending'
//   - content: hammerex_content_reports where status='pending' (once
//              the table ships — swallowed for now)
//   - payment: derived in a follow-up from stripe events
//   - blocking + user: same, populated from future producers
//
// The endpoint is admin-only. Auth is enforced via the layout that
// contains the page — the API itself checks the admin cookie so a
// direct GET can't leak.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthed } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type IssueOut = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "blocking" | "payment" | "washer" | "content" | "user";
  title: string;
  description: string;
  source: string;
  createdAt: string;
  actionLabel?: string;
  actionHref?: string;
  detail?: string;
};

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export async function GET() {
  const authed = await isAdminAuthed();
  if (!authed) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const issues: IssueOut[] = [];

  // Washer spam flags — pending refund requests. Joins to the
  // transaction row + listing slug so the admin sees who was hit
  // and can approve/deny.
  try {
    const flags = await supabaseAdmin
      .from("hammerex_washer_spam_flags")
      .select("id, listing_id, transaction_id, merchant_reason, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!flags.error && flags.data) {
      for (const flag of flags.data) {
        // Best-effort: look up the merchant slug + transaction detail
        // so the card carries real context. Failures fall back to
        // ids so the queue still surfaces.
        const listing = await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .select("slug, display_name")
          .eq("id", flag.listing_id)
          .maybeSingle();
        const tx = await supabaseAdmin
          .from("hammerex_washer_transactions")
          .select("source, detail")
          .eq("id", flag.transaction_id)
          .maybeSingle();
        const merchantName =
          typeof listing.data?.display_name === "string" ? listing.data.display_name : (listing.data?.slug ?? "unknown merchant");
        const detail = (tx.data?.detail ?? null) as Record<string, unknown> | null;
        const guestName = typeof detail?.guestName === "string" ? detail.guestName : "unknown";
        const guestComment = typeof detail?.guestComment === "string" ? detail.guestComment : null;
        issues.push({
          id: flag.id,
          severity: "high",
          category: "washer",
          title: `Refund request — ${merchantName} · spam-flagged lead`,
          description: `Guest: ${guestName}. Merchant flag reason: ${flag.merchant_reason}`,
          source: `Merchant · ${listing.data?.slug ?? flag.listing_id}`,
          detail: guestComment ? `Original comment: "${guestComment}"` : undefined,
          createdAt: timeAgo(flag.created_at),
          actionLabel: "Review lead"
        });
      }
    }
  } catch {
    // washer tables not applied yet — no washer issues to surface
  }

  // Content reports — public content flagged as harmful, misleading,
  // under-18 unsuitable, IP infringement, etc. Populated from the
  // canteen post 3-dot Report menu, the /legal contact route, and
  // any future in-app "Report" link.
  try {
    const reports = await supabaseAdmin
      .from("hammerex_content_reports")
      .select("id, content_type, content_id, merchant_slug, reason, reported_body, severity, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!reports.error && reports.data) {
      for (const r of reports.data) {
        const severity = (r.severity as IssueOut["severity"]) ?? "medium";
        const title =
          r.content_type === "canteen-post"        ? "Canteen post reported"
          : r.content_type === "yard-post"          ? "Yard post reported"
          : r.content_type === "trade-center-listing" ? "Trade Center listing reported"
          : r.content_type === "canteen-reply"      ? "Canteen reply reported"
          : "Content reported";
        issues.push({
          id: r.id,
          severity,
          category: "content",
          title,
          description: r.reason as string,
          source: r.merchant_slug ? `Merchant · ${r.merchant_slug}` : "Anonymous",
          detail: typeof r.reported_body === "string" && r.reported_body ? `Reported content: "${r.reported_body}"` : undefined,
          createdAt: timeAgo(r.created_at as string),
          actionLabel: "Review"
        });
      }
    }
  } catch {
    // table not yet applied — no content reports to surface
  }

  // User-submitted bugs, broken links, feature requests. Populated
  // from /report-an-issue.
  try {
    const bugs = await supabaseAdmin
      .from("hammerex_bug_reports")
      .select("id, kind, body, page_url, reporter_email, severity, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!bugs.error && bugs.data) {
      for (const b of bugs.data) {
        const severity = (b.severity as IssueOut["severity"]) ?? "medium";
        const kindLabel =
          b.kind === "bug"              ? "Bug report"
          : b.kind === "broken-link"    ? "Broken link report"
          : b.kind === "feature-request" ? "Feature request"
          : "User report";
        issues.push({
          id: b.id,
          severity,
          category: "user",
          title: kindLabel,
          description: (b.body as string).slice(0, 200) + ((b.body as string).length > 200 ? "…" : ""),
          source: b.reporter_email ? `${b.reporter_email}` : "Anonymous",
          detail: typeof b.page_url === "string" && b.page_url ? `Reported on: ${b.page_url}` : undefined,
          createdAt: timeAgo(b.created_at as string),
          actionLabel: "Review"
        });
      }
    }
  } catch {
    // table not yet applied
  }

  return NextResponse.json({
    ok: true,
    issues,
    counts: {
      total: issues.length,
      critical: issues.filter((i) => i.severity === "critical").length,
      high: issues.filter((i) => i.severity === "high").length,
      medium: issues.filter((i) => i.severity === "medium").length,
      low: issues.filter((i) => i.severity === "low").length
    }
  });
}
