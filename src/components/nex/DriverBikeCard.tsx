// src/components/nex/DriverBikeCard.tsx
//
// DEPRECATED · compatibility shim only · one-release migration window.
// Canonical component is ProviderBikeCard (mobility doctrine v5 · Provider
// not Driver). New code MUST import ProviderBikeCard directly.
//
// Prop compat: driverName/driverRating map to providerName/providerRating.
// Remove this file after the migration window closes.

"use client";

import React from "react";
import { ProviderBikeCard, ProviderBikeCardProps } from "./ProviderBikeCard";

export interface DriverBikeCardProps
  extends Omit<ProviderBikeCardProps, "providerName" | "providerRating"> {
  driverName: string;
  driverRating?: number;
}

/** @deprecated Use ProviderBikeCard. */
export function DriverBikeCard({ driverName, driverRating, ...rest }: DriverBikeCardProps) {
  return (
    <ProviderBikeCard
      {...rest}
      providerName={driverName}
      providerRating={driverRating}
    />
  );
}
