import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computeRanking } from "@/lib/ranking";
import { computeTriggered } from "@/lib/punishmentTrigger";
import type { PeriodType } from "@/lib/types";
import LogoutButton from "./LogoutButton";
import PendingApprovals from "./PendingApprovals";

const PERIOD_LABEL: Record<string, string> = {
  cumulative: "累計",
  monthly: "月ごと",
  oneshot: "単発",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id, name, period_type, period_end")
    .eq("invite_code", code)
    .maybeSingle();

  if (!group) {
    return (
      <main className="mx-auto max-w-md p-6 text-sm text-red-600">
        グループが見つかりません
      </main>
    );
  }

  const session = await getSession();
  if (!session || session.groupId !== group.id) {
    redirect(`/g/${code}/join`);
  }

  const [{ data: members }, ranking, { data: punishments }, { data: activeRules }] =
    await Promise.all([
      supabaseAdmin
        .from("members")
        .select("id, name, is_creator, password_hash")
        .eq("group_id", group.id)
        .order("created_at", { ascending: true }),
      computeRanking(group.id, group.period_type as PeriodType),
      supabaseAdmin
        .from("punishments")
        .select("kind, threshold, interval_points, description")
        .eq("group_id", group.id)
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("rules")
        .select("id, description, points")
        .eq("group_id", group.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
    ]);

  // 各メンバーの発動中の罰
  const triggeredByMember = ranking.map((r) => ({
    ...r,
    triggered: computeTriggered(r.points, punishments ?? []),
  }));
  const anyTriggered = triggeredByMember.some((r) => r.triggered.length > 0);

  const me = members?.find((m) => m.id === session.memberId);
  const isCreator = new Map((members ?? []).map((m) => [m.id, m.is_creator]));
  const claimed = new Map((members ?? []).map((m) => [m.id, m.password_hash !== null]));

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">
            集計: {PERIOD_LABEL[group.period_type] ?? group.period_type}
            {group.period_end ? `（〜${group.period_end}）` : ""}
          </p>
          <h1 className="text-2xl font-bold">{group.name}</h1>
        </div>
        <LogoutButton code={code} />
      </div>

      <p className="mb-6 text-sm">
        こんにちは、<span className="font-semibold">{me?.name ?? "メンバー"}</span> さん
      </p>

      {/* 一番上：要対応（あなた宛の加点承認・提案中のルール） */}
      <PendingApprovals code={code} />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-gray-500">ランキング（ワースト）</h2>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {ranking.map((r) => (
            <li
              key={r.memberId}
              className={`flex items-center justify-between px-3 py-2 text-sm ${
                r.memberId === session.memberId ? "bg-gray-50 dark:bg-gray-900" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-center font-semibold text-gray-500">{r.rank}</span>
                <span>
                  {r.name}
                  {isCreator.get(r.memberId) && (
                    <span className="ml-1 text-xs text-gray-500">（作成者）</span>
                  )}
                  {!claimed.get(r.memberId) && (
                    <span className="ml-1 text-xs text-gray-400">（未登録）</span>
                  )}
                </span>
              </span>
              <span className="font-semibold">{r.points}点</span>
            </li>
          ))}
        </ul>
      </section>

      {anyTriggered && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-gray-500">発動中の罰 🔥</h2>
          <ul className="space-y-2">
            {triggeredByMember
              .filter((r) => r.triggered.length > 0)
              .map((r) => (
                <li
                  key={r.memberId}
                  className="rounded-lg border border-red-200 p-3 text-sm dark:border-red-900/60"
                >
                  <span className="font-medium">{r.name}</span>
                  <ul className="mt-1 space-y-0.5">
                    {r.triggered.map((t, i) => (
                      <li key={i} className="text-gray-600 dark:text-gray-300">
                        {t.description}{" "}
                        <span className="text-xs text-gray-400">（{t.note}）</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </section>
      )}

      <nav className="grid gap-2">
        <Link
          href={`/g/${code}/rules`}
          className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium dark:border-gray-800"
        >
          ルール（提案・承認）<span className="text-gray-400">→</span>
        </Link>
        <Link
          href={`/g/${code}/penalties`}
          className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium dark:border-gray-800"
        >
          加点（申請・承認・履歴）<span className="text-gray-400">→</span>
        </Link>
        <Link
          href={`/g/${code}/punishments`}
          className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium dark:border-gray-800"
        >
          罰の設定<span className="text-gray-400">→</span>
        </Link>
      </nav>

      {/* 一番下：成立したルール一覧 */}
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-gray-500">成立したルール</h2>
        {(activeRules ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">まだ成立したルールはありません。</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {(activeRules ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{r.description}</span>
                <span className="font-semibold text-gray-500">{r.points}点</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
