// src/lib/nex-comms/permission.ts
//
// PERMISSION ENGINE · category × basis compatibility check.
//
// Doctrine (INVIOLABLE): possession of a phone number is NEVER consent.
// Recruitment + Marketing categories REQUIRE explicit-opt-in OR (for
// recruitment specifically) public_business_source + campaign approval.

import type { CommsCategory, CommsPermissionBasis, CommsCampaign } from "./types";

export interface PermissionInput {
  category: CommsCategory;
  basis: CommsPermissionBasis;
  campaign?: CommsCampaign;
}

export interface PermissionOK {
  status: "ALLOWED";
  category: CommsCategory;
  basis: CommsPermissionBasis;
  note: string;
}

export interface PermissionRefused {
  status: "REFUSED";
  reason:
    | "BASIS_NONE"
    | "BASIS_INCOMPATIBLE_WITH_CATEGORY"
    | "CAMPAIGN_MISSING_FOR_RECRUITMENT_OR_MARKETING"
    | "CAMPAIGN_NOT_APPROVED";
  detail: string;
}

export type PermissionResult = PermissionOK | PermissionRefused;

/**
 * Category → set of bases that are acceptable for that category.
 * Recruitment intentionally allows public_business_source (public directory
 * contacts) OR explicit_opt_in · nothing weaker. Marketing requires explicit
 * opt-in only. Everything transactional/service/support/booking/transport/etc.
 * accepts contract_performance + transactional_response.
 */
const COMPATIBILITY: Record<CommsCategory, readonly CommsPermissionBasis[]> = {
  transactional:    ["contract_performance", "transactional_response", "legal_obligation"] as const,
  service:          ["contract_performance", "transactional_response"] as const,
  support:          ["contract_performance", "transactional_response"] as const,
  verification:     ["contract_performance", "legal_obligation"] as const,
  security:         ["contract_performance", "legal_obligation"] as const,
  notification:     ["contract_performance", "explicit_opt_in"] as const,
  booking:          ["contract_performance", "transactional_response"] as const,
  transport:        ["contract_performance", "transactional_response"] as const,
  business_enquiry: ["public_business_source", "contract_performance", "transactional_response"] as const,
  recruitment:      ["public_business_source", "explicit_opt_in"] as const,
  marketing:        ["explicit_opt_in", "legitimate_interest_documented"] as const,
};

const CAMPAIGN_REQUIRED_CATEGORIES: readonly CommsCategory[] = ["recruitment", "marketing"] as const;

export function checkPermission(input: PermissionInput): PermissionResult {
  if (input.basis === "none") {
    return {
      status: "REFUSED",
      reason: "BASIS_NONE",
      detail: "permissionBasis='none' · NEX will not send without a documented basis.",
    };
  }

  const allowed = COMPATIBILITY[input.category];
  if (!allowed.includes(input.basis)) {
    return {
      status: "REFUSED",
      reason: "BASIS_INCOMPATIBLE_WITH_CATEGORY",
      detail: `Basis '${input.basis}' is not acceptable for category '${input.category}'. Allowed: ${allowed.join(", ")}.`,
    };
  }

  if (CAMPAIGN_REQUIRED_CATEGORIES.includes(input.category)) {
    if (!input.campaign) {
      return {
        status: "REFUSED",
        reason: "CAMPAIGN_MISSING_FOR_RECRUITMENT_OR_MARKETING",
        detail: `Category '${input.category}' requires an approved campaign for audit and budget control.`,
      };
    }
    if (input.campaign.status !== "active" || !input.campaign.approvedAt) {
      return {
        status: "REFUSED",
        reason: "CAMPAIGN_NOT_APPROVED",
        detail: `Campaign '${input.campaign.campaignKey}' has status='${input.campaign.status}' · approved_at=${input.campaign.approvedAt?.toISOString() ?? "null"}. Both must be set.`,
      };
    }
  }

  return {
    status: "ALLOWED",
    category: input.category,
    basis: input.basis,
    note: `category '${input.category}' + basis '${input.basis}' permitted${input.campaign ? ` under campaign '${input.campaign.campaignKey}'` : ""}`,
  };
}
