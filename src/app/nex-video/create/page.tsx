// NEX Video Feed · Create · /nex-video/create · Philip 2026-08-27 (Stage 2.5)
// Server component that renders the client recorder + upload flow.

import { CreateVideoClient } from "./CreateVideoClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Video · Create", robots: { index: false } };

export default function Page() {
  return <CreateVideoClient />;
}
