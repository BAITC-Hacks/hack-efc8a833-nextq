import { randomUUID } from "node:crypto";
import { cityCases, createCityCase } from "@/data/city-cases";
import { CaseValidationError, type CityCase } from "@/domain/city-case";
import { evaluateCityCase } from "@/domain/evaluate-city-case";
import { CaseHttpError, jsonResponse, readCaseRequest } from "./http";
import { CaseAiLimiter, caseAiLimiter } from "./limiter";
import { CaseAiProvider, providerConfig } from "./provider";
import { evaluationSchema, generateSchema, type EvaluationRequest } from "./schemas";
import { signCase, signingAvailable, verifyCase, type CaseEnvironment } from "./tokens";

type HandlerOptions = {
  env?: () => CaseEnvironment;
  request?: typeof fetch;
  limiter?: CaseAiLimiter;
  now?: () => number;
  timeoutMs?: number;
};

const validationMessages: Record<string, string> = {
  INVALID_CASE: "Кейс не прошёл проверку. Выберите другой кейс.",
  INVALID_DECISIONS: "Выберите ровно пять разных мер.",
  UNKNOWN_MEASURE: "Выбрана неизвестная мера.",
  UNKNOWN_DISTRICT: "Выбран неизвестный район.",
  INVALID_SCOPE: "Укажите район для районной меры. Для городской меры район не передаётся.",
  DUPLICATE_MEASURE: "Каждую меру можно выбрать только один раз.",
  DIRECTION_LIMIT: "Допустимо не более двух мер одного направления.",
  INCOMPATIBLE_MEASURES: "Выбраны несовместимые меры. Измените набор или район.",
  BUDGET_EXCEEDED: "Стоимость решений превышает бюджет 100 единиц.",
};

async function handle(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CaseHttpError) {
      const response = jsonResponse({ error: error.message, code: error.code }, error.status);
      if (error.status === 429) response.headers.set("Retry-After", "60");
      return response;
    }
    if (error instanceof CaseValidationError) {
      return jsonResponse({ error: validationMessages[error.code] ?? "Проверьте выбранные решения.", code: error.code }, 400);
    }
    return jsonResponse({ error: "Не удалось обработать запрос. Повторите попытку позже.", code: "INTERNAL_ERROR" }, 500);
  }
}

export function createCaseHandlers(options: HandlerOptions = {}) {
  const environment = options.env ?? (() => process.env);
  const limiter = options.limiter ?? caseAiLimiter;
  const now = options.now ?? Date.now;

  function resolveCase(input: EvaluationRequest): CityCase {
    if (input.caseToken) return createCityCase(verifyCase(input.caseToken, input.caseId, environment(), now()), input.caseId, "ai");
    const cityCase = cityCases.find(({ id }) => id === input.caseId);
    if (!cityCase) throw new CaseHttpError(404, "CASE_NOT_FOUND", "Кейс не найден. Для AI-кейса требуется действующий токен.");
    return cityCase;
  }

  async function readEvaluation(request: Request) {
    const parsed = evaluationSchema.safeParse(await readCaseRequest(request));
    if (!parsed.success) throw new CaseHttpError(400, "INVALID_INPUT", "Передайте ID кейса и пять решений без дополнительных полей.");
    const cityCase = resolveCase(parsed.data);
    return { cityCase, evaluation: evaluateCityCase(cityCase, { decisions: parsed.data.decisions }) };
  }

  return {
    list: () => handle(async () => {
      const env = environment();
      const config = providerConfig(env);
      return jsonResponse({ cases: cityCases, generation: { available: Boolean(config) && signingAvailable(env), provider: config?.provider ?? null } });
    }),
    generate: (request: Request) => handle(async () => {
      const parsed = generateSchema.safeParse(await readCaseRequest(request));
      if (!parsed.success) throw new CaseHttpError(400, "INVALID_INPUT", "Опишите задачу в 20–2000 символах и выберите допустимую тему.");
      const env = environment();
      const config = providerConfig(env);
      if (!config || !signingAvailable(env)) throw new CaseHttpError(503, "GENERATION_UNAVAILABLE", "AI-генерация сейчас недоступна. Выберите подготовленный кейс.");
      return limiter.run(async () => {
        const blueprint = await new CaseAiProvider(config, options.request, options.timeoutMs).generate(parsed.data.brief, parsed.data.theme);
        const id = `ai-${randomUUID()}`;
        const cityCase = createCityCase(blueprint, id, "ai");
        const token = signCase(blueprint, id, env, now());
        return jsonResponse({ case: cityCase, token, provider: config.provider, model: config.model });
      });
    }),
    evaluate: (request: Request) => handle(async () => {
      const { evaluation } = await readEvaluation(request);
      return jsonResponse({ evaluation });
    }),
    analyze: (request: Request) => handle(async () => {
      const { cityCase, evaluation } = await readEvaluation(request);
      const config = providerConfig(environment());
      if (!config) return jsonResponse({ narration: { status: "unavailable", reason: "AI-разбор сейчас недоступен. Расчёт показателей доступен без AI." } }, 503);
      return limiter.run(async () => {
        try {
          const content = await new CaseAiProvider(config, options.request, options.timeoutMs).analyze(cityCase, evaluation);
          return jsonResponse({ narration: { status: "ready", content } });
        } catch {
          return jsonResponse({ narration: { status: "unavailable", reason: "AI-провайдер временно недоступен или вернул некорректный разбор. Расчёт показателей сохранён." } }, 503);
        }
      });
    }),
  };
}

export const caseHandlers = createCaseHandlers();
