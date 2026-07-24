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

  return <>{children}</>;
}
