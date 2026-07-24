// Author Studio backend — public barrel.

export { nexAuthorStudioEnabled } from "./_flag";
export {
  AUTHOR_COOKIE_NAME,
  allowedAuthorIds,
  isAllowedAuthorId,
  issueInviteToken,
  verifyInviteToken,
  authorCookieValue,
  verifyAuthorCookie,
  setAuthorSessionCookie,
  clearAuthorSessionCookie,
  getAuthorFromCookie
} from "./_session";
export {
  writeDraft,
  readDraft,
  listDraftsForBrain,
  type DraftKey,
  type DraftRecord
} from "./_draft_store";
export {
  exportPackFromDrafts,
  writePackToDisk,
  type ExportResult
} from "./_pack_exporter";
export {
  scaffoldManifest,
  scaffoldModule,
  type ScaffoldHeaderInput
} from "./_scaffold";
