// Admin — create a new affiliate campaign.
import Link from "next/link";
import { NewCampaignForm } from "./NewCampaignForm";

export const dynamic = "force-dynamic";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header>
        <p className="text-[13px] text-brand-muted">
          <Link href="/admin/affiliates/campaigns" className="hover:underline">
            &larr; Campaigns
          </Link>
        </p>
        <h1 className="text-2xl font-extrabold">New campaign</h1>
        <p className="mt-1 text-[13px] text-brand-muted">
          Bonus / seasonal campaigns reprice every newly-created commission
          during their window. Competitions emit prize payouts when ended.
        </p>
      </header>
      <NewCampaignForm />
    </div>
  );
}
