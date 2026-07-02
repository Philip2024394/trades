// Studio Design System browser.
//
// Server wrapper — loads the merchant's brand tokens, translates them
// to a DesignTheme, hands off to the client browser. Every preview in
// the browser renders with the merchant's actual theme.

import { loadStudioSession } from "@/lib/studio/session";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { brandTokensToDesignTheme } from "@/platform/design/theme/palettes";
import { DesignSystemBrowser } from "@/components/studio/DesignSystemBrowser";

export const dynamic = "force-dynamic";

export default async function StudioDesignPage() {
  const session = await loadStudioSession();
  if (!session) return null;

  const tokens = await loadBrandTokens(session.brand.id);
  const merchantTheme = brandTokensToDesignTheme(tokens);

  return (
    <DesignSystemBrowser
      brandName={session.brand.name}
      merchantTheme={merchantTheme}
    />
  );
}
