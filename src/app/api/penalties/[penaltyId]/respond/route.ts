import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/session";

// 加点への当人の応答（認める＝confirmed / 却下＝rejected）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ penaltyId: string }> },
) {
  const { penaltyId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  let body: { accept?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const accept = body.accept === true;

  const { data: penalty } = await supabaseAdmin
    .from("penalties")
    .select("id, group_id, target_member_id, status, deadline")
    .eq("id", penaltyId)
    .maybeSingle();

  if (!penalty) {
    return NextResponse.json({ ok: false, error: "加点が見つかりません" }, { status: 404 });
  }
  if (penalty.group_id !== session.groupId) {
    return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }
  if (penalty.target_member_id !== session.memberId) {
    return NextResponse.json({ ok: false, error: "当人のみ応答できます" }, { status: 403 });
  }
  if (penalty.status !== "pending") {
    return NextResponse.json({ ok: false, error: "この加点は既に決定済みです" }, { status: 409 });
  }
  if (new Date(penalty.deadline).getTime() < Date.now()) {
    await supabaseAdmin
      .from("penalties")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", penalty.id);
    return NextResponse.json({ ok: false, error: "期限切れのため却下されました" }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from("penalties")
    .update({
      status: accept ? "confirmed" : "rejected",
      decided_at: new Date().toISOString(),
    })
    .eq("id", penalty.id);
  if (error) {
    return NextResponse.json({ ok: false, error: "応答に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: accept ? "confirmed" : "rejected" });
}
