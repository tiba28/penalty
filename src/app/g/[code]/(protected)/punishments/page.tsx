"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type PunishmentItem = {
  id: string;
  kind: "threshold" | "periodic";
  threshold: number | null;
  interval_points: number | null;
  description: string;
  status: "pending" | "active" | "rejected" | "delete_pending";
  proposedByName: string;
  isMine: boolean;
  approvedCount: number;
  neededCount: number;
  myVote: "approve" | "reject" | null;
  canVote: boolean;
  canRequestDelete: boolean;
};

function rule(p: PunishmentItem): string {
  return p.kind === "threshold" ? `${p.threshold}点で` : `${p.interval_points}点ごとに`;
}

const STATUS: Record<PunishmentItem["status"], { label: string; cls: string }> = {
  active: { label: "成立", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  pending: { label: "追加の承認待ち", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  delete_pending: { label: "削除の承認待ち", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  rejected: { label: "却下", cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
};

export default function PunishmentsPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [items, setItems] = useState<PunishmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<"threshold" | "periodic">("threshold");
  const [value, setValue] = useState("10");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${code}/punishments`);
    const data = await res.json();
    if (!res.ok || !data.ok) setError(data.error ?? "読み込みに失敗しました");
    else setItems(data.punishments);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshAll() {
    await load();
    router.refresh();
  }

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${code}/punishments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, value: Number(value), description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "提案に失敗しました");
        return;
      }
      setDescription("");
      await refreshAll();
    } finally {
      setSubmitting(false);
    }
  }

  async function vote(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/punishments/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error ?? "投票に失敗しました");
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  }

  async function requestDelete(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/punishments/${id}/request-delete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) setError(data.error ?? "削除提案に失敗しました");
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href={`/g/${code}`} className="text-sm text-gray-500 underline">
        ← ダッシュボード
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">罰</h1>
      <p className="mb-6 text-sm text-gray-500">
        追加・削除は誰でも提案でき、本人以外の全員が48時間以内に承認すると反映されます（ルールと同じ）。点数はリセットされません。
      </p>

      <form onSubmit={propose} className="mb-8 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <p className="text-sm font-medium">罰の追加を提案</p>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={kind === "threshold"} onChange={() => setKind("threshold")} />
            個別しきい値
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={kind === "periodic"} onChange={() => setKind("periodic")} />
            周期（◯点ごと）
          </label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
          />
          <span className="text-gray-500">{kind === "threshold" ? "点に達したら" : "点ごとに"}</span>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="例: 腕立て伏せ50回 / 全員におごり"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:opacity-95 disabled:opacity-50"
        >
          {submitting ? "提案中…" : "追加を提案"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">まだ罰がありません。上のフォームから提案しましょう。</p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => {
            const voting = p.status === "pending" || p.status === "delete_pending";
            return (
              <li key={p.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <span className="text-gray-500">{rule(p)}</span> {p.description}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS[p.status].cls}`}>
                    {STATUS[p.status].label}
                  </span>
                </div>

                {voting && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      {p.status === "delete_pending" ? "削除の提案" : "追加の提案"}・提案: {p.proposedByName}・承認{" "}
                      {p.approvedCount}/{p.neededCount}
                    </p>
                    {p.canVote ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => vote(p.id, true)}
                          disabled={busyId === p.id}
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => vote(p.id, false)}
                          disabled={busyId === p.id}
                          className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium dark:border-gray-700"
                        >
                          却下
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-gray-400">
                        {p.isMine
                          ? "あなたの提案（他メンバーの承認待ち）"
                          : p.myVote === "approve"
                            ? "あなたは承認済み"
                            : p.myVote === "reject"
                              ? "あなたは却下済み"
                              : ""}
                      </p>
                    )}
                  </div>
                )}

                {p.canRequestDelete && (
                  <button
                    onClick={() => requestDelete(p.id)}
                    disabled={busyId === p.id}
                    className="mt-2 text-xs text-red-600 underline disabled:opacity-50"
                  >
                    削除を提案
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
