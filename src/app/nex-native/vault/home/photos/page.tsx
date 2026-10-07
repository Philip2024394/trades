// src/app/nex-native/vault/home/photos/page.tsx

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as vaultFileService from "@/lib/nex-native/vault-file-service";
import { resolveServerLocale, tFor } from "@/lib/nex/i18n/server";
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
  const headerBag = await headers();
  const locale = resolveServerLocale({
    accountLocale: (session.account.locale as string | null) ?? null,
    acceptLanguage: headerBag.get("accept-language"),
  });
  const t = tFor(locale);
  return (
    <RoomShell
      title={t("vault.files.rooms.photos.title")}
      subtitle={t("vault.files.rooms.photos.subtitle")}
      themeSlug={themeSlug}
    >
      {files.length === 0 ? (
        <EmptyState
          icon={<IconImage />}
          title={t("vault.files.rooms.photos.emptyTitle")}
          message={t("vault.files.rooms.photos.emptyBody")}
          footnote={t("vault.files.rooms.footnote")}
        />
      ) : (
        <VaultFileList files={files} lang={locale} />
      )}
    </RoomShell>
  );
}
