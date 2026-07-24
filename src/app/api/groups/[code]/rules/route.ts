import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";
import type { Rule, RuleStatus } from "@/lib/types";

// 期限切れの pending は却下として扱う（バッチ無しの導出）
function effectiveStatus(rule: Pick<Rule, "status" | "deadline">): RuleStatus {
  if (rule.status === "pending" && new Date(rule.deadline).getTime() < Date.now()) {
    return "rejected";
  }
  return rule.status;
}

// ルール一覧
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const [{ data: rules }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from("rules")
      .select("*")
      .eq("group_id", auth.group.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("members").select("id, name").eq("group_id", auth.group.id),
  ]);

  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));
  const totalMembers = members?.length ?? 0;
  const neededCount = Math.max(totalMembers - 1, 0); // 提案者以外の全員

  const ruleList = (rules ?? []) as Rule[];
  const ruleIds = ruleList.map((r) => r.id);

  const { data: votes } = ruleIds.length
    ? await supabaseAdmin
        .from("rule_votes")
        .select("rule_id, member_id, approve")
        .in("rule_id", ruleIds)
    : { data: [] };

  const result = ruleList.map((r) => {
    const myVotes = (votes ?? []).filter((v) => v.rule_id === r.id);
    const approvedCount = myVotes.filter((v) => v.approve).length;
    const mine = r.proposed_by === auth.memberId;
    const myVote = myVotes.find((v) => v.member_id === auth.memberId);
    const status = effectiveStatus(r);
    return {
      id: r.id,
      description: r.description,
      points: r.points,
      status,
      proposedByName: memberName.get(r.proposed_by) ?? "?",
      isMine: mine,
      deadline: r.deadline,
      approvedCount,
      neededCount,
      myVote: myVote ? (myVote.approve ? "approve" : "reject") : null,
      canVote: status === "pending" && !mine && !myVote,
    };
  });

  return NextResponse.json({ ok: true, rules: result });
}

// ルール提案
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { description?: unknown; points?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const points = typeof body.points === "number" ? body.points : Number(body.points);

  if (!description) {
    return NextResponse.json({ ok: false, error: "内容を入力してください" }, { status: 400 });
  }
  if (!Number.isInteger(points) || points <= 0) {
    return NextResponse.json({ ok: false, error: "点数は1以上の整数で入力してください" }, { status: 400 });
  }

  const { data: rule, error } = await supabaseAdmin
    .from("rules")
    .insert({
      group_id: auth.group.id,
      description,
      points,
      proposed_by: auth.memberId,
    })
    .select("id")
    .single();

  if (error || !rule) {
    return NextResponse.json({ ok: false, error: "提案に失敗しました" }, { status: 500 });
  }

  // 提案者以外がいなければ（＝1人グループ）即成立
  const { count } = await supabaseAdmin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", auth.group.id);

  if ((count ?? 0) <= 1) {
    await supabaseAdmin
      .from("rules")
      .update({ status: "active", decided_at: new Date().toISOString() })
      .eq("id", rule.id);
  }

  return NextResponse.json({ ok: true });
}
