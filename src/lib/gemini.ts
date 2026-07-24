import "server-only";

// 無料枠の Google Gemini を使う。API キーはサーバー専用（フロントに出さない）。
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// プロンプトを渡し、JSON文字列で返させてパースする。
export async function geminiGenerateJSON<T>(prompt: string): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY が未設定です（.env.local を確認）。");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini API エラー (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("AI から有効な応答が得られませんでした。");
  }

  return JSON.parse(text) as T;
}
