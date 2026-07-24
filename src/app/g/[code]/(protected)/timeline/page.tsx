"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type EventItem = { id: string; type: string; summary: string; created_at: string };

function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const ICON: Record<string, string> = {
  ai_judged: "🤖",
  penalty_applied: "➕",
  penalty_confirmed: "✅",
  penalty_rejected: "🚫",
  rule_active: "📕",
  rule_rejected: "🗑️",
  punishment_active: "🔥",
  punishment_deleted: "🗑️",
};

export default function TimelinePage() {
  const { code } = useParams<{ code: string }>();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${code}/events`);
    const data = await res.json();
    if (data.ok) setEvents(data.events);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-md p-6">
      <Link href={`/g/${code}`} className="text-sm text-gray-500 underline">
        ← ダッシュボード
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-bold">タイムライン</h1>
      <p className="mb-6 text-sm text-gray-500">
        AIへの相談やルール成立、加点などの出来事の記録です。
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">読み込み中…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-gray-500">まだ記録がありません。</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex gap-3 rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800"
            >
              <span className="shrink-0">{ICON[e.type] ?? "•"}</span>
              <div className="min-w-0">
                <p className="leading-snug">{e.summary}</p>
                <p className="mt-0.5 text-xs text-gray-400">{fmt(e.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
