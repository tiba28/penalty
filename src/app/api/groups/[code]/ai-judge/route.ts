import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";
import { geminiGenerateJSON } from "@/lib/gemini";
import { logEvent } from "@/lib/events";

type Verdict = { isPenalty: boolean; points: number; reason: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { situation?: unknown; targetMemberId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const situation = typeof body.situation === "string" ? body.situation.trim() : "";
  const targetMemberId = typeof body.targetMemberId === "string" ? body.targetMemberId : "";

  if (!situation) {
    return NextResponse.json({ ok: false, error: "出来事を入力してください" }, { status: 400 });
  }
  if (situation.length > 1000) {
    return NextResponse.json({ ok: false, error: "長すぎます（1000文字以内）" }, { status: 400 });
  }
  if (!targetMemberId) {
    return NextResponse.json({ ok: false, error: "対象メンバーを選んでください" }, { status: 400 });
  }
  if (targetMemberId === auth.memberId) {
    return NextResponse.json({ ok: false, error: "自分は対象にできません" }, { status: 400 });
  }

  // メンバー名と対象の所属確認
  const { data: members } = await supabaseAdmin
    .from("members")
    .select("id, name")
    .eq("group_id", auth.group.id);
  const nameOf = new Map((members ?? []).map((m) => [m.id, m.name]));
  if (!nameOf.has(targetMemberId)) {
    return NextResponse.json({ ok: false, error: "対象メンバーが不正です" }, { status: 400 });
  }
  const myName = nameOf.get(auth.memberId) ?? "誰か";
  const targetName = nameOf.get(targetMemberId) ?? "誰か";

  // 成立済みルールを文脈に
  const { data: rules } = await supabaseAdmin
    .from("rules")
    .select("description, points")
    .eq("group_id", auth.group.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const ruleLines =
    rules && rules.length > 0
      ? rules.map((r) => `- ${r.description} = ${r.points}点`).join("\n")
      : "（まだ成立しているルールはありません）";

  const prompt = `あなたは仲間内の「ペナルティ帳」アプリの、公平な審判です。
以下の「出来事」が、このグループでペナルティ（罰点）に値するかを判断してください。
判断は、世間一般の常識と、このグループで既に成立しているルールを総合的に考慮し、公平に行ってください。
既存ルールに直接は当てはまらなくても、その趣旨に照らして応用的に判断してよいです。
点数は、既存ルールの相場感に合わせて妥当な整数にしてください。

# 既に成立しているルール（違反内容 = 点数）
${ruleLines}

# 出来事（${targetName} について）
${situation}

# 出力（JSONのみ。前後に文章を付けない）
{
  "isPenalty": ペナルティに該当するなら true、しないなら false,
  "points": 該当する場合の妥当な点数（1以上の整数。該当しないなら 0）,
  "reason": 判断理由を日本語で簡潔に（2〜4文）
}`;

  let verdict: Verdict;
  try {
    verdict = await geminiGenerateJSON<Verdict>(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI判定に失敗しました";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  const isPenalty = verdict.isPenalty === true;
  const points = isPenalty
    ? Math.max(1, Number.isFinite(verdict.points) ? Math.round(verdict.points) : 1)
    : 0;
  const reason = typeof verdict.reason === "string" ? verdict.reason : "";
  const situationShort = situation.length > 40 ? situation.slice(0, 40) + "…" : situation;

  // ペナルティ判定なら自動で加点申請（当人の承認で確定）
  let applied = false;
  if (isPenalty) {
    const { error } = await supabaseAdmin.from("penalties").insert({
      group_id: auth.group.id,
      target_member_id: targetMemberId,
      rule_id: null,
      source: "ai",
      ai_situation: situation,
      ai_reason: reason,
      points,
      applied_by: auth.memberId,
    });
    applied = !error;
  }

  // タイムラインに記録（採択・棄却どちらも）
  const summary = isPenalty
    ? `${myName} がAIに相談「${situationShort}」→ ペナルティ判定(${points}点)。${targetName} へ加点申請`
    : `${myName} がAIに相談「${situationShort}」→ ペナルティではないと判定`;
  await logEvent(auth.group.id, auth.memberId, "ai_judged", summary);

  return NextResponse.json({
    ok: true,
    verdict: { isPenalty, points, reason },
    applied,
    targetName,
  });
}
