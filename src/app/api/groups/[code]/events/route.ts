import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";

// タイムライン（活動ログ）を新しい順に返す
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, type, summary, created_at")
    .eq("group_id", auth.group.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ ok: true, events: events ?? [] });
}
