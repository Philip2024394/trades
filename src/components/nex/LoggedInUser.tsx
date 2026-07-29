// components/nex/LoggedInUser.tsx
//
// D1 Turn 3 · Session badge + logout button (Philip 2026-07-28)
//
// Displays the logged-in user's identity + role, with a logout button.
// Fetches /api/admin/whoami to know the current identity. Reusable
// across the Command Centre header, Draft Workspace, and any other
// admin surface.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Whoami = {
  ok: boolean;
  email?: string;
  display_name?: string;
  role?: string;
  mfa_used?: boolean;
  mfa_required_for_privileged?: boolean;
};

export function LoggedInUser({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Whoami | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/whoami", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: Whoami) => setMe(data))
      .catch(() => setMe({ ok: false }));
  }, []);

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch { /* ignore */ }
    router.push("/admin/login");
  };

  if (!me || !me.ok) {
    return (
      <a href="/admin/login" className="text-xs text-neutral-500 hover:text-neutral-900 underline">Sign in</a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs" style={{ color: "#171717" }}>
      <div className="flex flex-col items-end">
        <span className="font-medium">{me.display_name ?? me.email}</span>
        <span className="text-neutral-500">
          {me.role}
          {me.mfa_required_for_privileged && (
            <span className={me.mfa_used ? " text-green-700" : " text-amber-700"}>
              {" · "}MFA {me.mfa_used ? "✓" : "required for privileged"}
            </span>
          )}
        </span>
      </div>
      <button
        onClick={logout} disabled={busy}
        className="text-xs px-2 py-1 rounded border border-neutral-300 hover:border-neutral-500 disabled:opacity-50"
      >
        {busy ? "…" : "Sign out"}
      </button>
    </div>
  );
}
