import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findGroupAndMember } from "@/lib/memberLookup";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

// 初回参加: 名前（memberId）を選び、パスワードを設定して本人確定（claim）する
export async function POST(req: Request) {
  let body: { inviteCode?: unknown; memberId?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }

  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : "";
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!inviteCode || !memberId) {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  if (password.length < 4) {
    return NextResponse.json(
      { ok: false, error: "パスワードは4文字以上にしてください" },
      { status: 400 },
    );
  }

  const { group, member } = await findGroupAndMember(inviteCode, memberId);
  if (!group || !member) {
    return NextResponse.json({ ok: false, error: "メンバーが見つかりません" }, { status: 404 });
  }
  if (member.password_hash !== null) {
    return NextResponse.json(
      { ok: false, error: "このメンバーは既に登録済みです。ログインしてください" },
      { status: 409 },
    );
  }

  const password_hash = await hashPassword(password);
  const { error } = await supabaseAdmin
    .from("members")
    .update({ password_hash, claimed_at: new Date().toISOString() })
    .eq("id", member.id);

  if (error) {
    return NextResponse.json({ ok: false, error: "登録に失敗しました" }, { status: 500 });
  }

  await createSession({ memberId: member.id, groupId: group.id });
  return NextResponse.json({ ok: true });
}
