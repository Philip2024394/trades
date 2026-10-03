// src/app/nex-native/vault/home/photos/page.tsx

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconImage } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { VaultFileList } from "../_file-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultPhotosRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/photos");
  }
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );
  const files = await vaultFileService.listFilesInRoomForAccount(
    session.account.id,
    "photos",
  );
  return (
    <RoomShell
      title="Photos"
      subtitle="Site photos, designs, reference"
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconImage />}
          title="No photos yet"
          message="Upload your private photos here. Only you can list and open them under your NEX account authentication."
          footnote="Access-controlled storage · not yet end-to-end encrypted. Phase A ships that separately."
        />
      ) : (
        <VaultFileList files={files} />
      )}
    </RoomShell>
  );
}
