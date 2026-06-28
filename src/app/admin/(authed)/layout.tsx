// Auth-gated admin layout — wraps every protected admin page.
//
// Reads the xrated_admin_session cookie and redirects to /admin/login
// when missing or tampered. Also renders the persistent admin nav strip
// (Listings · Payments · Reviews · Yard · Reports) and a log-out button.
//
// Only Payments is wired to a live route right now; the rest are kept
// as disabled placeholders so the nav doesn't reshape when they ship.
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

const NAV_ITEMS: { href: string; label: string; live: boolean }[] = [
  { href: "/admin/listings", label: "Listings", live: false },
  { href: "/admin/payments", label: "Payments", live: true },
  { href: "/admin/reviews", label: "Reviews", live: false },
  { href: "/admin/yard", label: "Yard", live: false },
  { href: "/admin/reports", label: "Reports", live: false }
];

export default async function AdminAuthedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const authed = await isAdminAuthed();
  if (!authed) {
    redirect("/admin/login");
  }

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
              {NAV_ITEMS.map((item) =>
                item.live ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded px-2 py-1 text-xs text-brand-text hover:bg-brand-line"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    className="cursor-not-allowed rounded px-2 py-1 text-xs text-brand-muted"
                    title="Coming soon"
                  >
                    {item.label}
                  </span>
                )
              )}
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
