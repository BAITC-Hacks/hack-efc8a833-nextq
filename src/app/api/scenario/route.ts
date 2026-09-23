import { runScenario } from "@/application/run-scenario";
import { narrateScenario } from "@/application/scenario-narrator";
import { ScenarioValidationError, type ScenarioErrorCode } from "@/domain/model";
import { scenarioSchema } from "@/infrastructure/http/scenario-schema";
import { NvidiaScenarioNarrator } from "@/infrastructure/nvidia-scenario-narrator";
import { CaseHttpError, readBoundedText } from "@/infrastructure/cases/http";
import { caseAiLimiter } from "@/infrastructure/cases/limiter";

const validationMessages: Record<ScenarioErrorCode, string> = {
  VERSION_MISMATCH: "Версии данных или правил устарели. Обновите страницу.",
  INVALID_DECISIONS: "Выберите ровно одно решение в каждом из пяти направлений.",
  UNKNOWN_INITIATIVE: "Выбрано неизвестное мероприятие.",
  UNKNOWN_DISTRICT: "Выбран неизвестный район.",
  DIRECTION_MISMATCH: "Мероприятие не соответствует направлению решения.",
  BUDGET_EXCEEDED: "Стоимость решений превышает доступный бюджет.",
};

export async function POST(request: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = JSON.parse(await readBoundedText(request.body, 32768, 5000));
    } catch (error) {
      if (error instanceof SyntaxError) {
        return Response.json({ error: "Тело запроса должно содержать корректный JSON." }, { status: 400 });
      }
      throw error;
    }

    const parsed = scenarioSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Передайте версии данных и правил, а также ровно пять решений без дополнительных полей." }, { status: 400 });
    }

    const result = runScenario(parsed.data);
    const narrator = new NvidiaScenarioNarrator({
      apiKey: process.env.NVIDIA_API_KEY,
      model: process.env.NVIDIA_MODEL,
    });
    const narration = await narrateScenario(result, {
      explain: (value) => process.env.NVIDIA_API_KEY?.trim()
        ? caseAiLimiter.run(() => narrator.explain(value))
        : narrator.explain(value),
    });
    return Response.json({ result, narration }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CaseHttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ScenarioValidationError) {
      return Response.json({ error: validationMessages[error.code] }, { status: 400 });
    }
    return Response.json({ error: "Не удалось рассчитать сценарий. Повторите попытку позже." }, { status: 500 });
  }
}
