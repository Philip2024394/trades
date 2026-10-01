"use client";

// src/app/nex-native/_trust-scan/TrustScanIdentity.tsx
//
// Identity block · account age · declared country · country consistency
// · business verification · profile completeness · claimed vs
// provisional. Pure presentation · reads typed TrustScanIdentityData.

import * as React from "react";
import { TrustScanBlock, TrustScanRow } from "./TrustScanSignals";
import type {
  TrustScanIdentityData,
  TrustScanSkin,
} from "./trust-scan-types";

function formatAccountAge(days: number): string {
  const y = Math.floor(days / 365);
  const remDays = days - y * 365;
  const m = Math.floor(remDays / 30);
  if (y > 0 && m > 0) return `${y}y ${m}m`;
  if (y > 0) return `${y}y`;
  if (m > 0) return `${m}m`;
  return `${days}d`;
}

export function TrustScanIdentity({
  data,
  skin,
}: {
  data: TrustScanIdentityData;
  skin: TrustScanSkin;
}): React.JSX.Element {
  const consistencyColor =
    data.countryConsistency === "consistent"
      ? skin.colors.success
      : data.countryConsistency === "inconsistent"
        ? skin.colors.warn
        : skin.colors.textMuted;
  const consistencyLabel =
    data.countryConsistency === "consistent"
      ? "Consistent"
      : data.countryConsistency === "inconsistent"
        ? "Inconsistent"
        : "Unknown";
  const verifiedLabel =
    data.businessVerified === null
      ? "N/A"
      : data.businessVerified
        ? "Verified"
        : "Unverified";
  const verifiedColor =
    data.businessVerified === null
      ? skin.colors.textMuted
      : data.businessVerified
        ? skin.colors.success
        : skin.colors.warn;
  return (
    <TrustScanBlock eyebrow="Identity" skin={skin}>
      <TrustScanRow
        label="Account age"
        value={formatAccountAge(data.accountAgeDays)}
        skin={skin}
      />
      <TrustScanRow
        label="Country declared"
        value={data.countryDeclared ?? "—"}
        skin={skin}
      />
      <TrustScanRow
        label="Country consistency"
        value={consistencyLabel}
        valueColor={consistencyColor}
        skin={skin}
      />
      <TrustScanRow
        label="Business"
        value={verifiedLabel}
        valueColor={verifiedColor}
        skin={skin}
      />
      <TrustScanRow
        label="Profile completeness"
        value={`${data.profileCompleteness}%`}
        skin={skin}
      />
      <TrustScanRow
        label="Account status"
        value={data.claimed ? "Claimed" : "Provisional"}
        valueColor={data.claimed ? skin.colors.success : skin.colors.warn}
        skin={skin}
      />
    </TrustScanBlock>
  );
}
