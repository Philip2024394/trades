// src/app/nex-native/emergency-help/trusted-contacts/page.tsx
//
// NEX Emergency Help · trusted contacts management · sealed
// 2026-10-10.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { EMERGENCY_PALETTE } from "@/components/nex-native/emergency/_palette";
import { TrustedContactsList } from "@/components/nex-native/emergency/TrustedContactsList";
import { loadTrustedContacts } from "@/components/nex-native/emergency/_mock-service";
import {
  addTrustedContactServerAction,
  removeTrustedContactServerAction,
} from "../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TrustedContactsPage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const initial = await loadTrustedContacts();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: EMERGENCY_PALETTE.bg,
        color: EMERGENCY_PALETTE.textPrimary,
        padding: "20px 20px 40px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <TrustedContactsList
          initial={initial}
          services={{
            add: addTrustedContactServerAction,
            remove: removeTrustedContactServerAction,
          }}
        />
      </div>
    </main>
  );
}
