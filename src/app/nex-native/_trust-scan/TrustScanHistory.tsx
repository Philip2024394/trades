"use client";

// src/app/nex-native/_trust-scan/TrustScanHistory.tsx
//
// NEX History block · orders · disputes · violations · reports (with
// substantiation count) · blocks received · report categories.

import * as React from "react";
import { TrustScanBlock, TrustScanRow } from "./TrustScanSignals";
import type {
  TrustScanHistoryData,
  TrustScanSkin,
} from "./trust-scan-types";

export function TrustScanHistory({
  data,
  skin,
}: {
  data: TrustScanHistoryData;
  skin: TrustScanSkin;
}): React.JSX.Element {
  return (
    <TrustScanBlock eyebrow="NEX History" skin={skin}>
      <TrustScanRow
        label="Completed orders"
        value={data.completedOrders}
        skin={skin}
      />
      <TrustScanRow
        label="Refunded orders"
        value={data.refundedOrders}
        skin={skin}
      />
      <TrustScanRow
        label="Cancelled orders"
        value={data.cancelledOrders}
        skin={skin}
      />
      <TrustScanRow
        label="Disputes"
        value={`${data.disputes} total · ${data.disputesResolved} resolved`}
        skin={skin}
      />
      <TrustScanRow
        label="Confirmed violations"
        value={data.confirmedViolations}
        valueColor={
          data.confirmedViolations > 0 ? skin.colors.danger : skin.colors.textPrimary
        }
        skin={skin}
      />
      <TrustScanRow
        label="Suspensions"
        value={data.suspensions}
        valueColor={
          data.suspensions > 0 ? skin.colors.danger : skin.colors.textPrimary
        }
        skin={skin}
      />
      <TrustScanRow
        label="Reports received"
        value={`${data.reportsReceived} · ${data.reportsSubstantiated} substantiated`}
        valueColor={
          data.reportsSubstantiated > 0 ? skin.colors.warn : skin.colors.textPrimary
        }
        skin={skin}
      />
      <TrustScanRow
        label="Blocks received"
        value={data.blocksReceived}
        valueColor={
          data.blocksReceived >= 5 ? skin.colors.warn : skin.colors.textPrimary
        }
        skin={skin}
      />
      {data.reportCategories.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed rgba(255,255,255,0.08)",
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {data.reportCategories.map((cat) => (
            <span
              key={cat.category}
              style={{
                padding: "4px 9px",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: "0.08em",
                color: skin.colors.textMuted,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${skin.colors.rim}`,
                fontFamily: skin.fontMono,
              }}
            >
              {cat.category} · {cat.count}
              {cat.substantiated > 0 ? ` (${cat.substantiated})` : ""}
            </span>
          ))}
        </div>
      )}
    </TrustScanBlock>
  );
}
