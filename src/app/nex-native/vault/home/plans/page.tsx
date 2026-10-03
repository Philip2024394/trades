// src/app/nex-native/vault/home/plans/page.tsx

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconBlueprint } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { VaultFileList } from "../_file-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultPlansRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/plans");
  }
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );
  const files = await vaultFileService.listFilesInRoomForAccount(
    session.account.id,
    "plans",
  );
  return (
    <RoomShell
      title="Plans & Drawings"
      subtitle="PDFs, CAD, technical drawings"
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconBlueprint />}
          title="No plans or drawings yet"
          message="Upload PDFs and technical drawings here. Open-in-browser works for formats your device supports; others download via the Open button."
          footnote="Access-controlled storage · not yet end-to-end encrypted. Phase A ships that separately."
        />
      ) : (
        <VaultFileList files={files} />
      )}
    </RoomShell>
  );
}
