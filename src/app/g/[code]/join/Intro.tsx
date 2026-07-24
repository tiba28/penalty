"use client";

import { useEffect, useRef, useState } from "react";

const SEEN_KEY = "pena_intro_seen_v1";

type Slide = { icon: string; title: string; text: string };

const SLIDES: Slide[] = [
  {
    icon: "👋",
    title: "ペナルティ帳へようこそ",
    text: "仲間内で、遅刻などの“ルール違反”に点数をつけて、ランキングと罰で盛り上がるアプリです。",
  },
  {
    icon: "📜",
    title: "① ルールを決める",
    text: "「遅刻=1点」のようなルールを提案。本人以外の全員が承認すると成立します。",
  },
  {
    icon: "➕",
    title: "② 加点する",
    text: "違反があったら加点を申請。言われた本人が認めると、点数が確定します。",
  },
  {
    icon: "🏆",
    title: "③ ランキング",
    text: "点数が貯まるほどランキング上位（ワースト）に。誰が一番かひと目でわかります。",
  },
  {
    icon: "🔥",
    title: "④ 罰が発動",
    text: "決めた点数に達すると「罰」が発動。罰の内容もみんなで決められます。",
  },
  {
    icon: "🤖",
    title: "⑤ AIに相談",
    text: "ルールに無いことは「AIに相談」。ペナルティか・何点かをAIが公平に判定します。",
  },
];

export default function Intro() {
  const [show, setShow] = useState(false);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShow(true);
    } catch {
      /* localStorage 不可なら出さない */
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

  const isLast = index === SLIDES.length - 1;
  const next = () => (isLast ? dismiss() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -40) next();
    else if (dx > 40) prev();
    touchX.current = null;
  }

  if (!show) return null;
  const slide = SLIDES[index];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900">
        {/* スキップ */}
        <div className="flex justify-end px-4 pt-3">
          <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600">
            スキップ
          </button>
        </div>

        {/* スライド */}
        <div
          className="px-6 pb-2 text-center"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-5xl shadow-lg shadow-violet-500/25">
            {slide.icon}
          </div>
          <h2 className="mt-5 text-xl font-bold">{slide.title}</h2>
          <p className="mx-auto mt-2 min-h-[3.5rem] max-w-xs text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {slide.text}
          </p>
        </div>

        {/* 進捗ドット */}
        <div className="flex justify-center gap-1.5 py-3">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}枚目へ`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-violet-500" : "w-1.5 bg-gray-300 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* 操作 */}
        <div className="flex items-center gap-2 p-4">
          {index > 0 ? (
            <button
              onClick={prev}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium dark:border-gray-700"
            >
              戻る
            </button>
          ) : (
            <span className="flex-1" />
          )}
          <button
            onClick={next}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:opacity-95"
          >
            {isLast ? "はじめる" : "次へ"}
          </button>
        </div>
      </div>
    </div>
  );
}
