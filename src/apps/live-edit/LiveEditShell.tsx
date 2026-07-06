// LiveEditShell — the top-level component merchants wrap their pages
// in. Provides:
//   - EditModeContext (isEditMode + hasUnsaved + publishStatus)
//   - StickyEditFooter with Edit + Publish buttons
//   - An onPublish hook that writes the current draft state to
//     Supabase (via /api/merchant-page/publish)
//
// If merchantId is not set (public visitor view), edit mode is
// hidden entirely — the shell becomes a passthrough.

"use client";

import { EditModeProvider } from "./EditModeContext";
import { StickyEditFooter } from "./StickyEditFooter";

export type LiveEditShellProps = {
  /** When set, the merchant is logged in and can edit. Omit to hide
   *  the sticky footer (public visitor view). */
  merchantId?: string;
  /** Page slug — "landing" / "about" / "services" / etc. */
  pageSlug?: string;
  /** Called when the merchant taps Publish. Should persist the
   *  current page state to Supabase. Falls back to a noop if omitted
   *  (useful for demos). */
  onPublish?: () => Promise<void>;
  children: React.ReactNode;
};

export function LiveEditShell({
  merchantId,
  onPublish,
  children
}: LiveEditShellProps) {
  const isMerchant = Boolean(merchantId);

  return (
    <EditModeProvider>
      {children}
      {isMerchant ? <StickyEditFooter onPublish={onPublish} /> : null}
    </EditModeProvider>
  );
}
