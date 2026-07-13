// The canonical landing page — bright warm audience gate.

import { AudienceGateBright } from "@/components/homepage/AudienceGateBright";

export const metadata = {
  title: "Thenetworkers · For every trade, homeowner, and merchant",
  description:
    "One network. One profile. One community — for every trade, homeowner, and merchant in the UK. Free for life."
};

export default function Home() {
  return (
    <main className="bg-[#FBF6EC]">
      <AudienceGateBright />
    </main>
  );
}
