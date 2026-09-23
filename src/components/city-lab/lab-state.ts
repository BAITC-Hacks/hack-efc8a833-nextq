import { z } from "zod";
import type { CaseDecision, CaseEvaluation, CityCase } from "@/domain/city-case";
import { cityCases, createCityCase } from "@/data/city-cases";
import { evaluateCityCase } from "@/domain/evaluate-city-case";
import { blueprintSchema, caseTokenLimit, narrationSchema } from "@/infrastructure/cases/schemas";

export const storageKey = "city-lab:runs:astana-1";
export const savedRunLimit = 12;
export const storageByteLimit = 512 * 1024;
const boundedText = z.string().min(1).max(180);
const decisionSchema = z.object({ measureId: z.string().regex(/^M(?:[1-9]|1[0-4])$/), districtId: z.enum(["yesil", "almaty", "saryarka", "baikonur", "nura"]).optional() }).strict();
const savedRunSchema = z.object({
  id: boundedText, title: boundedText, caseId: boundedText, caseVersion: z.literal("astana-1"),
  source: z.enum(["curated", "ai"]), blueprint: blueprintSchema,
  caseToken: z.string().min(1).max(caseTokenLimit).optional(),
  narration: z.union([z.object({ status: z.literal("ready"), content: narrationSchema }).strict(), z.object({ status: z.literal("unavailable"), reason: z.string().max(2000) }).strict()]).nullable().optional(),
  decisions: z.array(decisionSchema).length(5).refine((items) => new Set(items.map((item) => item.measureId)).size === 5),
  aqol: z.number().min(-50).max(100), spent: z.number().min(0).max(100),
  criticalCount: z.number().int().min(0).max(50), savedAt: z.string().datetime(),
}).strict();
export type SavedRun = z.infer<typeof savedRunSchema>;

export function restoreSavedRun(run: SavedRun) {
  const cityCase = run.source === "curated"
    ? cityCases.find((item) => item.id === run.caseId)
    : /^ai-[a-zA-Z0-9-]+$/.test(run.caseId) ? createCityCase(run.blueprint, run.caseId, "ai") : undefined;
  if (!cityCase || cityCase.version !== run.caseVersion) throw new Error("Неизвестный кейс или версия сохранения.");
  const evaluation = evaluateCityCase(cityCase, { decisions: run.decisions });
  return { cityCase, evaluation, decisions: run.decisions, token: run.caseToken, narration: run.narration ?? null };
}

export function parseSavedRuns(raw: string | null): SavedRun[] {
  if (!raw || raw.length > storageByteLimit || new TextEncoder().encode(raw).byteLength > storageByteLimit) return [];
  try {
    const result = z.array(savedRunSchema).max(savedRunLimit).refine((items) => new Set(items.map((item) => item.id)).size === items.length).safeParse(JSON.parse(raw));
    if (!result.success) return [];
    return result.data.flatMap((run) => {
      try {
        const { cityCase, evaluation } = restoreSavedRun(run);
        return [{ ...run, title: cityCase.title, aqol: evaluation.result.finalAqol, spent: evaluation.result.spent, criticalCount: evaluation.result.criticalCount }];
      } catch { return []; }
    });
  } catch { return []; }
}

export function compatibleRuns(a: SavedRun, b: SavedRun): boolean {
  return a.caseId === b.caseId && a.caseVersion === b.caseVersion && a.source === b.source && (a.source === "curated" || JSON.stringify(a.blueprint) === JSON.stringify(b.blueprint));
}

export function makeSavedRun(cityCase: CityCase, decisions: CaseDecision[], evaluation: CaseEvaluation, id: string, savedAt: string, caseToken?: string, narration?: SavedRun["narration"]): SavedRun {
  return savedRunSchema.parse({ id, savedAt, title: cityCase.title, caseId: cityCase.id, caseVersion: cityCase.version, decisions,
    source: cityCase.source, caseToken, narration,
    blueprint: { title: cityCase.title, summary: cityCase.summary, theme: cityCase.theme, briefing: cityCase.briefing, districts: cityCase.city.districts.map(({ id, populationShare, indicators }) => ({ id, populationShare, indicators })) },
    aqol: evaluation.result.finalAqol, spent: evaluation.result.spent, criticalCount: evaluation.result.criticalCount });
}

export function planCost(cityCase: CityCase, decisions: CaseDecision[]): number {
  return decisions.reduce((sum, decision) => sum + (cityCase.city.measures.find((item) => item.id === decision.measureId)?.cost ?? 0), 0);
}

export function replaceDecision(decisions: CaseDecision[], replaceMeasureId: string, decision: CaseDecision): CaseDecision[] {
  return decisions.map((item) => item.measureId === replaceMeasureId ? decision : item);
}

export function planIssues(cityCase: CityCase, decisions: CaseDecision[]): string[] {
  const issues: string[] = [];
  if (decisions.length !== 5) issues.push(`Выберите ровно 5 мер. Сейчас выбрано: ${decisions.length}.`);
  if (new Set(decisions.map((item) => item.measureId)).size !== decisions.length) issues.push("Меры не должны повторяться.");
  const counts: Record<string, number> = {};
  for (const decision of decisions) {
    const measure = cityCase.city.measures.find((item) => item.id === decision.measureId);
    if (!measure) { issues.push("Неизвестная мера."); continue; }
    counts[measure.direction] = (counts[measure.direction] ?? 0) + 1;
    if (measure.scope === "district" && !cityCase.city.districts.some((item) => item.id === decision.districtId)) issues.push(`Выберите район для «${measure.name}».`);
    if (measure.scope === "city" && decision.districtId) issues.push(`«${measure.name}» действует на весь город и не требует района.`);
  }
  if (Object.values(counts).some((count) => count > 2)) issues.push("Допустимо не больше 2 мер одного направления.");
  if (planCost(cityCase, decisions) > cityCase.city.budget) issues.push("Бюджет превышен. Выберите более доступные меры.");
  const byId = new Map(decisions.map((item) => [item.measureId, item]));
  if (byId.has("M1") && byId.has("M3")) issues.push("M1 и M3 несовместимы в любых районах.");
  for (const [a, b] of [["M4", "M7"], ["M5", "M13"]]) {
    if (byId.has(a) && byId.has(b) && byId.get(a)?.districtId === byId.get(b)?.districtId) issues.push(`${a} и ${b} несовместимы в одном районе.`);
  }
  return issues;
}

export const exampleDecisions: SavedRun["decisions"] = [
  { measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" }, { measureId: "M12" }, { measureId: "M5", districtId: "saryarka" },
];
