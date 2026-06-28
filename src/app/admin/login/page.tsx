// Admin login form.
//
// Posts to /api/admin/login which compares the password against
// ADMIN_PASSWORD and sets the signed xrated_admin_session cookie. On
// success the API redirects to ?next (or /admin/payments by default).
//
// If the request arrives with a valid cookie already, we bounce straight
// through to the destination so the form is never seen.
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string; error?: string }>;

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/admin")
    ? sp.next
    : "/admin/payments";
  const error = sp.error === "1";

  if (await isAdminAuthed()) {
    redirect(next);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        action="/api/admin/login"
        method="POST"
        className="w-full max-w-sm rounded-lg border border-brand-line bg-brand-surface p-6 shadow-xl"
      >
        <h1 className="text-base font-semibold text-brand-accent">
          Xrated Admin
        </h1>
        <p className="mt-1 text-xs text-brand-muted">
          Enter the admin password to continue.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-300"
          >
            Wrong password. Try again.
          </p>
        )}
        <input type="hidden" name="next" value={next} />
        <label className="mt-4 block text-xs text-brand-muted">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            autoFocus
            className="mt-1 w-full rounded border border-brand-line bg-brand-bg px-2 py-2 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
        </label>
        <button
          type="submit"
          className="mt-4 w-full rounded bg-brand-accent px-3 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
