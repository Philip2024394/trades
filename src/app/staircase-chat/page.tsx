// /staircase-chat — public admin-testing chat for Nex Staircases.
//
// No auth for now. Philip (admin) uses this to verify the Brain
// content is queryable end-to-end before proper merchant/homeowner
// packaging is designed.
//
// Full-page client chat UI: message list, input, loading state,
// citations panel per Nex message.

import { StaircaseChatUI } from "@/components/nex/StaircaseChatUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nex Staircases — Chat", robots: { index: false } };

export default function StaircaseChatPage() {
  return (
    <div className="min-h-screen bg-[#FBF6EC]">
      <StaircaseChatUI />
    </div>
  );
}
