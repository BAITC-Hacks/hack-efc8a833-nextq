import { districtQuality } from "./astana-metrics";
import { CaseValidationError, metricCodes, type CaseContribution, type CaseDecision, type CaseEvaluation, type CaseEvaluationInput, type CaseRecommendation, type CaseResult, type CaseSynergy, type CityCase, type MetricEffects, type MetricValues } from "./city-case";

const synergyRules: { measureIds: [string, string]; effects: MetricEffects }[] = [
  { measureIds: ["M1", "M2"], effects: { T1: 2 } },
  { measureIds: ["M10", "M12"], effects: { B1: 2 } },
  { measureIds: ["M5", "M6"], effects: { E2: 2 } },
];

function validate(cityCase: CityCase, input: CaseEvaluationInput): CaseDecision[] {
  if (!input || !Array.isArray(input.decisions) || input.decisions.length !== 5 || input.decisions.some((decision) => !decision || typeof decision !== "object" || typeof decision.measureId !== "string")) {
    throw new CaseValidationError("INVALID_DECISIONS", "Выберите ровно пять разных мер.");
  }
  const chosen = new Set<string>();
  const directionCounts = new Map<string, number>();
  for (const decision of input.decisions) {
    const measure = cityCase.city.measures.find((candidate) => candidate.id === decision.measureId);
    if (!measure) throw new CaseValidationError("UNKNOWN_MEASURE", "Выбрана неизвестная мера.");
    if (chosen.has(measure.id)) throw new CaseValidationError("DUPLICATE_MEASURE", `Мера «${measure.name}» выбрана несколько раз.`);
    chosen.add(measure.id);
    if (measure.scope === "city" && "districtId" in decision) throw new CaseValidationError("INVALID_SCOPE", `Для городской меры «${measure.name}» район выбирать нельзя.`);
    if (measure.scope === "district" && typeof decision.districtId !== "string") throw new CaseValidationError("INVALID_SCOPE", `Для меры «${measure.name}» нужен район.`);
    if (measure.scope === "district" && !cityCase.city.districts.some((district) => district.id === decision.districtId)) throw new CaseValidationError("UNKNOWN_DISTRICT", "Выбран неизвестный район.");
    directionCounts.set(measure.direction, (directionCounts.get(measure.direction) ?? 0) + 1);
  }
  if ([...directionCounts.values()].some((count) => count > 2)) throw new CaseValidationError("DIRECTION_LIMIT", "Допускается не более двух мер одного направления.");
  if (chosen.has("M1") && chosen.has("M3")) throw new CaseValidationError("INCOMPATIBLE_MEASURES", "M1 и M3 несовместимы независимо от района.");
  for (const [firstId, secondId] of [["M4", "M7"], ["M5", "M13"]]) {
    const first = input.decisions.find((decision) => decision.measureId === firstId);
    const second = input.decisions.find((decision) => decision.measureId === secondId);
    if (first && second && first.districtId === second.districtId) throw new CaseValidationError("INCOMPATIBLE_MEASURES", `${firstId} и ${secondId} несовместимы в одном районе.`);
  }
  const decisions = cityCase.city.measures.flatMap((measure) => {
    const decision = input.decisions.find((candidate) => candidate.measureId === measure.id);
    return decision ? [{ ...decision }] : [];
  });
  const spent = decisions.reduce((sum, decision) => sum + cityCase.city.measures.find((measure) => measure.id === decision.measureId)!.cost, 0);
  if (spent > cityCase.city.budget) throw new CaseValidationError("BUDGET_EXCEEDED", "Стоимость выбранных мер превышает бюджет 100.");
  return decisions;
}

function criticalCount(indicators: MetricValues[]): number {
  return indicators.reduce((sum, values) => sum + metricCodes.filter((code) => values[code] < 40).length, 0);
}

