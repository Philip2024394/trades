import { redirect } from "next/navigation";

// Phase 1 — server-side bounce to the Xrated landing. URL re-org
// (/trade-off/* → /*) is deferred to a Phase 2 polish so we don't
// have to rewire dozens of internal hrefs in one go.
export default function Home() {
  redirect("/trade-off");
}
