import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// /g/[code] 配下の保護ページ共通ガード。
// 未ログイン or 別グループのセッションなら参加/ログイン画面へ飛ばす。
export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const { data: group } = await supabaseAdmin
    .from("groups")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  const session = await getSession();
  if (!group || !session || session.groupId !== group.id) {
    redirect(`/g/${code}/join`);
  }

  const { data: me } = await supabaseAdmin
    .from("members")
    .select("name")
    .eq("id", session.memberId)
    .maybeSingle();

  return (
    <>
      {/* デバッグ用：今どのメンバーでログインしているか（右上固定） */}
      <div className="fixed right-2 top-2 z-50 rounded-full bg-black/80 px-3 py-1 text-xs text-white shadow dark:bg-white/90 dark:text-black">
        👤 {me?.name ?? "?"}
      </div>
      {children}
    </>
  );
}
