import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import LogoutButton from "./LogoutButton";

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

  const { data: members } = await supabaseAdmin
    .from("members")
    .select("id, name, is_creator, password_hash")
    .eq("group_id", group.id)
    .order("created_at", { ascending: true });

  const me = members?.find((m) => m.id === session.memberId);

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

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-gray-500">メンバー</h2>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {(members ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {m.name}
                {m.is_creator && (
                  <span className="ml-1 text-xs text-gray-500">（作成者）</span>
                )}
              </span>
              <span className="text-xs text-gray-500">
                {m.password_hash ? "参加済み" : "未登録"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <nav className="grid gap-2">
        <Link
          href={`/g/${code}/rules`}
          className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium dark:border-gray-800"
        >
          ルール（提案・承認）<span className="text-gray-400">→</span>
        </Link>
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-400 dark:border-gray-700">
          次の実装予定: 加点・ランキング・罰の設定
        </div>
      </nav>
    </main>
  );
}
