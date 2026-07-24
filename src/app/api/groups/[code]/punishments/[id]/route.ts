import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";

// 罰の削除（作成者のみ）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code, id } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const { data: creator } = await supabaseAdmin
    .from("members")
    .select("is_creator")
    .eq("id", auth.memberId)
    .eq("group_id", auth.group.id)
    .maybeSingle();
  if (creator?.is_creator !== true) {
    return NextResponse.json({ ok: false, error: "作成者のみ削除できます" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("punishments")
    .delete()
    .eq("id", id)
    .eq("group_id", auth.group.id);
  if (error) {
    return NextResponse.json({ ok: false, error: "削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
