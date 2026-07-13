// ViewScopeBadge — floating admin-only indicator for "who is looking".
//
// A small blue pill fixed to the bottom-right of the viewport that
// tells the admin whether they're on a customer-facing surface or a
// merchant-facing one. Gated to non-production environments so end
// users never see it.
//
// [DEV BUTTON] — strip on the command "remove dev buttons".

"use client";

import { Eye, Store } from "lucide-react";

export type ViewScope = "customer" | "merchant";

export function ViewScopeBadge({ scope }: { scope: ViewScope }) {
  // Admin-only: hide the badge outside dev/preview so real customers
  // and merchants never see it in production.
  if (process.env.NODE_ENV === "production") return null;

  const label = scope === "customer" ? "Customer view" : "Merchant view";
  const Icon = scope === "customer" ? Eye : Store;
  return (
    <div
      className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wider text-white shadow-lg ring-2 ring-white"
      style={{ backgroundColor: "#2563EB" }}
      role="status"
      aria-label={`Admin: currently viewing as ${scope}`}
    >
      <Icon size={12} strokeWidth={2.2}/>
      {label}
    </div>
  );
}
