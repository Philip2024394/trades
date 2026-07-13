// Follow / Unfollow button + count. The social-primitive that makes
// Trade Center feel like LinkedIn / Instagram.
//
// LocalStorage-backed for the demo; production upgrades to a Supabase
// row per follow relationship.

"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Users } from "lucide-react";
import {
  BASE_FOLLOWER_COUNTS,
  loadFollows,
  saveFollows,
  type FollowRecord,
  type FollowerType
} from "../data/socialGraph";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";

type Props = {
  targetSlug: string;
  targetName: string;
  targetType: FollowerType;
  showCount?: boolean;
  variant?: "primary" | "ghost" | "compact";
};

export function FollowButton({
  targetSlug,
  targetName,
  targetType,
  showCount = true,
  variant = "primary"
}: Props) {
  const viewer = currentViewerTrade();
  const [following, setFollowing] = useState(false);
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    const list = loadFollows();
    setFollowing(list.some((f) => f.followerSlug === viewer.slug && f.followedSlug === targetSlug));
  }, [viewer.slug, targetSlug]);

  function toggle() {
    const list = loadFollows();
    if (following) {
      const next = list.filter(
        (f) => !(f.followerSlug === viewer.slug && f.followedSlug === targetSlug)
      );
      saveFollows(next);
      setFollowing(false);
      setDelta((d) => d - 1);
    } else {
      const rec: FollowRecord = {
        followerSlug: viewer.slug,
        followedSlug: targetSlug,
        followedType: targetType,
        followedName: targetName,
        createdAtIso: new Date().toISOString()
      };
      saveFollows([...list, rec]);
      setFollowing(true);
      setDelta((d) => d + 1);
    }
  }

  const baseCount = BASE_FOLLOWER_COUNTS[targetSlug] ?? 0;
  const displayCount = baseCount + delta;

  const styleFollowing =
    variant === "compact"
      ? { backgroundColor: "#F5F0E4", color: "#0A0A0A", border: "1px solid rgba(139,69,19,0.15)" }
      : { backgroundColor: "#F5F0E4", color: "#0A0A0A", border: "1px solid rgba(139,69,19,0.20)" };
  const styleNotFollowing =
    variant === "compact"
      ? { backgroundColor: "#0A0A0A", color: "#FFB300", border: "1px solid transparent" }
      : { backgroundColor: "#166534", color: "#FFFFFF", border: "1px solid transparent" };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={following}
        className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-wider transition ${
          variant === "compact" ? "min-h-[36px] px-3 text-[10.5px]" : "min-h-[44px] px-5 text-[11.5px]"
        }`}
        style={following ? styleFollowing : styleNotFollowing}
      >
        {following ? <UserCheck size={variant === "compact" ? 11 : 13}/> : <UserPlus size={variant === "compact" ? 11 : 13}/>}
        {following ? "Following" : "Follow"}
      </button>
      {showCount && (
        <div className="inline-flex items-center gap-1 text-[11px] text-neutral-600">
          <Users size={11}/>
          <span className="font-bold text-neutral-800">{displayCount.toLocaleString()}</span>
          <span className="text-neutral-500">followers</span>
        </div>
      )}
    </div>
  );
}
