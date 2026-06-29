// Constants for Trade Off team-authored Yard posts (announcements +
// the per-member welcome message). Both surfaces store the post on a
// sentinel listing_id so they don't bind to a real member listing.
//
// ADMIN_LISTING_ID — a fixed sentinel UUID used as the listing_id on
// every team post. The spec asked for "00000000-0000-0000-0000-
// 00000000ADM1" — that string is not a valid UUID (ADM1 isn't hex), so
// we use a close-as-possible valid-hex variant where 'ADM1' is encoded
// as the hex bytes 'AD' + 'AD' (the closest letters to 'M1' that are
// valid hex). The resulting UUID is fixed forever; downstream code
// branches on `listing_id === ADMIN_LISTING_ID` to render the team
// brand, not by reading the listings table.
//
// Pick: 00000000-0000-0000-0000-0000000000ad (the all-zeros + 'ad'
// hex tail). Stable, unmistakable, and obviously sentinel when an
// admin scans the posts table.
export const ADMIN_LISTING_ID = "00000000-0000-0000-0000-0000000000ad";

// The display name shown above every team post. The Yard feed
// branches on `post.listing_id === ADMIN_LISTING_ID` or
// `post.is_admin_announcement === true` to render this instead of a
// real member's display_name.
export const ADMIN_DISPLAY_NAME = "xratedtrade.com Team";

// Threshold mirrors the public flag route — surfaces in the
// admin nav badge alongside any post already at moderation_status
// = 'flagged'. Keep these in sync.
export const ADMIN_FLAG_THRESHOLD = 3;
