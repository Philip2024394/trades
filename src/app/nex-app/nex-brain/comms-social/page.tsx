// NEX Comms Centre · Social · standalone HQ page.
// Rendered inside /nex-app/nex-brain/comms-social · uses the same
// SocialCentrePanel component that CommunicationsCentrePanel will
// consume as a sub-section in a future revision.

import { SocialCentrePanel } from "@/components/nex-app/nex-brain/SocialCentrePanel";

export const dynamic = "force-dynamic";

export default function CommsSocialPage() {
  return (
    <div className="min-h-screen p-4" style={{ background: "#0b0f14" }}>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-3">
          <div className="text-[18px] font-black" style={{ color: "#e5e9ef" }}>
            NEX Comms Centre · Social
          </div>
          <div className="text-[10px] italic" style={{ color: "#5c6572" }}>
            Merchant surface for the Comms-Centre Social Engine · Phases 0-5 API surface · no adapter or SDK imports on this page.
          </div>
        </div>
        <SocialCentrePanel actor="hq" />
      </div>
    </div>
  );
}
