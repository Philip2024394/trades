// /admin/password-recovery — pending password reset queue.
//
// Each row is a tradesperson who hit /api/trade-off/forgot-password and
// hasn't been sent their recovery link yet. The admin clicks the
// per-row button which (a) opens wa.me in a new tab with a pre-filled
// message containing the recovery link, AND (b) POSTs to
// /api/admin/password-recovery/sent so the listing's sent_at timestamp
// is recorded — which is also the gate the redemption route uses to
// allow the code to be used.
//
// Server component. Reads the admin HMAC cookie via isAdminAuthed (the
// (authed) layout already redirects unauth'd hits, but we double-check
// here for completeness and to keep this page independently safe if
// the layout changes).
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { whatsappDigits } from "@/lib/tradeOff";
import { PasswordRecoverySendButton } from "./PasswordRecoverySendButton";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  display_name: string | null;
  trading_name: string | null;
  whatsapp: string | null;
  email: string | null;
  password_recovery_token: string | null;
  password_recovery_requested_at: string | null;
};

function firstName(displayName: string | null): string {
  if (!displayName) return "there";
  const first = displayName.trim().split(/\s+/)[0];
  return first || "there";
}

function relativeAgo(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

async function siteOriginFromRequest(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) {
    return env.replace(/\/$/, "");
  }
  // Fall back to request host headers. In Next 16 these are async.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return "https://xratedtrade.com";
}

export default async function AdminPasswordRecoveryPage() {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }

  const { data, error } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, trading_name, whatsapp, email, password_recovery_token, password_recovery_requested_at"
    )
    .not("password_recovery_requested_at", "is", null)
    .is("password_recovery_sent_at", null)
    .order("password_recovery_requested_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/password-recovery] fetch failed:", error);
  }

  const rows = ((data ?? []) as Row[]).filter(
    (r) => typeof r.password_recovery_token === "string" && r.password_recovery_token.length > 0
  );

  const origin = await siteOriginFromRequest();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            Password reset queue
            <span className="ml-2 inline-flex items-center rounded-full bg-brand-accent px-2 py-0.5 text-[11px] font-bold text-black">
              {rows.length}
            </span>
          </h1>
          <p className="text-xs text-brand-muted">
            Tradespeople who requested a password reset. Click <em>Send via
            WhatsApp</em> to open the composer with their recovery link pre-filled
            — the click also records that the link was sent, which is what
            unlocks the link for redemption.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-brand-line">
        <table className="min-w-full text-xs">
          <thead className="bg-brand-surface text-left text-brand-muted">
            <tr>
              <Th>App</Th>
              <Th>Name</Th>
              <Th>WhatsApp</Th>
              <Th>Email</Th>
              <Th>Requested</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-xs text-brand-muted"
                >
                  No pending password reset requests.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const waDigits = whatsappDigits(row.whatsapp ?? "");
                const code = row.password_recovery_token ?? "";
                const recoveryUrl =
                  waDigits && code
                    ? `${origin}/trade-off/set-password?wa=${encodeURIComponent(
                        waDigits
                      )}&recovery_code=${encodeURIComponent(code)}`
                    : "";
                const name = firstName(row.display_name);
                const messageBody = `Hi ${name}, here's your password reset link for xratedtrade.com: ${recoveryUrl}\n\nThis link expires in 24 hours.`;
                const waUrl =
                  waDigits && recoveryUrl
                    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(messageBody)}`
                    : "";
                return (
                  <tr
                    key={row.id}
                    className="border-t border-brand-line align-top hover:bg-brand-line/40"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-accent hover:underline"
                      >
                        {row.slug}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-brand-text">
                        {row.display_name || "—"}
                      </div>
                      {row.trading_name && (
                        <div className="text-[11px] text-brand-muted">
                          {row.trading_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-brand-text">
                      {row.whatsapp || "—"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-brand-muted">
                      {row.email || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-brand-text">
                        {relativeAgo(row.password_recovery_requested_at)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <PasswordRecoverySendButton
                        listingId={row.id}
                        waUrl={waUrl}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-wide"
    >
      {children}
    </th>
  );
}
