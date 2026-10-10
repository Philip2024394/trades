// src/app/nex-native/family-safety/create-child/[requestId]/step-2-document/_client.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GovernmentIdUploader } from "@/components/nex-native/family-safety/GovernmentIdUploader";
import type { GovernmentIdUploaderValue } from "@/components/nex-native/family-safety/GovernmentIdUploader";
import { uploadIdDocumentAction } from "@/lib/nex-native/family-safety/child-account-creation/actions";

export interface Step2DocumentClientProps {
  readonly requestId: string;
}

export function Step2DocumentClient({
  requestId,
}: Step2DocumentClientProps): React.JSX.Element {
  const router = useRouter();

  async function onSubmit(value: GovernmentIdUploaderValue): Promise<void> {
    await uploadIdDocumentAction({
      requestId,
      documentType: value.documentType,
      documentFilename: value.documentFilename,
      documentMimeType: value.documentMimeType,
      documentByteLength: value.documentByteLength,
      documentBytesBase64: value.documentBytesBase64,
      idempotencyKey: value.idempotencyKey,
    });
    router.push(
      `/nex-native/family-safety/create-child/${requestId}/step-3-review`,
    );
  }

  return <GovernmentIdUploader onSubmit={onSubmit} />;
}
