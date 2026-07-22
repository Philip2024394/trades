// Auth-gated admin layout — wraps every protected admin page.
//
// Reads the xrated_admin_session cookie and redirects to /admin/login
// when missing or tampered. Also renders the persistent admin nav strip
// (Listings · Payments · Reviews · Yard · Reports · Password Reset)
// and a log-out button.
//
// The Password Reset link shows a small badge with the pending count
// so the admin notices new requests without having to open the page.
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const NAV_ITEMS: { href: string; label: string; live: boolean; redZone?: boolean }[] = [
  { href: "/admin/red-zone", label: "🔴 Red Zone", live: true, redZone: true },
  { href: "/admin/payments", label: "Payments", live: true },
  { href: "/admin/reviews", label: "Reviews", live: true },
  { href: "/admin/yard", label: "Yard", live: true },
  { href: "/admin/news", label: "News", live: true },
  { href: "/admin/affiliates", label: "Affiliates", live: true },
  { href: "/admin/hero-library", label: "Hero Library", live: true },
  { href: "/admin/image-submissions", label: "Image Submissions", live: true },
  { href: "/admin/featured-placements", label: "Featured Placements", live: true },
  { href: "/admin/support/tickets", label: "Support Tickets", live: true },
  { href: "/admin/password-recovery", label: "Password Reset", live: true },
  { href: "/admin/support", label: "Support", live: true },
  { href: "/admin/beacon-residuals", label: "Bait Leads", live: true },
  { href: "/admin/asset-analytics", label: "Asset Analytics", live: true },
  { href: "/admin/mate", label: "Mate (AI)", live: true }
  // Removed 2026-07-17: /admin/listings + /admin/reports were
  // placeholder-only ("Coming soon" ghost nav items). Add back when
  // the routes actually ship.
];

async function loadPendingRecoveryCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id", { count: "exact", head: true })
    .not("password_recovery_requested_at", "is", null)
    .is("password_recovery_sent_at", null);
  if (error) {
    console.error("[admin/layout] pending count failed:", error);
    return 0;
  }
  return count ?? 0;
}

// Count yard posts that need admin attention — anything 'flagged' OR
// already 'hidden'/'spam' (so the admin can quickly Restore mis-fires).
// Surfaces as the small badge next to the Yard nav item.
async function loadPendingYardCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id", { count: "exact", head: true })
    .in("moderation_status", ["flagged", "hidden", "spam"]);
  if (error) {
    console.error("[admin/layout] yard pending count failed:", error);
    return 0;
  }
  return count ?? 0;
}

// Reviews still inside their 24h cool-down (status='live' AND
// goes_live_at > now()). Surfaces as the badge on the Reviews nav
// item so the admin can spot a flood of pending publishes.
async function loadPendingReviewsCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .select("id", { count: "exact", head: true })
    .eq("status", "live")
    .gt("goes_live_at", new Date().toISOString());
  if (error) {
    console.error("[admin/layout] reviews pending count failed:", error);
    return 0;
  }
  return count ?? 0;
}

// Approved commissions awaiting a payout — flagged on the Affiliates
// nav so the admin notices when there's money to release.
async function loadPendingAffiliatePayoutsCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  if (error) {
    console.error("[admin/layout] affiliate payouts count failed:", error);
    return 0;
  }
  return count ?? 0;
}

export default async function AdminAuthedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthed();
  if (!authed) {
    redirect("/admin/login");
  }

  const [
    pendingRecoveryCount,
    pendingYardCount,
    pendingReviewsCount,
    pendingAffiliatePayouts
  ] = await Promise.all([
    loadPendingRecoveryCount(),
    loadPendingYardCount(),
    loadPendingReviewsCount(),
    loadPendingAffiliatePayoutsCount()
  ]);

  return (
    <>
      <header className="border-b border-brand-line bg-brand-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/payments"
              className="text-sm font-semibold tracking-tight text-brand-accent"
            >
              Xrated Admin
            </Link>
            <nav className="flex flex-wrap items-center gap-1 pl-3">
              {NAV_ITEMS.map((item) => {
                const badgeCount =
                  item.href === "/admin/password-recovery"
                    ? pendingRecoveryCount
                    : item.href === "/admin/yard"
                      ? pendingYardCount
                      : item.href === "/admin/reviews"
                        ? pendingReviewsCount
                        : item.href === "/admin/affiliates"
                          ? pendingAffiliatePayouts
                          : 0;
                const showBadge = badgeCount > 0;
                if (item.live) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={
                        item.redZone
                          ? "inline-flex items-center gap-1 rounded border border-red-600 bg-red-50 px-2 py-1 text-xs font-black text-red-700 hover:bg-red-100"
                          : "inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-brand-text hover:bg-brand-line"
                      }
                    >
                      {item.label}
                      {showBadge && (
                        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-accent px-1.5 text-[10px] font-bold text-black">
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  );
                }
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    className="cursor-not-allowed rounded px-2 py-1 text-xs text-brand-muted"
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                );
              })}
            </nav>
          </div>
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="rounded border border-brand-line px-2 py-1 text-xs text-brand-muted hover:bg-brand-line hover:text-brand-text"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
