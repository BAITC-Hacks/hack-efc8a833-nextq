import { z } from "zod";
import type { ScenarioNarration, ScenarioNarrator } from "@/application/scenario-narrator";
import type { ScenarioResult } from "@/domain/model";

const narrationSchema = z.object({
  summary: z.string().trim().min(1),
  strengths: z.array(z.string().trim().min(1)),
  risks: z.array(z.string().trim().min(1)),
  tradeoffs: z.array(z.string().trim().min(1)),
}).strict();

const completionSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().min(1) }),
    finish_reason: z.literal("stop"),
  })).min(1),
});

const systemPrompt = `Ты аналитик учебного симулятора «Аким на 5 часов». Ответь по-русски только JSON-объектом с полями summary (непустая строка), strengths, risks, tradeoffs (массивы непустых строк, могут быть пустыми).
Объясняй только переданные сервером вычисленные факты. Данные синтетические, это условная модель, а не прогноз реального города. Не придумывай показатели, события, причинные связи и статистику. Не пересчитывай и не изменяй стоимость, бюджет или AQoL. Не обещай реальные результаты инициатив.
Направления: transport — транспорт, green — озеленение, social — социальная инфраструктура, safety — безопасность, services — городские сервисы. Все показатели от 0 до 100: больше — лучше. population — вес населения района. deltas и rawDeltas — исходные эффекты до ограничения диапазона; realizedDelta — фактическое изменение после него. Используй baseline и final для сравнения районов. impacts с kind=interaction учитываются дополнительно к мероприятиям, не считай их второй раз.
Отрази расход и остаток бюджета, AQoL до и после, сильные стороны, наблюдаемые риски и компромиссы. Учитывай районы без улучшений. Если все решения бесплатные и показатели не изменились, явно сообщи это и не выдумывай сильные стороны. Формулируй кратко. Не включай Markdown, дополнительные поля и пояснения вне JSON.`;

type NvidiaNarratorOptions = {
  apiKey?: string;
  model?: string;
  request?: typeof fetch;
  timeoutMs?: number;
};

const defaultModel = "nvidia/nemotron-3-nano-30b-a3b";

export class NvidiaScenarioNarrator implements ScenarioNarrator {
  private readonly options: NvidiaNarratorOptions;

  constructor(options: NvidiaNarratorOptions) {
    this.options = options;
  }

  async explain(result: ScenarioResult): Promise<ScenarioNarration> {
    const apiKey = this.options.apiKey?.trim();
    if (!apiKey) {
      throw new Error("NVIDIA API key is not configured");
    }
    const model = this.options.model?.trim() || defaultModel;

    const response = await (this.options.request ?? fetch)("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(result) },
        ],
        temperature: 0.2,
        max_tokens: 1800,
        stream: false,
        response_format: { type: "json_object" },
        ...(model === defaultModel ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("NVIDIA request failed");
    }

    const completion = completionSchema.parse(await response.json());
    return narrationSchema.parse(JSON.parse(completion.choices[0].message.content));
  }
}
