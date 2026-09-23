import { runScenario } from "@/application/run-scenario";
import { ScenarioValidationError, type ScenarioErrorCode } from "@/domain/model";
import { scenarioSchema } from "@/infrastructure/http/scenario-schema";

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
      body = await request.json();
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
    return Response.json({ result });
  } catch (error) {
    if (error instanceof ScenarioValidationError) {
      return Response.json({ error: validationMessages[error.code] }, { status: 400 });
    }
    return Response.json({ error: "Не удалось рассчитать сценарий. Повторите попытку позже." }, { status: 500 });
  }
}
