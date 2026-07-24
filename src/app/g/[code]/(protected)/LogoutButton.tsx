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
      className="text-sm text-gray-500 underline disabled:opacity-50"
    >
      ログアウト
    </button>
  );
}
