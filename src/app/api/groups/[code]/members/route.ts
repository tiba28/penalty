import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// 参加ページ用: グループ名とメンバー一覧（claimed 状態つき）を返す
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const { data: group, error: groupError } = await supabaseAdmin
    .from("groups")
    .select("id, name")
    .eq("invite_code", code)
    .maybeSingle();

  if (groupError) {
    return NextResponse.json({ ok: false, error: "取得に失敗しました" }, { status: 500 });
  }
  if (!group) {
    return NextResponse.json({ ok: false, error: "グループが見つかりません" }, { status: 404 });
  }

  const { data: members, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id, name, password_hash")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  if (memberError) {
    return NextResponse.json({ ok: false, error: "取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    group: { name: group.name },
    members: (members ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      claimed: m.password_hash !== null,
    })),
  });
}
