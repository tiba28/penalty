"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "pena_intro_seen_v1";

const STEPS: { icon: string; text: string }[] = [
  { icon: "📜", text: "ルールをみんなで決める（例: 遅刻=1点。全員がOKして成立）" },
  { icon: "➕", text: "違反があったら加点を申請 → 言われた本人が認めたら確定" },
  { icon: "🏆", text: "点数が貯まるほどランキング上位（ワースト）に" },
  { icon: "🔥", text: "決めた点数に達すると「罰」が発動" },
  { icon: "🤖", text: "ルールに無いことは「AIに相談」でペナルティか判定できる" },
];

export default function Intro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShow(true);
    } catch {
      // localStorage 不可の環境では出さない
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* noop */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-5 text-white">
          <h2 className="text-xl font-bold">ペナルティ帳へようこそ 👋</h2>
          <p className="mt-1 text-sm text-white/85">
            仲間内で、遅刻などの“ルール違反”に点数をつけて、
            ランキングと罰で盛り上がるアプリです。
          </p>
        </div>

        <div className="p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-violet-500/80">
            使い方
          </p>
          <ul className="space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="shrink-0 text-lg">{s.icon}</span>
                <span className="leading-snug text-gray-700 dark:text-gray-300">{s.text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-gray-500">
            まずは、あなたの名前を選んで参加しましょう！
          </p>

          <button
            onClick={dismiss}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95"
          >
            はじめる
          </button>
        </div>
      </div>
    </div>
  );
}
