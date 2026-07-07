// The canonical landing page — bright warm audience gate.

import { AudienceGateBright } from "@/components/homepage/AudienceGateBright";

export const metadata = {
  title: "The Construction Notebook · XRatedTrade",
  description:
    "Every job. Every home. On the record. Britain's construction notebook — for homeowners and the trades who build with them."
};

export default function Home() {
  return (
    <main className="bg-[#FBF6EC]">
      <AudienceGateBright />
    </main>
  );
}
