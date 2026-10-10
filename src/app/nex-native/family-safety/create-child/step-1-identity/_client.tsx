// src/app/nex-native/family-safety/create-child/step-1-identity/_client.tsx
//
// NEX Family Safety · step 1 client island.
// Calls server action + routes to step 2 with the returned requestId.

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChildIdentityForm } from "@/components/nex-native/family-safety/ChildIdentityForm";
import type { ChildIdentityFormValue } from "@/components/nex-native/family-safety/ChildIdentityForm";
import { createChildCreationRequestAction } from "@/lib/nex-native/family-safety/child-account-creation/actions";

export function Step1IdentityClient(): React.JSX.Element {
  const router = useRouter();

  async function onSubmit(value: ChildIdentityFormValue): Promise<void> {
    const { requestId } = await createChildCreationRequestAction({
      childDisplayName: value.childDisplayName,
      childDeclaredDateOfBirth: value.childDeclaredDateOfBirth,
    });
    router.push(
      `/nex-native/family-safety/create-child/${requestId}/step-2-document`,
    );
  }

  return <ChildIdentityForm onSubmit={onSubmit} />;
}
