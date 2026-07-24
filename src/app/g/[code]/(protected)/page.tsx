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

const EVENT_ICON: Record<string, string> = {
  ai_judged: "🤖",
  penalty_applied: "➕",
  penalty_confirmed: "✅",
  penalty_rejected: "🚫",
  rule_active: "📕",
  rule_rejected: "🗑️",
};

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const NAV = [
  { href: "rules", label: "ルール", sub: "提案・承認", icon: "📜" },
  { href: "penalties", label: "加点", sub: "申請・承認・履歴", icon: "➕" },
  { href: "punishments", label: "罰の設定", sub: "追加・削除を提案", icon: "🔥" },
  { href: "ai", label: "AIに相談", sub: "ペナルティ判定", icon: "🤖" },
];

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

  const [{ data: members }, ranking, { data: punishments }, { data: activeRules }, { data: events }] =
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
        .in("status", ["active", "delete_pending"])
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("rules")
        .select("id, description, points")
        .eq("group_id", group.id)
        .eq("status", "active")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("events")
        .select("id, type, summary, created_at")
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const triggeredByMember = ranking.map((r) => ({
    ...r,
    triggered: computeTriggered(r.points, punishments ?? []),
  }));
  const anyTriggered = triggeredByMember.some((r) => r.triggered.length > 0);

  const me = members?.find((m) => m.id === session.memberId);
  const isCreator = new Map((members ?? []).map((m) => [m.id, m.is_creator]));
  const claimed = new Map((members ?? []).map((m) => [m.id, m.password_hash !== null]));

  return (
    <main className="mx-auto max-w-md p-4 pb-16">
      {/* ヒーローヘッダー */}
      <header className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-5 text-white shadow-xl shadow-violet-500/20">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-white/70">
            集計: {PERIOD_LABEL[group.period_type] ?? group.period_type}
            {group.period_end ? `（〜${group.period_end}）` : ""}
          </p>
          <LogoutButton code={code} />
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{group.name}</h1>
        <p className="mt-2 text-sm text-white/80">
          こんにちは、<span className="font-semibold text-white">{me?.name ?? "メンバー"}</span> さん
        </p>
      </header>

      {/* 要対応 */}
      <PendingApprovals code={code} />

      {/* ランキング */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-500/80">
          ランキング（ワースト）
        </h2>
        <ul className="overflow-hidden rounded-2xl border border-black/5 bg-white/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          {ranking.map((r, i) => {
            const isMe = r.memberId === session.memberId;
            return (
              <li
                key={r.memberId}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                  i > 0 ? "border-t border-black/5 dark:border-white/5" : ""
                } ${isMe ? "bg-violet-500/10" : ""}`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 text-center text-base font-bold text-gray-400">
                    {RANK_MEDAL[r.rank] ?? r.rank}
                  </span>
                  <span className={isMe ? "font-semibold" : ""}>
                    {r.name}
                    {isMe && <span className="ml-1 text-xs text-violet-500">(あなた)</span>}
                    {isCreator.get(r.memberId) && (
                      <span className="ml-1 text-xs text-gray-400">作成者</span>
                    )}
                    {!claimed.get(r.memberId) && (
                      <span className="ml-1 text-xs text-gray-400">未登録</span>
                    )}
                  </span>
                </span>
                <span className="font-bold tabular-nums">{r.points}<span className="ml-0.5 text-xs font-normal text-gray-400">点</span></span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 発動中の罰 */}
      {anyTriggered && (
        <section className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-500/80">
            発動中の罰 🔥
          </h2>
          <ul className="space-y-2">
            {triggeredByMember
              .filter((r) => r.triggered.length > 0)
              .map((r) => (
                <li
                  key={r.memberId}
                  className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm"
                >
                  <span className="font-semibold">{r.name}</span>
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

      {/* ナビ */}
      <nav className="mb-8 grid grid-cols-2 gap-2">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={`/g/${code}/${n.href}`}
            className="rounded-2xl border border-black/5 bg-white/70 p-3 shadow-sm backdrop-blur transition hover:border-violet-500/40 hover:shadow-md dark:border-white/10 dark:bg-white/5"
          >
            <span className="text-lg">{n.icon}</span>
            <p className="mt-1 text-sm font-semibold">{n.label}</p>
            <p className="text-xs text-gray-400">{n.sub}</p>
          </Link>
        ))}
      </nav>

      {/* 成立したルール */}
      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-violet-500/80">
          成立したルール
        </h2>
        {(activeRules ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">まだ成立したルールはありません。</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-black/5 bg-white/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            {(activeRules ?? []).map((r, i) => (
              <li
                key={r.id}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                  i > 0 ? "border-t border-black/5 dark:border-white/5" : ""
                }`}
              >
                <span>{r.description}</span>
                <span className="font-bold tabular-nums text-gray-500">{r.points}点</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* タイムライン（成立したルールの下） */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-500/80">
            タイムライン
          </h2>
          <Link href={`/g/${code}/timeline`} className="text-xs text-violet-500 hover:underline">
            すべて見る →
          </Link>
        </div>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-gray-400">まだ記録がありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {(events ?? []).map((e) => (
              <li
                key={e.id}
                className="flex gap-2.5 rounded-2xl border border-black/5 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5"
              >
                <span className="shrink-0">{EVENT_ICON[e.type] ?? "•"}</span>
                <div className="min-w-0">
                  <p className="leading-snug">{e.summary}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{fmtTime(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
