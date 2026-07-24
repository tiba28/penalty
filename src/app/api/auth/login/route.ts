import { NextResponse } from "next/server";
import { findGroupAndMember } from "@/lib/memberLookup";
import { verifyPassword } from "@/lib/password";
import { createSession } from "@/lib/session";

// 2回目以降: 名前（memberId）とパスワードでログイン
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

  if (!inviteCode || !memberId || !password) {
    return NextResponse.json({ ok: false, error: "入力が不足しています" }, { status: 400 });
  }

  const { group, member } = await findGroupAndMember(inviteCode, memberId);
  if (!group || !member) {
    return NextResponse.json({ ok: false, error: "メンバーが見つかりません" }, { status: 404 });
  }
  if (member.password_hash === null) {
    return NextResponse.json(
      { ok: false, error: "まだパスワード未設定です。初回登録をしてください" },
      { status: 409 },
    );
  }

  const valid = await verifyPassword(password, member.password_hash);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "パスワードが違います" }, { status: 401 });
  }

  await createSession({ memberId: member.id, groupId: group.id });
  return NextResponse.json({ ok: true });
}
