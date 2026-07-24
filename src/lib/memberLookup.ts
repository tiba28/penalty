import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import type { Member } from "./types";

// invite_code と memberId から、そのメンバーが本当にそのグループ所属か検証して取得する
export async function findGroupAndMember(inviteCode: string, memberId: string) {
  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id")
    .eq("invite_code", inviteCode)
    .maybeSingle();

  if (!group) return { group: null, member: null as Member | null };

  const { data: member } = await supabaseAdmin
    .from("members")
    .select("*")
    .eq("id", memberId)
    .eq("group_id", group.id)
    .maybeSingle();

  return { group, member: (member as Member | null) ?? null };
}
