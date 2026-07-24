import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";

// タイムライン用の出来事を記録する。ログ失敗が本処理を壊さないよう握りつぶす。
export async function logEvent(
  groupId: string,
  actorMemberId: string | null,
  type: string,
  summary: string,
): Promise<void> {
  try {
    await supabaseAdmin.from("events").insert({
      group_id: groupId,
      actor_member_id: actorMemberId,
      type,
      summary,
    });
  } catch {
    // ログは best-effort（失敗しても無視）
  }
}
