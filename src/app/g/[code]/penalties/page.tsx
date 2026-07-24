"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Target = { id: string; name: string };
type RuleOpt = { id: string; description: string; points: number };
type PenaltyItem = {
  id: string;
  targetName: string;
  appliedByName: string;
  ruleDescription: string;
  points: number;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
  deadline: string;
  iAmTarget: boolean;
  canRespond: boolean;
};

const STATUS_LABEL: Record<PenaltyItem["status"], string> = {
  confirmed: "確定",
  pending: "承認待ち",
  rejected: "却下",
};
const STATUS_CLASS: Record<PenaltyItem["status"], string> = {
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rejected: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function PenaltiesPage() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [rules, setRules] = useState<RuleOpt[]>([]);
  const [penalties, setPenalties] = useState<PenaltyItem[]>([]);

  const [targetId, setTargetId] = useState("");
  const [ruleId, setRuleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${code}/penalties`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "読み込みに失敗しました");
    } else {
      setTargets(data.targets);
      setRules(data.rules);
      setPenalties(data.penalties);
    }
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${code}/penalties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetMemberId: targetId, ruleId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "申請に失敗しました");
        return;
      }
      setTargetId("");
      setRuleId("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/penalties/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error ?? "応答に失敗しました");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pendingForMe = penalties.filter((p) => p.canRespond);

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href={`/g/${code}`} className="text-sm text-gray-500 underline">
        ← ダッシュボード
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">加点</h1>
      <p className="mb-6 text-sm text-gray-500">
        誰かに加点を申請すると、その本人が認めれば確定します（48時間で未回答なら却下）。
      </p>

      {/* 申請フォーム */}
      <form onSubmit={apply} className="mb-8 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <p className="text-sm font-medium">加点を申請</p>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500">
            成立済みのルールがありません。先に
            <Link href={`/g/${code}/rules`} className="underline">
              ルール
            </Link>
            を成立させてください。
          </p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-gray-500">他のメンバーがいません。</p>
        ) : (
          <>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
            >
              <option value="">誰に？</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
            >
              <option value="">どのルール？</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.description}（{r.points}点）
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={submitting || !targetId || !ruleId}
              className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {submitting ? "申請中…" : "加点を申請"}
            </button>
          </>
        )}
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* 自分宛の承認待ち */}
      {pendingForMe.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium">あなたへの加点（要応答）</h2>
          <ul className="space-y-2">
            {pendingForMe.map((p) => (
              <li key={p.id} className="rounded-lg border border-amber-300 p-3 dark:border-amber-700">
                <p className="text-sm">
                  {p.appliedByName} より「{p.ruleDescription}」
                  <span className="font-semibold"> +{p.points}点</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => respond(p.id, true)}
                    disabled={busyId === p.id}
                    className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    認める
                  </button>
                  <button
                    onClick={() => respond(p.id, false)}
                    disabled={busyId === p.id}
                    className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium dark:border-gray-700"
                  >
                    却下
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 履歴 */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">履歴</h2>
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中…</p>
        ) : penalties.length === 0 ? (
          <p className="text-sm text-gray-500">まだ加点はありません。</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {penalties.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-gray-500">{fmtDate(p.createdAt)}</span>{" "}
                    {p.appliedByName} → <span className="font-medium">{p.targetName}</span>
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {p.ruleDescription}（+{p.points}点）
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
