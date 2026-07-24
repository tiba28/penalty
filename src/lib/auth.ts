import "server-only";
import { getSession } from "./session";
import { supabaseAdmin } from "./supabaseAdmin";

// invite_code のグループに、ログイン中メンバーが所属しているか検証する。
// OK なら { group, memberId } を返し、未ログイン/不一致なら null。
export async function authGroup(code: string) {
  const session = await getSession();
  if (!session) return null;

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id, name, invite_code, period_type, period_end")
    .eq("invite_code", code)
    .maybeSingle();

  if (!group || group.id !== session.groupId) return null;

  return { group, memberId: session.memberId };
}
