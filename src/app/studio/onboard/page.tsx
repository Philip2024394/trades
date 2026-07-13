// Studio Onboard — the "answer 7 questions, get a profile" wizard.
//
// The £14.99 moment. Merchant answers Philip's canonical 7 questions
// (see docs/studio-onboarding-questions.md) in ~60 seconds. Server
// orchestrates a set of /api/studio/ai/compose calls to build the
// full profile page. Merchant reviews, mutates by prompt, publishes.

import { StudioOnboardWizard } from "@/components/studio/StudioOnboardWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your Network profile" };

export default function OnboardPage() {
  return <StudioOnboardWizard />;
}
