import type { Punishment } from "./types";

export type TriggeredPunishment = {
  description: string;
  note: string; // 発動理由（例: "10点到達" / "5点ごと ×3"）
};

// 累計点数 points に対して、発動している罰を算出する（表示のみ・消化管理なし）
export function computeTriggered(
  points: number,
  punishments: Pick<Punishment, "kind" | "threshold" | "interval_points" | "description">[],
): TriggeredPunishment[] {
  const result: TriggeredPunishment[] = [];

  for (const p of punishments) {
    if (p.kind === "threshold" && p.threshold != null) {
      if (points >= p.threshold) {
        result.push({ description: p.description, note: `${p.threshold}点到達` });
      }
    } else if (p.kind === "periodic" && p.interval_points != null) {
      const times = Math.floor(points / p.interval_points);
      if (times >= 1) {
        result.push({
          description: p.description,
          note: `${p.interval_points}点ごと ×${times}`,
        });
      }
    }
  }

  return result;
}
