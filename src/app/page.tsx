// Root route redirects to the NEX home (Philip 2026-08-24 · single home doctrine).
//
// There is ONE home page: /nexapp. The former /nex-app front door was deleted
// on 2026-08-24 per Philip: "there is only one home page nexapp". Sub-routes
// under /nex-app/* (brains/staircase · app-builder · materials · etc.) still
// exist as feature surfaces but /nex-app itself no longer resolves as a home.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX", robots: { index: false } };

export default function Home(): never {
  redirect("/nexapp");
}
