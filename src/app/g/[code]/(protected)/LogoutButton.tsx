"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`/g/${code}/join`);
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/30 disabled:opacity-50"
    >
      ログアウト
    </button>
  );
}
