// src/app/nex-native/vault/home/videos/page.tsx

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { RoomShell, EmptyState } from "../_room-shell";
import { IconVideo } from "../_room-icons";
import { mapChatThemeToDoorwaySlug } from "../_resolve-theme";
import { VaultFileList } from "../_file-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function VaultVideosRoom() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    redirect("/nex-native/sign-in?next=/nex-native/vault/home/videos");
  }
  const themeSlug = mapChatThemeToDoorwaySlug(
    (session.account.chat_theme as string | null) ?? null,
  );
  const files = await vaultFileService.listFilesInRoomForAccount(
    session.account.id,
    "videos",
  );
  return (
    <RoomShell
      title="Videos"
      subtitle="Site videos, training, walkthroughs"
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconVideo />}
          title="No videos yet"
          message="Upload videos here. Only you can list and open them under your NEX account authentication."
          footnote="Access-controlled storage · not yet end-to-end encrypted. Phase A ships that separately."
        />
      ) : (
        <VaultFileList files={files} />
      )}
    </RoomShell>
  );
}
