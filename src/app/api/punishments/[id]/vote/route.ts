import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

// 罰の提案（追加 or 削除）への承認/却下
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { approve?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const approve = body.approve === true;

  const { data: p } = await supabaseAdmin
    .from("punishments")
    .select("id, group_id, proposed_by, status, deadline")
    .eq("id", id)
    .maybeSingle();

  if (!p) return NextResponse.json({ ok: false, error: "罰が見つかりません" }, { status: 404 });
  if (p.group_id !== session.groupId) {
    return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }
  if (p.proposed_by === session.memberId) {
    return NextResponse.json({ ok: false, error: "提案者は投票できません" }, { status: 403 });
  }
  if (p.status !== "pending" && p.status !== "delete_pending") {
    return NextResponse.json({ ok: false, error: "この提案は既に決定済みです" }, { status: 409 });
  }

  const now = new Date().toISOString();

  // 期限切れの処理
  if (new Date(p.deadline).getTime() < Date.now()) {
    if (p.status === "pending") {
      await supabaseAdmin.from("punishments").update({ status: "rejected", decided_at: now }).eq("id", p.id);
    } else {
      // 削除提案が期限切れ → 成立のまま（削除失敗）。投票をリセット
      await supabaseAdmin.from("punishments").update({ status: "active", decided_at: now }).eq("id", p.id);
      await supabaseAdmin.from("punishment_votes").delete().eq("punishment_id", p.id);
    }
    return NextResponse.json({ ok: false, error: "期限切れのため決定しました" }, { status: 409 });
  }

  // 二重投票防止
  const { data: existing } = await supabaseAdmin
    .from("punishment_votes")
    .select("member_id")
    .eq("punishment_id", p.id)
    .eq("member_id", session.memberId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: "すでに投票済みです" }, { status: 409 });
  }

  const { error: voteError } = await supabaseAdmin
    .from("punishment_votes")
    .insert({ punishment_id: p.id, member_id: session.memberId, approve });
  if (voteError) {
    return NextResponse.json({ ok: false, error: "投票に失敗しました" }, { status: 500 });
  }

  // 却下：1人でも却下で否決
  if (!approve) {
    if (p.status === "pending") {
      await supabaseAdmin.from("punishments").update({ status: "rejected", decided_at: now }).eq("id", p.id);
      return NextResponse.json({ ok: true, status: "rejected" });
    } else {
      // 削除提案が却下 → 成立のまま。投票リセット
      await supabaseAdmin.from("punishments").update({ status: "active", decided_at: now }).eq("id", p.id);
      await supabaseAdmin.from("punishment_votes").delete().eq("punishment_id", p.id);
      return NextResponse.json({ ok: true, status: "active" });
    }
  }

  // 承認：提案者以外の全員が承認したら反映
  const [{ count: totalMembers }, { count: approveCount }] = await Promise.all([
    supabaseAdmin.from("members").select("id", { count: "exact", head: true }).eq("group_id", p.group_id),
    supabaseAdmin
      .from("punishment_votes")
      .select("member_id", { count: "exact", head: true })
      .eq("punishment_id", p.id)
      .eq("approve", true),
  ]);
  const needed = Math.max((totalMembers ?? 0) - 1, 0);

  if ((approveCount ?? 0) >= needed) {
    if (p.status === "pending") {
      await supabaseAdmin.from("punishments").update({ status: "active", decided_at: now }).eq("id", p.id);
      return NextResponse.json({ ok: true, status: "active" });
    } else {
      // 削除提案が全員承認 → 実際に削除
      await supabaseAdmin.from("punishments").delete().eq("id", p.id);
      return NextResponse.json({ ok: true, status: "deleted" });
    }
  }

  return NextResponse.json({ ok: true, status: p.status });
}
