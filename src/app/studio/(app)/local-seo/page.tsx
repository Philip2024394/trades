// Studio Local SEO Pack.

import { loadStudioSession } from "@/lib/studio/session";
import { LocalSeoPack } from "@/components/studio/LocalSeoPack";

export const dynamic = "force-dynamic";

export default async function StudioLocalSeoPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <LocalSeoPack />;
}
