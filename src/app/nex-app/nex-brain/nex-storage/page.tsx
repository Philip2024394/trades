// NEX Storage · standalone page wrapper.
//
// The dashboard itself lives in NexStoragePanel so the same code renders
// both here and inside the Operations Centre HQ shell as the "storage"
// workspace view. Route: /nex-app/nex-brain/nex-storage
// Doctrine: constitution_nex_backend_provider_agnostic_2026_08_07.md

import { NexStoragePanel } from "@/components/nex-app/nex-brain/NexStoragePanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "NEX Storage · Infrastructure Runtime",
  robots: { index: false },
};

export default function NexStoragePage() {
  return (
    <div className="min-h-screen" style={{ background: "#0b0d10" }}>
      <NexStoragePanel />
    </div>
  );
}
