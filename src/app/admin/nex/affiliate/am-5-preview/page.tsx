// src/app/admin/nex/affiliate/am-5-preview/page.tsx
//
// AM-5 Rev 4 · Admin Mock Preview · server shell.
//
// Gated by the existing /admin/* middleware (D:/trades/middleware.ts
// PROTECTED_PREFIXES = ["/admin", "/api/admin"]). Unauthenticated
// visitors get redirected to /admin/login by the middleware before
// this page ever renders. No additional auth is layered here — the
// admin middleware is the sealed mechanism.
//
// Explicit production-safety invariants (reconfirmed on every render):
//   · This route NEVER mutates nex_business, nex_affiliate_account,
//     nex_affiliate_promotion, or any other production table.
//   · This route NEVER calls promoteSellerAction, cancelPromotionAction,
//     joinAffiliateAction, or any other production affiliate server action.
//   · This route NEVER reads or writes migration 127 artifacts
//     (nex_affiliate_terms does not exist in the DB; this route does
//     not query it).
//   · All data on this surface is static fixtures in ./_fixtures.ts.
//
// Rev 4 is sealed. This route is a UX walkthrough only.

import { AdminAm5PreviewClient } from "./_preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function AdminAm5PreviewPage() {
  return <AdminAm5PreviewClient />;
}
