// Библиотекарь: RAG-прокси к DeepSeek.
// Ключ только в секретах (DEEPSEEK_API_KEY). verify_jwt=true — вызывать
// могут только залогиненные пользователи сайта.
// Модель отвечает ТОЛЬКО по переданным выдержкам — знания из нашей базы.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type HistoryItem = { role: "user" | "assistant"; text: string };

type RequestBody = {
  question: string;
  history?: HistoryItem[];
  context?: {
    library?: Array<{ source: string; edition: string; title: string }>;
    books?: Array<{ title: string; page: number; snippet: string }>;
    reference?: Array<{ doc: string; section: string; snippet: string }>;
    rules?: Array<{ name: string; body: string }>;
    character?: string;
    journal?: Array<{ title: string; date: string; excerpt: string }>;
  };
};

const SYSTEM_PROMPT = `Ты — Библиотекарь: вежливый, чуть старомодный хранитель знаний клуба Vampire: the Masquerade (V5 и V20).
ЖЁСТКИЕ ПРАВИЛА:
1. Отвечай ТОЛЬКО на основе материалов из блока МАТЕРИАЛЫ. Не добавляй знаний из своей памяти о правилах, даже если уверен.
2. Выдержки из книг — это результаты поиска для текущего вопроса, а не вся библиотека. Если точного ответа в них нет, скажи: «В найденных фрагментах нет точного ответа» и предложи уточнить запрос. Никогда не делай из пустой выдачи вывод, что правила нет во всей книге.
3. История диалога нужна только для понимания продолжения вопроса. Предыдущие ответы ассистента не являются источником. Если они расходятся с текущими материалами, всегда исправляй ответ по текущим материалам.
4. Приоритет источников: выдержки книг; затем правила сайта; затем справочник. Состав библиотеки — только перечень доступных книг, а не источник правил.
5. Не отрицай явно написанное правило. Формулировки «каждый раз должен», «необходимо пройти» и подобные передавай как обязательные; отдельно объясняй результат успеха и неудачи, если он указан в другом фрагменте.
6. Цитируя книгу, указывай редакцию и страницу в скобках, например: (V5, стр. 205). Можно объединять подтверждающие фрагменты с нескольких страниц.
7. OCR-опечатки в выдержках исправляй молча по смыслу.
8. Отвечай на русском, сжато и по делу: сначала прямой ответ, потом детали. Без воды.
9. Если в материалах есть данные персонажа игрока или его дневник — можешь опираться на них, это данные самого спрашивающего.
10. Правила V5 и V20 — разные редакции: если выдержки из обеих, разделяй их явно и не переноси механику одной редакции в другую.
11. Пиши обычным текстом без markdown-разметки (без **, ##, списков со звёздочками). Абзацы разделяй пустой строкой.`;

function clip(text: string, max: number): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

function buildMaterials(context: RequestBody["context"]): string {
  if (!context) return "(материалов не найдено)";
  const parts: string[] = [];
  for (const book of context.books || []) {
    parts.push(`[${book.title}, стр. ${book.page}]\n${clip(book.snippet, 1200)}`);
  }
  for (const rule of context.rules || []) {
    parts.push(`[Правила сайта: ${rule.name}]\n${clip(rule.body, 2200)}`);
  }
  for (const ref of context.reference || []) {
    parts.push(`[Справочник: ${ref.doc} → ${ref.section}]\n${clip(ref.snippet, 1200)}`);
  }
  if (context.character) {
    parts.push(`[Лист персонажа игрока]\n${clip(context.character, 3500)}`);
  }
  for (const entry of context.journal || []) {
    parts.push(`[Дневник игрока: ${entry.title} ${entry.date}]\n${clip(entry.excerpt, 900)}`);
  }
  if (context.library?.length) {
    parts.push(`[Состав библиотеки — только метаданные]\n${context.library
      .map((book) => `${book.edition}: ${book.title} (${book.source})`)
      .join("\n")}`);
  }
  return parts.length ? parts.join("\n\n") : "(материалов не найдено)";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "no_api_key" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const question = clip(body.question || "", 1000);
  if (!question) {
    return new Response(JSON.stringify({ error: "empty_question" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const materials = buildMaterials(body.context);
  const history = (body.history || []).slice(-8).map((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: clip(item.text, 1200),
  }));

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    {
      role: "user",
      content: `МАТЕРИАЛЫ:\n${materials}\n\nВОПРОС ИГРОКА: ${question}`,
    },
  ];

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("deepseek error", response.status, detail.slice(0, 500));
      return new Response(JSON.stringify({ error: "llm_failed", status: response.status }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const answer: string = data?.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ answer }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("librarian-chat failure", error);
    return new Response(JSON.stringify({ error: "llm_unreachable" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
