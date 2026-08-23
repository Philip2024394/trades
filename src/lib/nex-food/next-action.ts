// NEX Food · Phase 8.2 · Next-Action rule engine.
//
// Deterministic evaluator · pure function of business state + configurable
// HQ rules · never ML · never surprising. Every decision produces:
//   - a NEXT_ACTION enum value
//   - a human-readable reason
//   - the exact input snapshot that produced the decision
//
// Called by scripts/nex-food/hq-recompute-next-actions.mjs (batch) and
// the HQ dashboard (single-business inspect). Never called from customer
// code paths.

export type NextAction =
  | "INVITE_BUSINESS"
  | "FOLLOW_UP"
  | "WAIT"
  | "CLAIM_PENDING"
  | "ONBOARD"
  | "SHOW_VALUE"
  | "OFFER_MEMBERSHIP"
  | "OFFER_PAY_PER_RESULT"
  | "NO_ACTION";

export type NextActionInput = {
  businessRef: string;
  claimStatus: "discovered" | "verifying" | "listed" | "invited" | "claimed" | "paying";
  ownerStatus: "unknown" | "contacted" | "responded" | "verified";
  qualifiedEnquiries: number;
  nexValueScore: number;
  daysSinceLastOutreach: number | null;   // null = never contacted
  daysSinceClaim: number | null;          // null = not claimed
  suppressed: boolean;
  hasContactDestination: boolean;         // WhatsApp or phone present
  activeCampaignThrottle: boolean;        // Phase 8.4 · true = campaign already sending
};

export type HqRules = {
  freeAllowanceQualifiedEnquiries: number;
  offerMembershipMinValueScore: number;
  churnSignalDaysInactive: number;
  followUpCooldownDays: number;           // default 30
  onboardWindowDaysAfterClaim: number;    // default 7
};

export type NextActionResult = {
  nextAction: NextAction;
  reason: string;
  inputSnapshot: NextActionInput;
};

export const DEFAULT_RULES: HqRules = {
  freeAllowanceQualifiedEnquiries: 5,
  offerMembershipMinValueScore: 100,
  churnSignalDaysInactive: 60,
  followUpCooldownDays: 30,
  onboardWindowDaysAfterClaim: 7,
};

/**
 * Deterministic rules. Order matters · first match wins.
 * Every rule returns a NextActionResult with a specific, auditable reason.
 */
export function computeNextAction(input: NextActionInput, rules: HqRules = DEFAULT_RULES): NextActionResult {
  const wrap = (nextAction: NextAction, reason: string): NextActionResult => ({
    nextAction,
    reason,
    inputSnapshot: input,
  });

  // 1. Suppressed businesses NEVER get outreach recommendations.
  if (input.suppressed) {
    return wrap("NO_ACTION", "Business is on the suppression list · outreach permanently blocked");
  }

  // 2. Already-paying businesses need retention, not conversion. For V1 that's NO_ACTION
  //    (Phase 8.x will add retention actions when we have churn signals to trigger on).
  if (input.claimStatus === "paying") {
    return wrap("NO_ACTION", "Business is a paying NEX member · no acquisition action needed");
  }

  // 3. Discovered/verifying: not yet visible in directory · admin verification pending.
  if (input.claimStatus === "discovered" || input.claimStatus === "verifying") {
    return wrap("WAIT", `Business in ${input.claimStatus} state · admin verification pending before invitation`);
  }

  // 4. Claim code sent but not yet consumed · CLAIM_PENDING.
  //    (Represented in current model by claim_status='invited' AND ownerStatus='contacted'
  //    AND recent outreach. We treat CLAIM_PENDING as INVITED + recent outreach here.)
  if (input.claimStatus === "invited" && input.ownerStatus === "contacted") {
    if (input.daysSinceLastOutreach != null && input.daysSinceLastOutreach < 7) {
      return wrap("CLAIM_PENDING", "Invitation sent recently · give owner time to respond");
    }
    if (input.daysSinceLastOutreach != null && input.daysSinceLastOutreach < rules.followUpCooldownDays) {
      return wrap("WAIT", `Follow-up cooldown active · ${rules.followUpCooldownDays - input.daysSinceLastOutreach} days until next attempt allowed`);
    }
    return wrap("FOLLOW_UP", `Invited > ${rules.followUpCooldownDays} days ago · owner has not responded · follow-up allowed`);
  }

  // 5. Claim just happened · ONBOARD window.
  if (input.claimStatus === "claimed" && input.daysSinceClaim != null && input.daysSinceClaim <= rules.onboardWindowDaysAfterClaim) {
    return wrap("ONBOARD", `Business claimed ${input.daysSinceClaim} day(s) ago · guide owner through dashboard setup`);
  }

  // 6. Claimed · check value threshold.
  if (input.claimStatus === "claimed") {
    // 6a. Free allowance exhausted OR value threshold hit → offer membership.
    const allowanceExhausted = input.qualifiedEnquiries >= rules.freeAllowanceQualifiedEnquiries;
    const valueThresholdHit = input.nexValueScore >= rules.offerMembershipMinValueScore;

    if (allowanceExhausted || valueThresholdHit) {
      const trigger = allowanceExhausted
        ? `free allowance exhausted (${input.qualifiedEnquiries}/${rules.freeAllowanceQualifiedEnquiries} qualified enquiries used)`
        : `value threshold hit (score=${input.nexValueScore} ≥ ${rules.offerMembershipMinValueScore})`;
      return wrap("OFFER_MEMBERSHIP", `Claimed business ready for conversion · ${trigger}`);
    }

    // 6b. Claimed but low value yet · keep delivering.
    return wrap("SHOW_VALUE", `Claimed · ${input.qualifiedEnquiries}/${rules.freeAllowanceQualifiedEnquiries} qualified enquiries used · value_score=${input.nexValueScore} · keep delivering value`);
  }

  // 7. Listed · never contacted yet · has a destination → invite.
  if (input.claimStatus === "listed") {
    if (!input.hasContactDestination) {
      return wrap("NO_ACTION", "Listed but no WhatsApp/phone destination · cannot invite until contact enriched (admin verification workflow)");
    }
    if (input.activeCampaignThrottle) {
      return wrap("WAIT", "Active campaign already handles this business · avoid duplicate outreach");
    }
    if (input.daysSinceLastOutreach == null) {
      return wrap("INVITE_BUSINESS", "Listed with contact destination · never invited · ready for first outreach");
    }
    if (input.daysSinceLastOutreach >= rules.followUpCooldownDays) {
      return wrap("FOLLOW_UP", `Listed · last touch ${input.daysSinceLastOutreach} days ago · follow-up allowed`);
    }
    return wrap("WAIT", `Cooldown active · ${rules.followUpCooldownDays - input.daysSinceLastOutreach} days until next allowed`);
  }

  // Fallback (should never hit in normal flow · defensive)
  return wrap("NO_ACTION", "No rule matched · investigate business state");
}
