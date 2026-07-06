// LiveEditShell — the top-level component merchants wrap their pages
// in. Provides:
//   - EditModeContext (isEditMode + hasUnsaved + publishStatus +
//     section state registry)
//   - Debounced auto-save of the aggregated draft to /api/merchant-page/save-draft
//   - StickyEditFooter with Edit + Publish buttons. Publish calls
//     /api/merchant-page/publish which copies draft → published.
//
// If merchantId is not set (public visitor view), edit mode is
// hidden entirely — the shell becomes a passthrough.

"use client";

import { useEffect, useRef } from "react";
import { EditModeProvider, useEditMode } from "./EditModeContext";
import { StickyEditFooter } from "./StickyEditFooter";

export type LiveEditShellProps = {
  /** When set, the merchant is logged in and can edit. Omit to hide
   *  the sticky footer (public visitor view). */
  merchantId?: string;
  /** Page slug — "landing" / "about" / "services" / etc. */
  pageSlug?: string;
  /** Optional override for the publish action — mostly for tests /
   *  demos. Production leaves this unset and the default POST to
   *  /api/merchant-page/publish runs. */
  onPublish?: () => Promise<void>;
  children: React.ReactNode;
};

/** Auto-save inner component — must run inside the EditModeProvider
 *  so it can read the section registry and hasUnsaved flag. */
function AutoSaveDraft({
  merchantId,
  pageSlug
}: {
  merchantId?: string;
  pageSlug: string;
}) {
  const { hasUnsaved, getAllSectionState } = useEditMode();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    if (!hasUnsaved) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/merchant-page/save-draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-merchant-id": merchantId
          },
          body: JSON.stringify({
            pageSlug,
            sections: getAllSectionState()
          })
        });
      } catch {
        // swallow — will retry on the next dirty tick
      }
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hasUnsaved, merchantId, pageSlug, getAllSectionState]);

  return null;
}

export function LiveEditShell({
  merchantId,
  pageSlug = "landing",
  onPublish,
  children
}: LiveEditShellProps) {
  const isMerchant = Boolean(merchantId);

  const defaultPublish = async () => {
    if (!merchantId) return;
    await fetch("/api/merchant-page/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-merchant-id": merchantId
      },
      body: JSON.stringify({ pageSlug })
    });
  };

  const publishHandler = onPublish ?? (isMerchant ? defaultPublish : undefined);

  return (
    <EditModeProvider>
      {children}
      {isMerchant ? (
        <>
          <AutoSaveDraft merchantId={merchantId} pageSlug={pageSlug} />
          <StickyEditFooter onPublish={publishHandler} />
        </>
      ) : null}
    </EditModeProvider>
  );
}
