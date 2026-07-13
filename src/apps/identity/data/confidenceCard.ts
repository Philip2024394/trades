// R05 New-Customer Confidence Card — data model.
//
// This is what a trade sees AFTER a customer has consented and Trade
// Center has aggregated the signals from partner bureaus + public
// registers + trade references. Trade Center never persists any of
// this — it's fetched fresh per request. This module holds only the
// shape + a demo builder for UI development.

export type SignalSource =
  | "companies-house"
  | "registry-trust-ccj"
  | "creditsafe"
  | "experian"
  | "trade-reference"
  | "trade-center-native";

export type SignalStatus = "green" | "amber" | "red" | "info";

export type ConfidenceSignal = {
  id: string;
  source: SignalSource;
  sourceLabel: string;         // "Companies House", "Registry Trust", etc.
  status: SignalStatus;
  headline: string;            // "No CCJs on record", "Score 72/100"
  detail?: string;
  fetchedAtIso: string;
  costGbp?: number;            // pass-through cost, if any
};

export type ConfidenceCard = {
  subjectName: string;
  subjectType: "business" | "individual";
  consentSignedAtIso: string;
  consentExpiresAtIso: string;
  signals: ConfidenceSignal[];
  /** Trade Center's suggested staged-payment ratios — INFORMATION only,
   *  never advice. Comes with a disclaimer. */
  suggestedStagedPayment: {
    depositPct: number;
    firstFixPct: number;
    secondFixPct: number;
    completionPct: number;
    rationale: string;
  };
};

export function buildDemoConfidenceCard(): ConfidenceCard {
  const now = new Date();
  const iso = now.toISOString();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    subjectName: "David Smith Construction Ltd",
    subjectType: "business",
    consentSignedAtIso: iso,
    consentExpiresAtIso: thirtyDays,
    signals: [
      {
        id: "ch-1",
        source: "companies-house",
        sourceLabel: "Companies House",
        status: "green",
        headline: "Active · 4 years continuous filing",
        detail: "No director disqualifications. Accounts filed on time.",
        fetchedAtIso: iso
      },
      {
        id: "rt-1",
        source: "registry-trust-ccj",
        sourceLabel: "Registry Trust",
        status: "green",
        headline: "No CCJs on record",
        detail: "No County Court Judgments in the last 6 years.",
        fetchedAtIso: iso,
        costGbp: 6
      },
      {
        id: "cs-1",
        source: "creditsafe",
        sourceLabel: "Creditsafe (partner)",
        status: "green",
        headline: "Score 72/100 · Low risk",
        detail:
          "Payment behaviour: pays 4 days late on average across supplier network. Credit limit recommendation: £8,500.",
        fetchedAtIso: iso,
        costGbp: 4.5
      },
      {
        id: "ref-1",
        source: "trade-reference",
        sourceLabel: "Trade Reference: Jewson Manchester",
        status: "green",
        headline: "Positive",
        detail: "\"Reliable, pays on 30 days, 18 months trading history.\"",
        fetchedAtIso: iso
      },
      {
        id: "ref-2",
        source: "trade-reference",
        sourceLabel: "Trade Reference: Screwfix (declined to respond)",
        status: "amber",
        headline: "No response received",
        detail: "Reference request sent but no reply within 48 hours.",
        fetchedAtIso: iso
      },
      {
        id: "tc-1",
        source: "trade-center-native",
        sourceLabel: "Trade Center Payment History",
        status: "green",
        headline: "3 jobs paid on time · avg 14 days",
        detail: "First job paid on day 12, second on day 18, third on day 11.",
        fetchedAtIso: iso
      }
    ],
    suggestedStagedPayment: {
      depositPct: 25,
      firstFixPct: 25,
      secondFixPct: 25,
      completionPct: 25,
      rationale:
        "Standard 25/25/25/25 profile suggested for low-risk customers. Adjust to 40/20/20/20 if the job requires large upfront material purchase."
    }
  };
}
