// Root route · session-aware NEX landing (Philip 2026-09-26).
//
// The root URL / is now the NEX landing page. It forwards to the
// /nex-native router, which itself sends:
//   · signed-out visitors → /nex-native/create-account
//   · signed-in visitors  → /nex-native/conversations
//
// This supersedes the 2026-08-24 "single home = /nexapp" doctrine.
// /nexapp still resolves for anyone who deep-links to it.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX", robots: { index: false } };

export default function Home(): never {
  redirect("/nex-native");
}
