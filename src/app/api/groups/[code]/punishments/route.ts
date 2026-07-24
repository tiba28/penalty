import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authGroup } from "@/lib/auth";

type PunishmentRow = {
  id: string;
  kind: "threshold" | "periodic";
  threshold: number | null;
  interval_points: number | null;
  description: string;
  status: "pending" | "active" | "rejected" | "delete_pending";
  proposed_by: string | null;
  deadline: string;
};

// 期限切れの導出：追加待ちの期限切れ→却下、削除待ちの期限切れ→成立のまま
function effectiveStatus(p: Pick<PunishmentRow, "status" | "deadline">) {
  const overdue = new Date(p.deadline).getTime() < Date.now();
  if (p.status === "pending" && overdue) return "rejected" as const;
  if (p.status === "delete_pending" && overdue) return "active" as const;
  return p.status;
}

// 罰一覧（全メンバー閲覧可）。承認状態つき
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

  const [{ data: punishments }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from("punishments")
      .select("id, kind, threshold, interval_points, description, status, proposed_by, deadline")
      .eq("group_id", auth.group.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("members").select("id, name").eq("group_id", auth.group.id),
  ]);

  const memberName = new Map((members ?? []).map((m) => [m.id, m.name]));
  const neededCount = Math.max((members?.length ?? 0) - 1, 0);

  const list = (punishments ?? []) as PunishmentRow[];
  const ids = list.map((p) => p.id);
  const { data: votes } = ids.length
    ? await supabaseAdmin
        .from("punishment_votes")
        .select("punishment_id, member_id, approve")
        .in("punishment_id", ids)
    : { data: [] };

  const result = list.map((p) => {
    const status = effectiveStatus(p);
    const myVotes = (votes ?? []).filter((v) => v.punishment_id === p.id);
    const approvedCount = myVotes.filter((v) => v.approve).length;
    const mine = p.proposed_by === auth.memberId;
    const myVote = myVotes.find((v) => v.member_id === auth.memberId);
    const voting = status === "pending" || status === "delete_pending";
    return {
      id: p.id,
      kind: p.kind,
      threshold: p.threshold,
      interval_points: p.interval_points,
      description: p.description,
      status, // pending / active / rejected / delete_pending
      proposedByName: p.proposed_by ? (memberName.get(p.proposed_by) ?? "?") : "",
      isMine: mine,
      approvedCount,
      neededCount,
      myVote: myVote ? (myVote.approve ? "approve" : "reject") : null,
      canVote: voting && !mine && !myVote,
      canRequestDelete: status === "active",
    };
  });

  return NextResponse.json({ ok: true, punishments: result });
}

// 罰の「追加」を提案（誰でも可）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const auth = await authGroup(code);
  if (!auth) return NextResponse.json({ ok: false, error: "認証が必要です" }, { status: 401 });

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

  const valueCols =
    kind === "threshold"
      ? { threshold: value, interval_points: null }
      : { threshold: null, interval_points: value };

  const { data: inserted, error } = await supabaseAdmin
    .from("punishments")
    .insert({
      group_id: auth.group.id,
      kind,
      description,
      proposed_by: auth.memberId,
      ...valueCols,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ ok: false, error: "提案に失敗しました" }, { status: 500 });
  }

  // 提案者以外がいなければ即成立
  const { count } = await supabaseAdmin
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("group_id", auth.group.id);
  if ((count ?? 0) <= 1) {
    await supabaseAdmin
      .from("punishments")
      .update({ status: "active", decided_at: new Date().toISOString() })
      .eq("id", inserted.id);
  }

  return NextResponse.json({ ok: true });
}