function calculate(cityCase: CityCase, input: CaseEvaluationInput): CaseResult {
  const decisions = validate(cityCase, input);
  const contributions: CaseContribution[] = decisions.map((decision) => {
    const measure = cityCase.city.measures.find((candidate) => candidate.id === decision.measureId)!;
    const realizedFraction = (8 - measure.lagQuarters) / 8;
    return {
      measureId: measure.id, measureName: measure.name,
      districtIds: measure.scope === "city" ? cityCase.city.districts.map((district) => district.id) : [decision.districtId!],
      cost: measure.cost, lagQuarters: measure.lagQuarters, realizedFraction,
      effects: Object.fromEntries(Object.entries(measure.effects).map(([code, effect]) => [code, effect * realizedFraction])),
    };
  });
  const synergies: CaseSynergy[] = synergyRules.flatMap((rule) => {
    const first = decisions.find((decision) => decision.measureId === rule.measureIds[0]);
    const second = decisions.find((decision) => decision.measureId === rule.measureIds[1]);
    return first && second ? [{ measureIds: [...rule.measureIds] as [string, string], districtId: first.districtId!, effects: { ...rule.effects } }] : [];
  });
  const districts = cityCase.city.districts.map((district) => {
    const final = { ...district.indicators };
    const realizedDelta = {} as MetricValues;
    const impacts = [...contributions.filter((item) => item.districtIds.includes(district.id)), ...synergies.filter((item) => item.districtId === district.id)];
    for (const code of metricCodes) {
      const delta = impacts.reduce((sum, impact) => sum + (impact.effects[code] ?? 0), 0);
      final[code] = Math.max(0, Math.min(100, district.indicators[code] + delta));
      realizedDelta[code] = final[code] - district.indicators[code];
    }
    return { districtId: district.id, districtName: district.name, populationShare: district.populationShare, baseline: { ...district.indicators }, final, realizedDelta, baselineQuality: districtQuality(district.indicators), quality: districtQuality(final) };
  });
  const baselineAverage = districts.reduce((sum, district) => sum + district.baselineQuality * district.populationShare, 0);
  const finalAverage = districts.reduce((sum, district) => sum + district.quality * district.populationShare, 0);
  const baselineWeakest = Math.min(...districts.map((district) => district.baselineQuality));
  const finalWeakest = Math.min(...districts.map((district) => district.quality));
  const baselineCriticalCount = criticalCount(districts.map((district) => district.baseline));
  const critical = criticalCount(districts.map((district) => district.final));
  const spent = contributions.reduce((sum, contribution) => sum + contribution.cost, 0);
  return {
    budget: cityCase.city.budget, spent, remaining: cityCase.city.budget - spent,
    baselineAqol: .7 * baselineAverage + .3 * baselineWeakest - baselineCriticalCount,
    finalAqol: .7 * finalAverage + .3 * finalWeakest - critical,
    baselineAverage, finalAverage, baselineWeakest, finalWeakest, baselineCriticalCount, criticalCount: critical,
    districts, contributions, synergies,
  };
}

function recommend(cityCase: CityCase, decisions: CaseDecision[], result: CaseResult): CaseRecommendation[] {
  const candidates: CaseRecommendation[] = [];
  for (const current of decisions) {
    for (const measure of cityCase.city.measures) {
      if (measure.id !== current.measureId && decisions.some((decision) => decision.measureId === measure.id)) continue;
      const replacements: CaseDecision[] = measure.scope === "city" ? [{ measureId: measure.id }] : cityCase.city.districts.map((district) => ({ measureId: measure.id, districtId: district.id }));
      for (const decision of replacements) {
        if (decision.measureId === current.measureId && decision.districtId === current.districtId) continue;
        const revised = decisions.map((chosen) => chosen.measureId === current.measureId ? decision : chosen);
        let alternative: CaseResult;
        try {
          alternative = calculate(cityCase, { decisions: revised });
        } catch (error) {
          if (error instanceof CaseValidationError) continue;
          throw error;
        }
        const aqolGain = alternative.finalAqol - result.finalAqol;
        if (aqolGain <= 1e-9) continue;
        const target = decision.districtId ? cityCase.city.districts.find((district) => district.id === decision.districtId)!.name : "весь город";
        candidates.push({
          replaceMeasureId: current.measureId, decision, aqolGain, capitalChange: alternative.spent - result.spent,
          explanation: `Вместо ${current.measureId}: ${measure.name} (${target}). Score +${aqolGain.toFixed(2)}; бюджет и совместимость проверены при сохранении остальных четырёх мер.`,
        });
      }
    }
  }
  return candidates.sort((first, second) => second.aqolGain - first.aqolGain || first.capitalChange - second.capitalChange || first.replaceMeasureId.localeCompare(second.replaceMeasureId) || first.decision.measureId.localeCompare(second.decision.measureId) || (first.decision.districtId ?? "").localeCompare(second.decision.districtId ?? "")).slice(0, 3);
}

export function evaluateCityCase(cityCase: CityCase, input: CaseEvaluationInput): CaseEvaluation {
  const result = calculate(cityCase, input);
  const weakest = result.districts.reduce((lowest, district) => district.quality < lowest.quality ? district : lowest);
  const gapBefore = Math.max(...result.districts.map((district) => district.baselineQuality)) - result.baselineWeakest;
  const gapAfter = Math.max(...result.districts.map((district) => district.quality)) - result.finalWeakest;
  const affected = new Set(result.contributions.filter((contribution) => Object.values(contribution.effects).some((effect) => effect !== 0)).flatMap((contribution) => contribution.districtIds));
  result.synergies.forEach((synergy) => affected.add(synergy.districtId));
  const warnings = ["Охват — доля населения затронутых районов, а не число жителей с доказанным улучшением."];
  if (result.criticalCount > 0) warnings.push(`После мер остаётся ${result.criticalCount} ячеек район×показатель строго ниже 40; каждая уменьшает Score на 1.`);
  if (result.contributions.some((contribution) => Object.values(contribution.effects).some((effect) => effect < 0))) warnings.push("Меры включают отрицательный эффект; к нему применён тот же лаг, что и к положительным эффектам.");
  if (gapAfter > gapBefore + 1e-9) warnings.push("Разрыв между сильнейшим и слабейшим районом увеличивается.");
  return {
    caseId: cityCase.id, caseVersion: cityCase.version, result,
    equity: { gapBefore, gapAfter, weakestDistrictId: weakest.districtId },
    reach: { populationShare: cityCase.city.districts.reduce((sum, district) => sum + (affected.has(district.id) ? district.populationShare : 0), 0) },
    recommendations: recommend(cityCase, input.decisions, result), warnings,
  };
}
