import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";
import { geminiGenerateJSON } from "@/lib/gemini";

type Verdict = { isPenalty: boolean; points: number; reason: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { situation?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const situation = typeof body.situation === "string" ? body.situation.trim() : "";
  if (!situation) {
    return NextResponse.json({ ok: false, error: "出来事を入力してください" }, { status: 400 });
  }
  if (situation.length > 1000) {
    return NextResponse.json({ ok: false, error: "長すぎます（1000文字以内）" }, { status: 400 });
  }

  // 成立済みルールを文脈として渡す
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
点数は、既存ルールの相場感（何点が何に対応しているか）に合わせて妥当な整数にしてください。

# 既に成立しているルール（違反内容 = 点数）
${ruleLines}

# 出来事
${situation}

# 出力（JSONのみ。前後に文章を付けない）
{
  "isPenalty": ペナルティに該当するなら true、しないなら false,
  "points": 該当する場合の妥当な点数（0以上の整数。該当しないなら 0）,
  "reason": 判断理由を日本語で簡潔に（2〜4文）
}`;

  let verdict: Verdict;
  try {
    verdict = await geminiGenerateJSON<Verdict>(prompt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI判定に失敗しました";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  // 念のため整形
  const points = Number.isFinite(verdict.points) ? Math.max(0, Math.round(verdict.points)) : 0;
  return NextResponse.json({
    ok: true,
    verdict: {
      isPenalty: verdict.isPenalty === true,
      points: verdict.isPenalty ? points : 0,
      reason: typeof verdict.reason === "string" ? verdict.reason : "",
    },
  });
}
