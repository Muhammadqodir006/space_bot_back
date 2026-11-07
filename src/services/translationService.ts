import { createHash } from "crypto";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

export type TargetLang = "uz" | "en";

const PROMPTS: Record<TargetLang, string> = {
  uz:
    "Sen tarjimonsan. Berilgan inglizcha matnni oddiy, tushunarli o'zbek tiliga (lotin yozuvida) tarjima qil. " +
    "Ilmiy nomlar, raqamlar va o'lchov birliklarini saqla. Faqat tarjimani qaytar, izoh yozma.",
  en:
    "You translate a short search query about space and astronomy from Uzbek into English. " +
    "If it is already English, return it unchanged. Return only a few English keywords, one line, no explanation.",
};

function clean(text: string) {
  // ba'zi modellar <think>...</think> qaytaradi
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

async function translateWithGroq(text: string, system: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq xatosi: ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return clean(data.choices[0].message.content);
}

async function translateWithGemini(text: string, system: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": env.GEMINI_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini xatosi: ${res.status}`);
  const data = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return clean(data.candidates[0].content.parts[0].text);
}

// Tarjima qiladi, DB'da keshlaydi. Hech biri ishlamasa null qaytaradi.
export async function translateText(
  text: string,
  target: TargetLang = "uz",
): Promise<string | null> {
  const hash = createHash("sha256").update(`${target}:${text}`).digest("hex");

  const cached = await prisma.translationCache.findUnique({ where: { hash } });
  if (cached) return cached.result;

  const system = PROMPTS[target];
  const providers: { name: string; run: () => Promise<string> }[] = [];
  if (env.GROQ_API_KEY && env.GROQ_MODEL) {
    providers.push({ name: "groq", run: () => translateWithGroq(text, system) });
  }
  if (env.GEMINI_API_KEY && env.GEMINI_MODEL) {
    providers.push({ name: "gemini", run: () => translateWithGemini(text, system) });
  }

  if (providers.length === 0) {
    console.warn("⚠️ Tarjima ishlamaydi: .env da KEY yoki MODEL yo'q");
  }

  for (const p of providers) {
    try {
      const result = await p.run();
      if (!result) continue;
      await prisma.translationCache.upsert({
        where: { hash },
        update: {},
        create: { hash, sourceText: text, targetLang: target, result, provider: p.name },
      });
      return result;
    } catch (err) {
      console.warn(`⚠️ ${p.name} tarjima bermadi:`, (err as Error).message);
    }
  }
  return null;
}