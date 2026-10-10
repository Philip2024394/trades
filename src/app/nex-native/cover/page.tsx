// src/app/nex-native/cover/page.tsx
//
// Cover root redirect · Founder-set 2026-09-30 · Bridge 98.
// -------------------------------------------------------------------
// Without this file, `/nex-native/cover` falls through to the
// `[businessSlug]` catch-all (which looks up a business named "cover"
// and calls notFound(), rendering the site's not-found page).
//
// This shim routes any visitor who lands on the bare /cover URL
// to the layout gallery — never a 404.

import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function CoverIndex(): never {
  redirect("/nex-native/cover/preview");
}
