"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Verdict = { isPenalty: boolean; points: number; reason: string };

export default function AiJudgePage() {
  const { code } = useParams<{ code: string }>();
  const [situation, setSituation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  async function judge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerdict(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${code}/ai-judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "判定に失敗しました");
        return;
      }
      setVerdict(data.verdict);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href={`/g/${code}`} className="text-sm text-gray-500 underline">
        ← ダッシュボード
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">AIに相談</h1>
      <p className="mb-6 text-sm text-gray-500">
        ルールに無いけど「これペナルティじゃない？」という出来事を書いて相談できます。
        AIが世間の常識と成立済みルールをふまえて、ペナルティか・何点が妥当か・理由を判定します。
        （判定はあくまで参考です）
      </p>

      <form onSubmit={judge} className="space-y-3">
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={4}
          placeholder="例: 集合時間には間に合ったけど、集合場所を勝手に変更してみんなを振り回した"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={loading || situation.trim() === ""}
          className="w-full rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "AIが判定中…" : "AIに判定してもらう"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {verdict && (
        <section className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                verdict.isPenalty
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              }`}
            >
              {verdict.isPenalty ? "ペナルティに該当" : "ペナルティではない"}
            </span>
            {verdict.isPenalty && (
              <span className="text-2xl font-bold">{verdict.points}点</span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {verdict.reason}
          </p>
          <p className="mt-3 text-xs text-gray-400">
            ※ これはAIの参考意見です。実際の加点は「加点」から成立済みルールで行ってください。
          </p>
        </section>
      )}
    </main>
  );
}
