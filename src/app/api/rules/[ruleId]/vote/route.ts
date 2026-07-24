import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

// ルールへの承認/却下
export async function POST(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const { ruleId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { approve?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const approve = body.approve === true;

  const { data: rule } = await supabaseAdmin
    .from("rules")
    .select("id, group_id, proposed_by, status, deadline")
    .eq("id", ruleId)
    .maybeSingle();

  if (!rule) return NextResponse.json({ ok: false, error: "ルールが見つかりません" }, { status: 404 });
  if (rule.group_id !== session.groupId) {
    return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }
  if (rule.proposed_by === session.memberId) {
    return NextResponse.json({ ok: false, error: "提案者は投票できません" }, { status: 403 });
  }
  if (rule.status !== "pending") {
    return NextResponse.json({ ok: false, error: "このルールは既に決定済みです" }, { status: 409 });
  }
  if (new Date(rule.deadline).getTime() < Date.now()) {
    await supabaseAdmin
      .from("rules")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", rule.id);
    return NextResponse.json({ ok: false, error: "期限切れのため却下されました" }, { status: 409 });
  }

  // 二重投票防止
  const { data: existing } = await supabaseAdmin
    .from("rule_votes")
    .select("member_id")
    .eq("rule_id", rule.id)
    .eq("member_id", session.memberId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: false, error: "すでに投票済みです" }, { status: 409 });
  }

  const { error: voteError } = await supabaseAdmin
    .from("rule_votes")
    .insert({ rule_id: rule.id, member_id: session.memberId, approve });
  if (voteError) {
    return NextResponse.json({ ok: false, error: "投票に失敗しました" }, { status: 500 });
  }

  // 却下: 1人でも却下で否決
  if (!approve) {
    await supabaseAdmin
      .from("rules")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", rule.id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // 承認: 提案者以外の全員が承認したら成立
  const [{ count: totalMembers }, { count: approveCount }] = await Promise.all([
    supabaseAdmin
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", rule.group_id),
    supabaseAdmin
      .from("rule_votes")
      .select("member_id", { count: "exact", head: true })
      .eq("rule_id", rule.id)
      .eq("approve", true),
  ]);

  const needed = Math.max((totalMembers ?? 0) - 1, 0);
  if ((approveCount ?? 0) >= needed) {
    await supabaseAdmin
      .from("rules")
      .update({ status: "active", decided_at: new Date().toISOString() })
      .eq("id", rule.id);
    return NextResponse.json({ ok: true, status: "active" });
  }

  return NextResponse.json({ ok: true, status: "pending" });
}
