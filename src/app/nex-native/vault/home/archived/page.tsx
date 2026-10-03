// src/app/nex-native/vault/home/archived/page.tsx

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconArchive } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { VaultFileList } from "../_file-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultArchivedRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/archived");
  }
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );
  const files = await vaultFileService.listFilesInRoomForAccount(
    session.account.id,
    "archived",
  );
  return (
    <RoomShell
      title="Archived"
      subtitle="Older files, backups"
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconArchive />}
          title="Nothing archived yet"
          message="Older files you've moved out of other rooms live here. Archiving is organisation, not secure deletion."
          footnote="Delete is a separate confirmation and permanently removes bytes from the bucket."
        />
      ) : (
        <VaultFileList files={files} />
      )}
    </RoomShell>
  );
}
