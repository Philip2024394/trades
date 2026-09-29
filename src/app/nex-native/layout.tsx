// src/app/nex-native/layout.tsx
//
// Bridge 64 · NEX-native metadata override · sealed 2026-09-29.
// -------------------------------------------------------------
// Root layout (/d/trades/src/app/layout.tsx) brands the site as
// "Thenetworkers" · that's correct for the legacy Xrated / trades
// surfaces but wrong for /nex-native. This segment layout re-writes
// metadata so:
//
//   · Browser tab title / OS window title reads "NEX"
//   · Apple / Android add-to-home-screen installs a proper NEX PWA
//     (own name, own icon, own start URL, own theme color)
//   · Description matches the chat + themes value prop
//   · manifest ref points at /nex.webmanifest (dedicated NEX web
//     app manifest with start_url = /nex-native/home)
//   · iOS status bar goes translucent black so the chat surface
//     paints edge-to-edge under the notch
//
// Applies to ALL routes under /nex-native · does NOT touch the
// other apps at /trade-off, /admin, /nexapp etc.

import type { Metadata, Viewport } from "next";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { IncomingCallHub } from "./_incoming-call-hub";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020914",
};

export const metadata: Metadata = {
  title: {
    default: "NEX · Chat that's yours",
    template: "%s · NEX",
  },
  description:
    "NEX is a chat app with beautiful themes · every friend sees your look · premium themes free for 7 days · Indonesia-first pricing.",
  applicationName: "NEX",
  manifest: "/nex.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NEX",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: "/apple-touch-icon.png",
    apple: "/apple-touch-icon.png",
    shortcut: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "NEX",
    title: "NEX · Chat that's yours",
    description:
      "Beautiful chat themes · your look, every conversation · Bisnis Rp 39k/mo · free 7-day trial.",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "NEX · Chat that's yours",
    description:
      "Beautiful chat themes · your look, every conversation · Bisnis Rp 39k/mo · free 7-day trial.",
  },
};

export default async function NexNativeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Bridge 86 · resolve the session server-side so the global
  // incoming-call hub knows which inbox channel to subscribe to.
  // Non-blocking · unauthenticated visitors get a null session and
  // the hub is skipped. Session lookup is a cookie read + one small
  // supabase.auth.getUser() · cached at request scope.
  let selfAccountId: string | null = null;
  let selfDisplayName: string | null = null;
  try {
    const session = await resolveNexAppSessionFromContext();
    if (session) {
      selfAccountId = session.account.id;
      selfDisplayName = session.account.display_name;
    }
  } catch { /* unauthenticated · hub stays disabled */ }

  return (
    <>
      {children}
      {selfAccountId && selfDisplayName && (
        <IncomingCallHub
          selfAccountId={selfAccountId}
          selfDisplayName={selfDisplayName}
        />
      )}
    </>
  );
}
