// src/app/nex-native/vault/home/important/page.tsx

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconLock } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { VaultFileList } from "../_file-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultImportantRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/important");
  }
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );
  const files = await vaultFileService.listFilesInRoomForAccount(
    session.account.id,
    "important",
  );
  return (
    <RoomShell
      title="Important"
      subtitle="Items you flag as important"
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconLock />}
          title="Nothing marked important yet"
          message="Store contracts, certificates, credentials and anything else you want fast access to. Only you can list them under your NEX account authentication."
          footnote="Website passwords and recovery codes belong to the separate Vault Secrets surface (v1.1), not here."
        />
      ) : (
        <VaultFileList files={files} />
      )}
    </RoomShell>
  );
}
