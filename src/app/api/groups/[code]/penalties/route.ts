import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import type { Penalty, PenaltyStatus } from "@/lib/types";

function effectiveStatus(p: Pick<Penalty, "status" | "deadline">): PenaltyStatus {
  if (p.status === "pending" && new Date(p.deadline).getTime() < Date.now()) {
    return "rejected";
  }
  return p.status;
}

// 加点一覧 ＋ 申請フォーム用データ（対象候補・成立ルール）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const [{ data: members }, { data: rules }, { data: penalties }] = await Promise.all([
    supabaseAdmin
      .from("members")
      .select("id, name")
      .eq("group_id", auth.group.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("rules")
      .select("id, description, points")
      .eq("group_id", auth.group.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("penalties")
      .select("*")
      .eq("group_id", auth.group.id)
      .order("created_at", { ascending: false }),
  ]);

  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));
  const ruleName = new Map((rules ?? []).map((r) => [r.id, r.description]));

  // ルール名は却下済み等でも出したいので、全ルールも引く
  const { data: allRules } = await supabaseAdmin
    .from("rules")
    .select("id, description")
    .eq("group_id", auth.group.id);
  for (const r of allRules ?? []) ruleName.set(r.id, r.description);

  const list = ((penalties ?? []) as Penalty[]).map((p) => {
    const status = effectiveStatus(p);
    const iAmTarget = p.target_member_id === auth.memberId;
    const description =
      p.source === "ai"
        ? `🤖 ${p.ai_situation ?? "AI判定"}`
        : (p.rule_id ? ruleName.get(p.rule_id) : null) ?? "?";
    return {
      id: p.id,
      targetName: memberName.get(p.target_member_id) ?? "?",
      appliedByName: memberName.get(p.applied_by) ?? "?",
      ruleDescription: description,
      source: p.source,
      aiReason: p.ai_reason,
      points: p.points,
      status,
      createdAt: p.created_at,
      deadline: p.deadline,
      iAmTarget,
      canRespond: status === "pending" && iAmTarget,
    };
  });

  return NextResponse.json({
    ok: true,
    myMemberId: auth.memberId,
    targets: (members ?? [])
      .filter((m) => m.id !== auth.memberId)
      .map((m) => ({ id: m.id, name: m.name })),
    rules: (rules ?? []).map((r) => ({
      id: r.id,
      description: r.description,
      points: r.points,
    })),
    penalties: list,
  });
}

// 加点申請（申請者 ≠ 当人）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { targetMemberId?: unknown; ruleId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const targetMemberId = typeof body.targetMemberId === "string" ? body.targetMemberId : "";
  const ruleId = typeof body.ruleId === "string" ? body.ruleId : "";

  if (!targetMemberId || !ruleId) {
    return NextResponse.json({ ok: false, error: "対象とルールを選んでください" }, { status: 400 });
  }
  if (targetMemberId === auth.memberId) {
    return NextResponse.json({ ok: false, error: "自分には加点できません" }, { status: 400 });
  }

  // 対象がグループ所属か
  const { data: target } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("id", targetMemberId)
    .eq("group_id", auth.group.id)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ ok: false, error: "対象メンバーが不正です" }, { status: 400 });
  }

  // 成立済みルールのみ加点に使える
  const { data: rule } = await supabaseAdmin
    .from("rules")
    .select("id, description, points, status")
    .eq("id", ruleId)
    .eq("group_id", auth.group.id)
    .maybeSingle();
  if (!rule || rule.status !== "active") {
    return NextResponse.json({ ok: false, error: "成立済みのルールを選んでください" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("penalties").insert({
    group_id: auth.group.id,
    target_member_id: targetMemberId,
    rule_id: ruleId,
    points: rule.points,
    applied_by: auth.memberId,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: "加点申請に失敗しました" }, { status: 500 });
  }

  // タイムライン記録
  const { data: nm } = await supabaseAdmin
    .from("members")
    .select("id, name")
    .in("id", [auth.memberId, targetMemberId]);
  const nameOf = new Map((nm ?? []).map((m) => [m.id, m.name]));
  await logEvent(
    auth.group.id,
    auth.memberId,
    "penalty_applied",
    `${nameOf.get(auth.memberId) ?? "誰か"} が ${nameOf.get(targetMemberId) ?? "誰か"} に「${rule.description}」で加点申請(${rule.points}点)`,
  );

  return NextResponse.json({ ok: true });
}
