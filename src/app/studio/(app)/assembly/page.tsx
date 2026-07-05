// Studio Assembly preview — inspection page for the Assembly Rule
// Runtime output. Merchants can see exactly what would happen if they
// installed every DNA-migrated Module.

import { loadStudioSession } from "@/lib/studio/session";
import { AssemblyPlanView } from "@/components/studio/AssemblyPlanView";

export const dynamic = "force-dynamic";

export default async function StudioAssemblyPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <AssemblyPlanView />;
}
