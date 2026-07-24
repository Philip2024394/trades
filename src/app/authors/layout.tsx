// Author Studio layout — the shell every authors/* page renders inside.
//
// Not merchant-facing. Invite-only. Feature-flagged.

import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AuthorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FBF6EC] text-[#0A0A0A]">
      <header className="border-b border-[#0A0A0A]/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-[#FFB300]" />
            <span className="text-sm font-semibold">Nex Author Studio</span>
          </div>
          <div className="text-xs text-[#0A0A0A]/60">Invite-only · Draft mode</div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
