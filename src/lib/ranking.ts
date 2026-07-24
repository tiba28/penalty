import "server-only";
import { supabaseAdmin } from "./supabaseAdmin";
import type { PeriodType } from "./types";

export type RankRow = {
  memberId: string;
  name: string;
  points: number;
  rank: number;
};

// JST（UTC+9）での今月1日00:00を ISO 文字列で返す
function jstMonthStartIso(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  const startUtcMs = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 3_600_000;
  return new Date(startUtcMs).toISOString();
}

// 確定済み加点を集計してランキングを返す（同点は同順位＝1,1,3）
export async function computeRanking(
  groupId: string,
  periodType: PeriodType,
): Promise<RankRow[]> {
  let query = supabaseAdmin
    .from("penalties")
    .select("target_member_id, points")
    .eq("group_id", groupId)
    .eq("status", "confirmed");

  // monthly のみ当月で絞る。cumulative / oneshot は全確定分を積み上げ
  if (periodType === "monthly") {
    query = query.gte("created_at", jstMonthStartIso());
  }

  const [{ data: penalties }, { data: members }] = await Promise.all([
    query,
    supabaseAdmin
      .from("members")
      .select("id, name")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true }),
  ]);

  const totals = new Map<string, number>();
  for (const p of penalties ?? []) {
    totals.set(p.target_member_id, (totals.get(p.target_member_id) ?? 0) + p.points);
  }

  const rows = (members ?? [])
    .map((m) => ({ memberId: m.id, name: m.name, points: totals.get(m.id) ?? 0 }))
    .sort((a, b) => b.points - a.points);

  // 同点は同順位
  let lastPoints: number | null = null;
  let lastRank = 0;
  return rows.map((r, i) => {
    if (lastPoints === null || r.points !== lastPoints) {
      lastRank = i + 1;
      lastPoints = r.points;
    }
    return { ...r, rank: lastRank };
  });
}
