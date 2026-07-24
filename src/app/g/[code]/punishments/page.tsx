"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type PunishmentItem = {
  id: string;
  kind: "threshold" | "periodic";
  threshold: number | null;
  interval_points: number | null;
  description: string;
};

function label(p: PunishmentItem): string {
  return p.kind === "threshold"
    ? `${p.threshold}点で`
    : `${p.interval_points}点ごとに`;
}

export default function PunishmentsPage() {
  const { code } = useParams<{ code: string }>();
  const [items, setItems] = useState<PunishmentItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
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
    if (!res.ok || !data.ok) {
      setError(data.error ?? "読み込みに失敗しました");
    } else {
      setItems(data.punishments);
      setCanEdit(data.canEdit);
    }
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
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
        setError(data.error ?? "追加に失敗しました");
        return;
      }
      setDescription("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/groups/${code}/punishments/${id}`, { method: "DELETE" });
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
      <h1 className="mt-2 mb-1 text-2xl font-bold">罰</h1>
      <p className="mb-6 text-sm text-gray-500">
        点数がしきい値に達すると「罰発動」として表示されます（表示のみ・点数はリセットされません）。
      </p>

      {canEdit && (
        <form onSubmit={add} className="mb-8 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-sm font-medium">罰を追加（作成者のみ）</p>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={kind === "threshold"}
                onChange={() => setKind("threshold")}
              />
              個別しきい値
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={kind === "periodic"}
                onChange={() => setKind("periodic")}
              />
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
            <span className="text-gray-500">
              {kind === "threshold" ? "点に達したら" : "点ごとに"}
            </span>
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
            className="w-full rounded-lg bg-black py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting ? "追加中…" : "追加"}
          </button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          まだ罰が設定されていません。{canEdit ? "上のフォームから追加できます。" : "作成者の設定を待ちましょう。"}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
            >
              <span>
                <span className="text-gray-500">{label(p)}</span> {p.description}
              </span>
              {canEdit && (
                <button
                  onClick={() => remove(p.id)}
                  disabled={busyId === p.id}
                  className="shrink-0 text-xs text-red-600 underline disabled:opacity-50"
                >
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
