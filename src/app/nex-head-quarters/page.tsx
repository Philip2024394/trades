// NEX Headquarters · Reception · single front door.
//
// Route: /nex-head-quarters
//
// Task #72 Step 4 (2026-08-22): Reception now leads with the Reality Strip
// (System × Status × Reality × Last checked) driven by the same six-criteria
// evaluator that powers /nex-head-quarters/workers. The pre-existing
// operations-centre content follows below · one page · one truth.
//
// The strip is a WINDOW into the truth · never a new source of truth.
// Every status derives from evaluateAllSystems which reuses evaluateWorker
// from Step 3. No duplicate verdict logic anywhere.
//
// The /nex-head-quarters/operations-centre URL still works (same file,
// rendered directly at that route). Every other centre — Knowledge, Storage,
// Data Platform, Review, Journal, Audit, Comms Social — is reachable from
// the shared HQ sidebar (see components/nex-head-quarters/HQShell.tsx).

import RealityStrip from "@/components/nex-head-quarters/RealityStrip";
import WorkMapHeroCard from "@/components/nex-head-quarters/WorkMapHeroCard";
import OperationsCentre from "./operations-centre/page";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Headquarters · Reception",
  robots: { index: false },
};

export default async function ReceptionPage() {
  return (
    <>
      <WorkMapHeroCard />
      <RealityStrip />
      <OperationsCentre />
    </>
  );
}
