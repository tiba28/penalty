"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Target = { id: string; name: string };
type Verdict = { isPenalty: boolean; points: number; reason: string };
type Result = { verdict: Verdict; applied: boolean; targetName: string };

export default function AiJudgePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetId, setTargetId] = useState("");
  const [situation, setSituation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const loadTargets = useCallback(async () => {
    const res = await fetch(`/api/groups/${code}/penalties`);
    const data = await res.json();
    if (data.ok) setTargets(data.targets);
  }, [code]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  async function judge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${code}/ai-judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, targetMemberId: targetId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "判定に失敗しました");
        return;
      }
      setResult({ verdict: data.verdict, applied: data.applied, targetName: data.targetName });
      if (data.applied) router.refresh();
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
        ルールに無いけど「これペナルティじゃない？」という出来事を相談できます。
        AIが世間の常識と成立済みルールをふまえて判定し、
        <span className="font-medium">ペナルティと判定されたら自動でその人へ加点申請</span>します（確定は本人の承認が必要）。
      </p>

      <form onSubmit={judge} className="space-y-3">
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        >
          <option value="">誰について？</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={4}
          placeholder="例: 集合時間には間に合ったけど、集合場所を勝手に変更してみんなを振り回した"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={loading || situation.trim() === "" || targetId === ""}
          className="w-full rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "AIが判定中…" : "AIに判定してもらう"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {result && (
        <section className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                result.verdict.isPenalty
                  ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
              }`}
            >
              {result.verdict.isPenalty ? "ペナルティに該当" : "ペナルティではない"}
            </span>
            {result.verdict.isPenalty && (
              <span className="text-2xl font-bold">{result.verdict.points}点</span>
            )}
          </div>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {result.verdict.reason}
          </p>
          {result.applied && (
            <p className="mt-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              → {result.targetName} さんへ {result.verdict.points}点の加点を申請しました。本人の承認で確定します。
            </p>
          )}
        </section>
      )}
    </main>
  );
}
