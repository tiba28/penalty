"use client";

import { useState } from "react";
import Link from "next/link";
import type { PeriodType } from "@/lib/types";

export default function CreateGroupPage() {
  const [groupName, setGroupName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [otherNames, setOtherNames] = useState<string[]>([""]);
  const [periodType, setPeriodType] = useState<PeriodType>("cumulative");
  const [periodEnd, setPeriodEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const totalMembers = 1 + otherNames.filter((n) => n.trim() !== "").length;

  function updateOther(index: number, value: string) {
    setOtherNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  }
  function addOther() {
    if (1 + otherNames.length >= 10) return;
    setOtherNames((prev) => [...prev, ""]);
  }
  function removeOther(index: number) {
    setOtherNames((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupName,
          creatorName,
          memberNames: otherNames,
          periodType,
          periodEnd: periodType === "oneshot" ? periodEnd : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      setInviteCode(data.inviteCode);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (inviteCode) {
    const joinPath = `/g/${inviteCode}/join`;
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}${joinPath}` : joinPath;
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-2xl font-bold">グループを作成しました 🎉</h1>
        <p className="mb-4 text-sm text-gray-500">
          この招待URLをメンバーに共有してください。各自が名前を選んでパスワードを設定すると参加できます。
        </p>
        <div className="mb-3 rounded-lg border border-gray-300 p-3 text-sm break-all dark:border-gray-700">
          {joinUrl}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            {copied ? "コピーしました" : "URLをコピー"}
          </button>
          <Link
            href={joinPath}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-700"
          >
            参加ページを開く
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-2xl font-bold">グループを作成</h1>
      <p className="mb-6 text-sm text-gray-500">
        メンバーと集計期間は作成時に確定します（あとから変更できません）。
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium">グループ名</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="例: テニスサークル"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">あなたの名前</label>
          <input
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
            placeholder="例: たろう"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium">その他のメンバー</label>
            <span className="text-xs text-gray-500">{totalMembers} / 10 人</span>
          </div>
          <div className="space-y-2">
            {otherNames.map((name, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => updateOther(i, e.target.value)}
                  placeholder={`メンバー ${i + 1}`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => removeOther(i)}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm dark:border-gray-700"
                  aria-label="削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {1 + otherNames.length < 10 && (
            <button
              type="button"
              onClick={addOther}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400"
            >
              ＋ メンバーを追加
            </button>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">集計期間</label>
          <div className="space-y-2">
            {(
              [
                ["cumulative", "累計（ずっと積み上げ）"],
                ["monthly", "月ごとにリセット"],
                ["oneshot", "単発（最終日を指定）"],
              ] as [PeriodType, string][]
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="periodType"
                  checked={periodType === value}
                  onChange={() => setPeriodType(value)}
                />
                {label}
              </label>
            ))}
          </div>
          {periodType === "oneshot" && (
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-2 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-black py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "作成中…" : "グループを作成"}
        </button>
      </form>
    </main>
  );
}
