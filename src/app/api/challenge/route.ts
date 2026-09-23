import { runEventChallenge } from "@/application/run-event-challenge";
import { EventChallengeValidationError } from "@/domain/events";
import { ScenarioValidationError, type ScenarioErrorCode } from "@/domain/model";
import { challengeSchema } from "@/infrastructure/http/challenge-schema";
import { CaseHttpError, readBoundedText } from "@/infrastructure/cases/http";

const scenarioValidationMessages: Record<ScenarioErrorCode, string> = {
  VERSION_MISMATCH: "Версии данных или правил устарели. Обновите страницу.",
  INVALID_DECISIONS: "Передайте ровно пять решений по направлениям.",
  UNKNOWN_INITIATIVE: "Выбрано неизвестное мероприятие.",
  UNKNOWN_DISTRICT: "Выбран неизвестный район.",
  DIRECTION_MISMATCH: "Мероприятие не соответствует направлению решения.",
  BUDGET_EXCEEDED: "Стоимость решений превышает доступный бюджет.",
};

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = JSON.parse(await readBoundedText(request.body, 32768, 5000));
  } catch (error) {
    if (error instanceof CaseHttpError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Тело запроса должно содержать корректный JSON." }, { status: 400 });
    }
    return Response.json({ error: "Не удалось обработать запрос. Повторите попытку позже." }, { status: 500 });
  }

  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Передайте версии данных и событий, событие и ровно пять решений в каждом плане без дополнительных полей." }, { status: 400 });
  }

  try {
    const result = runEventChallenge(parsed.data);
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ScenarioValidationError) {
      return Response.json({ error: scenarioValidationMessages[error.code] }, { status: 400 });
    }
    if (error instanceof EventChallengeValidationError) {
      const message = error.code === "EVENT_PACK_VERSION_MISMATCH"
        ? "Версия событий устарела. Обновите страницу."
        : "Выбрано неизвестное городское событие.";
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ error: "Не удалось рассчитать сценарий события. Повторите попытку позже." }, { status: 500 });
  }
}
