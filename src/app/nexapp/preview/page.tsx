// NEX Design Preview Mode · developer-only route.
//
// Renders /nexapp inside a locked-dimension iframe so the NEX UI always
// lays itself out at the SELECTED device viewport regardless of the
// developer's monitor size. Zoom controls scale the preview visually
// without changing the layout dimensions inside the iframe.
//
// Production /nexapp is completely unaffected by this — visitors get
// the real responsive app. This route is a design/debug harness only.

import { NexPreviewShell } from "@/components/nexapp/preview/NexPreviewShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Design Preview · Dev",
  robots: { index: false, follow: false },
};

export default function NexPreviewRoute() {
  return <NexPreviewShell targetUrl="/nexapp" />;
}
