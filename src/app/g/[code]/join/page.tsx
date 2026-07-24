"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type MemberItem = { id: string; name: string; claimed: boolean };

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/groups/${code}/members`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setLoadError(data.error ?? "読み込みに失敗しました");
          return;
        }
        setGroupName(data.group.name);
        setMembers(data.members);
      } catch {
        if (!cancelled) setLoadError("通信エラーが発生しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const selected = members.find((m) => m.id === selectedId) ?? null;
  const isClaim = selected ? !selected.claimed : false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = selected.claimed ? "/api/auth/login" : "/api/auth/claim";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code, memberId: selected.id, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "失敗しました");
        return;
      }
      router.push(`/g/${code}`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-md p-6 text-sm text-gray-500">読み込み中…</main>;
  }
  if (loadError) {
    return <main className="mx-auto max-w-md p-6 text-sm text-red-600">{loadError}</main>;
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-gray-500">ペナルティ帳に参加</p>
      <h1 className="mb-6 text-2xl font-bold">{groupName}</h1>

      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium">あなたの名前を選択</label>
        <div className="grid grid-cols-2 gap-2">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSelectedId(m.id);
                setPassword("");
                setError(null);
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${
                selectedId === m.id
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-gray-300 dark:border-gray-700"
              }`}
            >
              {m.name}
              {!m.claimed && (
                <span className="ml-1 text-xs opacity-70">（未登録）</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {isClaim ? "パスワードを設定（初回）" : "パスワード"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isClaim ? "4文字以上" : ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
            />
            {isClaim && (
              <p className="mt-1 text-xs text-gray-500">
                このパスワードで次回から本人としてログインします。忘れないでください（復旧機能はありません）。
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "処理中…" : isClaim ? "登録して参加" : "ログイン"}
          </button>
        </form>
      )}
    </main>
  );
}
