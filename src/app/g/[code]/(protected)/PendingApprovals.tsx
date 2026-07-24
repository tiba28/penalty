"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PendingRule = {
  id: string;
  description: string;
  points: number;
  proposedByName: string;
  isMine: boolean;
  approvedCount: number;
  neededCount: number;
  myVote: "approve" | "reject" | null;
  canVote: boolean;
};

type PendingPenalty = {
  id: string;
  appliedByName: string;
  ruleDescription: string;
  points: number;
};

// ホーム上部の「要対応」領域：あなた宛の加点承認 ＋ 提案中のルール
export default function PendingApprovals({ code }: { code: string }) {
  const router = useRouter();
  const [rules, setRules] = useState<PendingRule[]>([]);
  const [penalties, setPenalties] = useState<PendingPenalty[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rr, pr] = await Promise.all([
      fetch(`/api/groups/${code}/rules`).then((r) => r.json()),
      fetch(`/api/groups/${code}/penalties`).then((r) => r.json()),
    ]);
    if (rr.ok) {
      setRules(rr.rules.filter((x: PendingRule & { status: string }) => x.status === "pending"));
    }
    if (pr.ok) {
      setPenalties(pr.penalties.filter((x: { canRespond: boolean }) => x.canRespond));
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshAll() {
    await load();
    router.refresh(); // ランキング等のサーバー側表示も更新
  }

  async function voteRule(id: string, approve: boolean) {
    setBusy(id);
    try {
      await fetch(`/api/rules/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve }),
      });
      await refreshAll();
    } finally {
      setBusy(null);
    }
  }

  async function respondPenalty(id: string, accept: boolean) {
    setBusy(id);
    try {
      await fetch(`/api/penalties/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      await refreshAll();
    } finally {
      setBusy(null);
    }
  }

  if (rules.length === 0 && penalties.length === 0) return null;

  return (
    <div className="mb-6 space-y-6">
      {penalties.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium">あなたへの加点（承認待ち）</h2>
          <ul className="space-y-2">
            {penalties.map((p) => (
              <li key={p.id} className="rounded-lg border border-amber-300 p-3 dark:border-amber-700">
                <p className="text-sm">
                  {p.appliedByName} より「{p.ruleDescription}」
                  <span className="font-semibold"> +{p.points}点</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => respondPenalty(p.id, true)}
                    disabled={busy === p.id}
                    className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    認める
                  </button>
                  <button
                    onClick={() => respondPenalty(p.id, false)}
                    disabled={busy === p.id}
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

      {rules.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium">提案中のルール</h2>
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="rounded-lg border border-amber-300 p-3 dark:border-amber-700">
                <p className="text-sm">
                  {r.description} <span className="text-gray-500">= {r.points}点</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  提案: {r.proposedByName}・承認 {r.approvedCount}/{r.neededCount}
                </p>
                {r.canVote ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => voteRule(r.id, true)}
                      disabled={busy === r.id}
                      className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => voteRule(r.id, false)}
                      disabled={busy === r.id}
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
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
