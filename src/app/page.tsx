import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="mb-2 text-3xl font-bold">ペナルティ帳</h1>
      <p className="mb-8 text-sm text-gray-500">
        仲間内のルール違反に点数をつけて、ランキングと罰で盛り上がる。
        ルールはみんなで決めて、加点は本人が認めて確定します。
      </p>
      <Link
        href="/create"
        className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-center font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95"
      >
        グループを作成する
      </Link>
      <p className="mt-4 text-center text-xs text-gray-500">
        参加はグループ作成者から届く招待URLから
      </p>
    </main>
  );
}
