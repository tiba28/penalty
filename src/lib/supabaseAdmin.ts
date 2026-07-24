import "server-only";
import { createClient } from "@supabase/supabase-js";

// サーバー専用の Supabase クライアント。
// service_role 鍵は RLS をバイパスするため、絶対にブラウザへ渡さない。
// （このファイルは "server-only" により、クライアントから import するとビルドで失敗する）

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "サーバー用 Supabase の環境変数が未設定です。.env.local に NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
