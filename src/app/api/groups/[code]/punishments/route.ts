import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";

async function isCreator(groupId: string, memberId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("members")
    .select("is_creator")
    .eq("id", memberId)
    .eq("group_id", groupId)
    .maybeSingle();
  return data?.is_creator === true;
}

// 罰一覧（全メンバー閲覧可）＋ 編集可否
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const { data: punishments } = await supabaseAdmin
    .from("punishments")
    .select("id, kind, threshold, interval_points, description")
    .eq("group_id", auth.group.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ok: true,
    punishments: punishments ?? [],
    canEdit: await isCreator(auth.group.id, auth.memberId),
  });
}

// 罰の追加（MVPは作成者のみ）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });
  if (!(await isCreator(auth.group.id, auth.memberId))) {
    return NextResponse.json({ ok: false, error: "作成者のみ設定できます" }, { status: 403 });
  }

  let body: { kind?: unknown; value?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const kind = body.kind;
  const value = typeof body.value === "number" ? body.value : Number(body.value);
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (kind !== "threshold" && kind !== "periodic") {
    return NextResponse.json({ ok: false, error: "種別が不正です" }, { status: 400 });
  }
  if (!Number.isInteger(value) || value <= 0) {
    return NextResponse.json({ ok: false, error: "点数は1以上の整数で入力してください" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ ok: false, error: "罰の内容を入力してください" }, { status: 400 });
  }

  const row =
    kind === "threshold"
      ? { threshold: value, interval_points: null }
      : { threshold: null, interval_points: value };

  const { error } = await supabaseAdmin.from("punishments").insert({
    group_id: auth.group.id,
    kind,
    description,
    ...row,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: "追加に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
