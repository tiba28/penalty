import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateInviteCode } from "@/lib/invite";
import type { PeriodType } from "@/lib/types";

const PERIOD_TYPES: PeriodType[] = ["cumulative", "monthly", "oneshot"];

type Body = {
  groupName?: unknown;
  creatorName?: unknown;
  memberNames?: unknown;
  periodType?: unknown;
  periodEnd?: unknown;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const groupName = typeof body.groupName === "string" ? body.groupName.trim() : "";
  const creatorName = typeof body.creatorName === "string" ? body.creatorName.trim() : "";
  const periodType = body.periodType as PeriodType;
  const periodEnd =
    typeof body.periodEnd === "string" && body.periodEnd.trim() !== ""
      ? body.periodEnd.trim()
      : null;
  const otherNames = Array.isArray(body.memberNames)
    ? body.memberNames
        .filter((n): n is string => typeof n === "string")
        .map((n) => n.trim())
        .filter((n) => n !== "")
    : [];

  // --- バリデーション ---
  if (!groupName) {
    return NextResponse.json({ ok: false, error: "グループ名を入力してください" }, { status: 400 });
  }
  if (!creatorName) {
    return NextResponse.json({ ok: false, error: "あなたの名前を入力してください" }, { status: 400 });
  }
  if (!PERIOD_TYPES.includes(periodType)) {
    return NextResponse.json({ ok: false, error: "集計期間の指定が不正です" }, { status: 400 });
  }
  if (periodType === "oneshot" && !periodEnd) {
    return NextResponse.json(
      { ok: false, error: "単発の場合は最終日を指定してください" },
      { status: 400 },
    );
  }

  const allNames = [creatorName, ...otherNames];
  if (allNames.length > 10) {
    return NextResponse.json(
      { ok: false, error: "メンバーは最大10人までです（あなたを含む）" },
      { status: 400 },
    );
  }
  const lowerSet = new Set(allNames.map((n) => n.toLowerCase()));
  if (lowerSet.size !== allNames.length) {
    return NextResponse.json({ ok: false, error: "メンバー名が重複しています" }, { status: 400 });
  }

  // --- グループ作成（invite_code 衝突時は数回リトライ）---
  let group: { id: string; invite_code: string } | null = null;
  for (let attempt = 0; attempt < 3 && !group; attempt++) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabaseAdmin
      .from("groups")
      .insert({
        name: groupName,
        invite_code: inviteCode,
        period_type: periodType,
        period_end: periodEnd,
      })
      .select("id, invite_code")
      .single();

    if (!error && data) {
      group = data;
      break;
    }
    // 23505 = unique 制約違反（invite_code 衝突）→ リトライ。それ以外は即エラー
    if (error && error.code !== "23505") {
      return NextResponse.json(
        { ok: false, error: "グループ作成に失敗しました" },
        { status: 500 },
      );
    }
  }

  if (!group) {
    return NextResponse.json({ ok: false, error: "グループ作成に失敗しました" }, { status: 500 });
  }

  // --- メンバー作成（作成者 + その他）---
  const memberRows = allNames.map((name, i) => ({
    group_id: group!.id,
    name,
    is_creator: i === 0,
  }));

  const { error: memberError } = await supabaseAdmin.from("members").insert(memberRows);
  if (memberError) {
    // 後片付け（グループごと削除）
    await supabaseAdmin.from("groups").delete().eq("id", group.id);
    return NextResponse.json(
      { ok: false, error: "メンバー登録に失敗しました" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, inviteCode: group.invite_code });
}
