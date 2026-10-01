"use client";

// src/app/nex-native/_trust-scan/TrustScanTrading.tsx
//
// Trading reputation block · completed trades · completion rate ·
// refunds · unresolved disputes · confirmed fraud findings · safe-trade
// acknowledgement · seller activity badge.

import * as React from "react";
import { TrustScanBlock, TrustScanRow } from "./TrustScanSignals";
import type {
  TrustScanTradingData,
  TrustScanSkin,
} from "./trust-scan-types";

export function TrustScanTrading({
  data,
  skin,
}: {
  data: TrustScanTradingData;
  skin: TrustScanSkin;
}): React.JSX.Element {
  const activityColor =
    data.sellerActivity === "active"
      ? skin.colors.success
      : data.sellerActivity === "slow"
        ? skin.colors.warn
        : data.sellerActivity === "archived"
          ? skin.colors.danger
          : skin.colors.textMuted;
  const activityLabel = data.sellerActivity ?? "N/A";
  return (
    <TrustScanBlock eyebrow="Trading reputation" skin={skin}>
      <TrustScanRow
        label="Completed trades"
        value={data.completedTrades}
        skin={skin}
      />
      <TrustScanRow
        label="Completion rate"
        value={`${data.completionRate}%`}
        valueColor={
          data.completionRate >= 95
            ? skin.colors.success
            : data.completionRate >= 85
              ? skin.colors.textPrimary
              : skin.colors.warn
        }
        skin={skin}
      />
      <TrustScanRow label="Refunds" value={data.refunds} skin={skin} />
      <TrustScanRow
        label="Unresolved disputes"
        value={data.unresolvedDisputes}
        valueColor={
          data.unresolvedDisputes > 0 ? skin.colors.warn : skin.colors.textPrimary
        }
        skin={skin}
      />
      <TrustScanRow
        label="Confirmed fraud findings"
        value={data.confirmedFraudFindings}
        valueColor={
          data.confirmedFraudFindings > 0
            ? skin.colors.danger
            : skin.colors.textPrimary
        }
        skin={skin}
      />
      <TrustScanRow
        label="Safe Trade acknowledged"
        value={data.safeTradeAcknowledged ? "Yes" : "No"}
        valueColor={
          data.safeTradeAcknowledged ? skin.colors.success : skin.colors.warn
        }
        skin={skin}
      />
      <TrustScanRow
        label="Seller activity"
        value={activityLabel}
        valueColor={activityColor}
        skin={skin}
      />
    </TrustScanBlock>
  );
}
