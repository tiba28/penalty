import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

// 成立済みの罰の「削除」を提案（誰でも可）。本人以外の全員承認で削除。
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const { data: p } = await supabaseAdmin
    .from("punishments")
    .select("id, group_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!p) return NextResponse.json({ ok: false, error: "罰が見つかりません" }, { status: 404 });
  if (p.group_id !== session.groupId) {
    return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }
  if (p.status !== "active") {
    return NextResponse.json({ ok: false, error: "成立済みの罰にのみ削除提案できます" }, { status: 409 });
  }

  // 前ラウンドの投票をクリアして削除ラウンド開始
  await supabaseAdmin.from("punishment_votes").delete().eq("punishment_id", p.id);
  await supabaseAdmin
    .from("punishments")
    .update({
      status: "delete_pending",
      proposed_by: session.memberId,
      deadline: new Date(Date.now() + 48 * 3_600_000).toISOString(),
      decided_at: null,
    })
    .eq("id", p.id);

  // 提案者以外がいなければ即削除
  const { count } = await supabaseAdmin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", p.group_id);
  if ((count ?? 0) <= 1) {
    await supabaseAdmin.from("punishments").delete().eq("id", p.id);
  }

  return NextResponse.json({ ok: true });
}
