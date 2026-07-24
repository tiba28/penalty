"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type RuleItem = {
  id: string;
  description: string;
  points: number;
  status: "pending" | "active" | "rejected";
  proposedByName: string;
  isMine: boolean;
  deadline: string;
  approvedCount: number;
  neededCount: number;
  myVote: "approve" | "reject" | null;
  canVote: boolean;
};

const STATUS_LABEL: Record<RuleItem["status"], string> = {
  active: "成立",
  pending: "承認待ち",
  rejected: "却下",
};
const STATUS_CLASS: Record<RuleItem["status"], string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rejected: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function remainingText(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "期限切れ";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `残り約${h}時間`;
  return `残り約${Math.max(Math.floor(ms / 60_000), 1)}分`;
}

export default function RulesPage() {
  const { code } = useParams<{ code: string }>();
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${code}/rules`);
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error ?? "読み込みに失敗しました");
    } else {
      setRules(data.rules);
    }
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${code}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, points: Number(points) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "提案に失敗しました");
        return;
      }
      setDescription("");
      setPoints("1");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(ruleId: string, approve: boolean) {
    setBusyId(ruleId);
    setError(null);
    try {
      const res = await fetch(`/api/rules/${ruleId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error ?? "投票に失敗しました");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href={`/g/${code}`} className="text-sm text-gray-500 underline">
        ← ダッシュボード
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">ルール</h1>
      <p className="mb-6 text-sm text-gray-500">
        提案は「本人以外の全員が48時間以内に承認」で成立。1人でも却下、または期限切れで却下されます。
      </p>

      <form onSubmit={propose} className="mb-8 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <p className="text-sm font-medium">ルールを提案</p>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 遅刻"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
          />
          <span className="text-sm text-gray-500">点</span>
          <button
            type="submit"
            disabled={submitting}
            className="ml-auto rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting ? "提案中…" : "提案する"}
          </button>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : rules.length === 0 ? (
        <p className="text-sm text-gray-500">まだルールがありません。最初のルールを提案しましょう。</p>
      ) : (
        <ul className="space-y-3">
          {rules.map((r) => (
            <li key={r.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {r.description} <span className="text-gray-500">= {r.points}点</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">提案: {r.proposedByName}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {r.status === "pending" && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500">
                    承認 {r.approvedCount} / {r.neededCount}・{remainingText(r.deadline)}
                  </p>
                  {r.canVote ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => vote(r.id, true)}
                        disabled={busyId === r.id}
                        className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => vote(r.id, false)}
                        disabled={busyId === r.id}
                        className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium dark:border-gray-700"
                      >
                        却下
                      </button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      {r.isMine
                        ? "あなたの提案（他メンバーの承認待ち）"
                        : r.myVote === "approve"
                          ? "あなたは承認済み"
                          : r.myVote === "reject"
                            ? "あなたは却下済み"
                            : ""}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
