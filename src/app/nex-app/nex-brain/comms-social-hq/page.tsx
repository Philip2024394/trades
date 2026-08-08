// NEX Comms Centre · Social · HQ Mission Control · standalone HQ page.
import { SocialHQPanel } from "@/components/nex-app/nex-brain/SocialHQPanel";

export const dynamic = "force-dynamic";

export default function CommsSocialHQPage() {
  return (
    <div className="min-h-screen p-4" style={{ background: "#0b0f14" }}>
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-3">
          <div className="text-[18px] font-black" style={{ color: "#e5e9ef" }}>
            NEX Comms Centre · Social · HQ
          </div>
          <div className="text-[10px] italic" style={{ color: "#5c6572" }}>
            Network-wide oversight · every cross-tenant read is Boundary-3 audited · k-anonymity floor k=5 on aggregates
          </div>
        </div>
        <SocialHQPanel />
      </div>
    </div>
  );
}
