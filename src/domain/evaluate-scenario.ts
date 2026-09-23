import type { ExternalImpact } from "./events";
import {
  directions,
  ScenarioValidationError,
  type AppliedDecision,
  type AppliedImpact,
  type CityDataset,
  type IndicatorDelta,
  type IndicatorValues,
  type ScenarioInput,
  type ScenarioResult,
} from "./model";

function quality(indicators: IndicatorValues): number {
  return directions.reduce((sum, direction) => sum + indicators[direction], 0) / directions.length;
}

function aqol(districts: { quality: number; population: number }[]): number {
  const population = districts.reduce((sum, district) => sum + district.population, 0);
  const weightedMean = districts.reduce((sum, district) => sum + district.quality * district.population, 0) / population;
  return 0.8 * weightedMean + 0.2 * Math.min(...districts.map((district) => district.quality));
}

function validateDeltas(deltas: IndicatorDelta): void {
  if (Object.entries(deltas).some(([key, value]) => !directions.includes(key as typeof directions[number]) || !Number.isFinite(value))) {
    throw new Error("Каталог содержит некорректные эффекты.");
  }
}

function validateDataset(city: CityDataset): void {
  if (!Number.isSafeInteger(city.budget) || city.budget < 0 || city.districts.length === 0) {
    throw new Error("Каталог содержит некорректный бюджет или районы.");
  }

  const districtIds = new Set<string>();
  for (const district of city.districts) {
    if (districtIds.has(district.id) || !Number.isFinite(district.population) || district.population <= 0 || directions.some((direction) => !Number.isFinite(district.indicators[direction]) || district.indicators[direction] < 0 || district.indicators[direction] > 100)) {
      throw new Error("Каталог содержит некорректные показатели района.");
    }
    districtIds.add(district.id);
  }

  const initiativeIds = new Set<string>();
  for (const initiative of city.initiatives) {
    if (initiativeIds.has(initiative.id) || !directions.includes(initiative.direction) || !Number.isSafeInteger(initiative.cost) || initiative.cost < 0) {
      throw new Error("Каталог содержит некорректное мероприятие.");
    }
    initiativeIds.add(initiative.id);
    validateDeltas(initiative.deltas);
  }

  const pairs = new Set<string>();
  for (const interaction of city.pairInteractions) {
    const [first, second] = interaction.initiativeIds;
    const key = JSON.stringify(interaction.initiativeIds);
    if (interaction.initiativeIds.length !== 2 || !initiativeIds.has(first) || !initiativeIds.has(second) || first >= second || pairs.has(key)) {
      throw new Error("Каталог содержит некорректное взаимодействие.");
    }
    pairs.add(key);
    validateDeltas(interaction.deltas);
  }
}

export function evaluateScenario(input: ScenarioInput, city: CityDataset, externalImpacts: ExternalImpact[] = []): ScenarioResult {
  validateDataset(city);

  if (input.datasetVersion !== city.datasetVersion || input.rulesVersion !== city.rulesVersion) {
    throw new ScenarioValidationError("VERSION_MISMATCH", "Версии данных или правил устарели. Обновите страницу.");
  }
  if (!Array.isArray(input.decisions) || input.decisions.length !== directions.length || new Set(input.decisions.map((decision) => decision?.direction)).size !== directions.length || input.decisions.some((decision) => !decision || !directions.includes(decision.direction))) {
    throw new ScenarioValidationError("INVALID_DECISIONS", "Выберите ровно одно решение в каждом из пяти направлений.");
  }

  const decisions: AppliedDecision[] = directions.map((direction) => {
    const decision = input.decisions.find((candidate) => candidate.direction === direction)!;
    const initiative = city.initiatives.find((candidate) => candidate.id === decision.initiativeId);
    const district = city.districts.find((candidate) => candidate.id === decision.districtId);

    if (!initiative) {
      throw new ScenarioValidationError("UNKNOWN_INITIATIVE", "Выбрано неизвестное мероприятие.");
    }
    if (!district) {
      throw new ScenarioValidationError("UNKNOWN_DISTRICT", "Выбран неизвестный район.");
    }
    if (initiative.direction !== direction) {
      throw new ScenarioValidationError("DIRECTION_MISMATCH", "Мероприятие не соответствует направлению решения.");
    }

    return {
      direction,
      initiativeId: initiative.id,
      initiativeName: initiative.name,
      districtId: district.id,
      districtName: district.name,
      cost: initiative.cost,
      deltas: { ...initiative.deltas },
    };
  });

  const spent = decisions.reduce((sum, decision) => sum + decision.cost, 0);
  if (!Number.isSafeInteger(spent) || spent > city.budget) {
    throw new ScenarioValidationError("BUDGET_EXCEEDED", "Стоимость решений превышает доступный бюджет.");
  }

  const impacts: AppliedImpact[] = decisions.map((decision) => ({
    kind: "initiative",
    initiativeIds: [decision.initiativeId],
    districtId: decision.districtId,
    rawDeltas: { ...decision.deltas },
  }));

  for (const interaction of city.pairInteractions) {
    const first = decisions.find((decision) => decision.initiativeId === interaction.initiativeIds[0]);
    const second = decisions.find((decision) => decision.initiativeId === interaction.initiativeIds[1]);
    if (first && second && first.districtId === second.districtId) {
      impacts.push({
        kind: "interaction",
        initiativeIds: [...interaction.initiativeIds],
        districtId: first.districtId,
        rawDeltas: { ...interaction.deltas },
      });
    }
  }

  for (const impact of externalImpacts) {
    if (impact.kind !== "event" || !impact.eventId || !city.districts.some((district) => district.id === impact.districtId)) {
      throw new Error("Событие содержит некорректное воздействие или район.");
    }
    validateDeltas(impact.rawDeltas);
    impacts.push({ ...impact, rawDeltas: { ...impact.rawDeltas } });
  }

  const districts = city.districts.map((district) => {
    const final = { ...district.indicators };
    const realizedDelta = {} as IndicatorValues;

    for (const direction of directions) {
      const delta = impacts.filter((impact) => impact.districtId === district.id).reduce((sum, impact) => sum + (impact.rawDeltas[direction] ?? 0), 0);
      final[direction] = Math.max(0, Math.min(100, district.indicators[direction] + delta));
      realizedDelta[direction] = final[direction] - district.indicators[direction];
    }

    return {
      districtId: district.id,
      districtName: district.name,
      population: district.population,
      baseline: { ...district.indicators },
      final,
      realizedDelta,
      quality: quality(final),
    };
  });

  return {
    datasetVersion: city.datasetVersion,
    rulesVersion: city.rulesVersion,
    budget: city.budget,
    spent,
    remaining: city.budget - spent,
    baselineAqol: aqol(city.districts.map((district) => ({ population: district.population, quality: quality(district.indicators) }))),
    finalAqol: aqol(districts),
    decisions,
    districts,
    impacts,
  };
}
