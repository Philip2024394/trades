// Admin dashboard outer layout.
//
// Bare wrapper — no auth gate here so the /admin/login route can render
// without redirecting itself. The (authed) route group below handles
// the password cookie check + the nav strip for every protected page.
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

export default function AdminRootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text">{children}</div>
  );
}
