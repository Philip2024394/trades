// src/app/nexapp/page.tsx
//
// Founder 2026-09-10 · unified NEX chat home.
//
// One chat page. One URL: /nexapp. The polished, fully-wired chat
// surface (previously at /nex/chat, and briefly duplicated at
// /nexapp/chat) now lives here as `NexPolishedChat`. Middleware
// redirects /nex/chat → /nexapp so old links keep working.
//
// This file stays a server component so it can carry PWA metadata +
// viewport (Next.js does not allow those exports from client files).

import type { Metadata, Viewport } from "next";
import NexPolishedChat from "./NexPolishedChat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NEX",
  description: "NEX · Ask. Discover. Connect.",
  appleWebApp: {
    capable: true,
    title: "NEX",
    statusBarStyle: "black-translucent",
  },
  manifest: "/nex.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function NexAppRoute() {
  return <NexPolishedChat />;
}
