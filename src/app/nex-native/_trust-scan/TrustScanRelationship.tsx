"use client";

// src/app/nex-native/_trust-scan/TrustScanRelationship.tsx
//
// Your relationship history block · first contacted · messages exchanged
// · previous transactions + disputes · blocked by you · prior reports
// by you. Only renders when relationship data is present (i.e. the
// viewer has interacted with this account before).

import * as React from "react";
import { TrustScanBlock, TrustScanRow } from "./TrustScanSignals";
import type {
  TrustScanRelationshipData,
  TrustScanSkin,
} from "./trust-scan-types";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function TrustScanRelationship({
  data,
  skin,
}: {
  data: TrustScanRelationshipData | null;
  skin: TrustScanSkin;
}): React.JSX.Element {
  if (!data) {
    return (
      <TrustScanBlock eyebrow="Your history with this account" skin={skin}>
        <div
          style={{
            color: skin.colors.textMuted,
            fontSize: 11,
            lineHeight: 1.45,
            fontFamily: skin.fontMono,
          }}
        >
          No prior interaction on record. This is your first contact.
        </div>
      </TrustScanBlock>
    );
  }
  return (
    <TrustScanBlock eyebrow="Your history with this account" skin={skin}>
      <TrustScanRow
        label="First contacted"
        value={formatDate(data.firstContactedAt)}
        skin={skin}
      />
      <TrustScanRow
        label="Messages exchanged"
        value={data.messagesExchanged}
        skin={skin}
      />
      <TrustScanRow
        label="Previous transactions"
        value={data.previousTransactions}
        skin={skin}
      />
      <TrustScanRow
        label="Previous disputes"
        value={data.previousDisputes}
        valueColor={
          data.previousDisputes > 0 ? skin.colors.warn : skin.colors.textPrimary
        }
        skin={skin}
      />
      <TrustScanRow
        label="Blocked by you"
        value={data.blockedByYou ? "Yes" : "No"}
        valueColor={data.blockedByYou ? skin.colors.danger : skin.colors.textPrimary}
        skin={skin}
      />
      <TrustScanRow
        label="Previous reports by you"
        value={data.previousReportsByYou}
        valueColor={
          data.previousReportsByYou > 0
            ? skin.colors.warn
            : skin.colors.textPrimary
        }
        skin={skin}
      />
    </TrustScanBlock>
  );
}
