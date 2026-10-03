// src/app/nex-native/vault/home/documents/page.tsx

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconDocument } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { VaultFileList } from "../_file-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultDocumentsRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/documents");
  }
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );
  const files = await vaultFileService.listFilesInRoomForAccount(
    session.account.id,
    "documents",
  );
  return (
    <RoomShell
      title="Documents"
      subtitle="Contracts, manuals, reports"
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconDocument />}
          title="No documents yet"
          message="Upload contracts, manuals, reports and other documents here. They are visible only to you under your NEX account authentication."
          footnote="Access-controlled storage · not yet end-to-end encrypted. Phase A ships that separately."
        />
      ) : (
        <VaultFileList files={files} />
      )}
    </RoomShell>
  );
}
