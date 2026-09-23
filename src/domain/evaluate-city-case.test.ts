import assert from "node:assert/strict";
import { test } from "node:test";
import { cityCases, createCityCase, districtQuality, metricDefinitions } from "../data/city-cases";
import { metricCodes, type CaseBlueprint, type CaseDecision, type CityCase } from "./city-case";
import { evaluateCityCase } from "./evaluate-city-case";

const example: CaseDecision[] = [
  { measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" }, { measureId: "M12" }, { measureId: "M5", districtId: "saryarka" },
];
const cheap: CaseDecision[] = [
  { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" },
  { measureId: "M10", districtId: "nura" }, { measureId: "M12" }, { measureId: "M4", districtId: "saryarka" },
];
function baseline(): CityCase { return cityCases.find((cityCase) => cityCase.id === "astana")!; }
function blueprint(): CaseBlueprint {
  const cityCase = baseline();
  return structuredClone({ title: cityCase.title, summary: cityCase.summary, theme: cityCase.theme, briefing: cityCase.briefing, districts: cityCase.city.districts });
}
function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} differs from ${expected}`);
}
function fails(decisions: CaseDecision[], code: string): void {
  assert.throws(() => evaluateCityCase(baseline(), { decisions }), { code });
}

test("the supplied Astana baseline and 95-unit example match the independent control calculation", () => {
  const evaluation = evaluateCityCase(baseline(), { decisions: example });
  const result = evaluation.result;
  assert.equal(result.spent, 95);
  assert.equal(result.remaining, 5);
  close(result.baselineAverage, 56.8624);
  close(result.baselineWeakest, 49.18);
  assert.equal(result.baselineCriticalCount, 2);
  close(result.baselineAqol, 52.55768);
  close(result.finalAverage, 58.0776);
  close(result.finalWeakest, 52.9625);
  assert.equal(result.criticalCount, 0);
  close(result.finalAqol, 56.54307);
  close(result.finalAqol - result.baselineAqol, 3.98539);
  const expected = [63.4275, 57.4975, 56.3, 57.0675, 52.9625];
  result.districts.forEach((district, index) => close(district.quality, expected[index]));
  close(districtQuality(baseline().city.districts[0].indicators), 62.99);
  close(Object.values(metricDefinitions).reduce((sum, metric) => sum + metric.weight, 0), 1);
});

test("the cheap valid plan costs 61 and applies the negative traffic effect with the same lag", () => {
  const result = evaluateCityCase(baseline(), { decisions: cheap }).result;
  assert.equal(result.spent, 61);
  const nura = result.districts.find((district) => district.districtId === "nura")!;
  close(nura.realizedDelta.T1, -1.75);
  close(nura.realizedDelta.B2, 12.25);
  const contribution = result.contributions.find((item) => item.measureId === "M11")!;
  assert.deepEqual(contribution.effects, { B2: 10.5, T1: -1.75 });
  assert.equal(contribution.realizedFraction, 0.875);
});

test("all three synergies use their first defined measure district and no lag scaling", () => {
  const plans: { decisions: CaseDecision[]; pair: [string, string]; district: string; effects: object }[] = [
    { decisions: [{ measureId: "M2" }, { measureId: "M1", districtId: "yesil" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }], pair: ["M1", "M2"], district: "yesil", effects: { T1: 2 } },
    { decisions: cheap, pair: ["M10", "M12"], district: "nura", effects: { B1: 2 } },
    { decisions: [{ measureId: "M6" }, { measureId: "M5", districtId: "saryarka" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }], pair: ["M5", "M6"], district: "saryarka", effects: { E2: 2 } },
  ];
  for (const plan of plans) {
    const first = evaluateCityCase(baseline(), { decisions: plan.decisions });
    assert.deepEqual(first.result.synergies, [{ measureIds: plan.pair, districtId: plan.district, effects: plan.effects }]);
    assert.deepEqual(evaluateCityCase(baseline(), { decisions: [...plan.decisions].reverse() }), first);
  }
});

test("city measures affect all five districts once while local measures affect only their target", () => {
  const result = evaluateCityCase(baseline(), { decisions: example }).result;
  for (const district of result.districts) close(district.realizedDelta.C2, 4.375);
  const local = result.contributions.find((item) => item.measureId === "M7")!;
  assert.deepEqual(local.districtIds, ["nura"]);
  assert.deepEqual(local.effects, { S1: 10 });
  assert.equal(result.contributions.find((item) => item.measureId === "M12")!.districtIds.length, 5);
});

test("sum all signed effects and synergies before one clamp; preserve pre-clamp contributions", () => {
  const raw = blueprint();
  raw.districts[0].indicators.T1 = 99;
  raw.districts[0].indicators.B1 = 99;
  const cityCase = createCityCase(raw, "caps", "ai");
  const decisions = [{ measureId: "M2" }, { measureId: "M11", districtId: "yesil" }, { measureId: "M10", districtId: "yesil" }, { measureId: "M12" }, { measureId: "M9", districtId: "nura" }];
  const result = evaluateCityCase(cityCase, { decisions }).result;
  close(result.districts[0].final.T1, 100);
  close(result.districts[0].realizedDelta.T1, 1);
  close(result.districts[0].final.B1, 100);
  assert.deepEqual(result.contributions.find((item) => item.measureId === "M10")!.effects, { B1: 10.5, B2: 1.75 });
  assert.deepEqual(result.synergies[0].effects, { B1: 2 });
  const lower = blueprint();
  lower.districts[0].indicators.T1 = 0;
  const lowerCase = createCityCase(lower, "floor", "ai");
  const lowerPlan = cheap.map((decision) => decision.measureId === "M11" ? { ...decision, districtId: "yesil" } : decision);
  assert.equal(evaluateCityCase(lowerCase, { decisions: lowerPlan }).result.districts[0].final.T1, 0);
});

test("critical cells are counted after effects using strictly below 40, without display rounding", () => {
  const raw = blueprint();
  raw.districts.forEach((district) => { district.indicators = Object.fromEntries(metricCodes.map((code) => [code, 50])) as typeof district.indicators; });
  raw.districts[0].indicators.E1 = 40;
  raw.districts[1].indicators.E1 = 39.9999999;
  const evaluation = evaluateCityCase(createCityCase(raw, "threshold", "ai"), { decisions: example });
  assert.equal(evaluation.result.baselineCriticalCount, 1);
  assert.equal(evaluation.result.criticalCount, 1);
  const result = evaluation.result;
  close(result.finalAqol, .7 * result.finalAverage + .3 * result.finalWeakest - 1);
});

test("exactly five distinct measures, known targets, scope, and direction limits are mandatory", () => {
  fails(cheap.slice(1), "INVALID_DECISIONS");
  fails([...cheap, { measureId: "M14" }], "INVALID_DECISIONS");
  fails([cheap[0], cheap[0], ...cheap.slice(2)], "DUPLICATE_MEASURE");
  fails([{ measureId: "M99" }, ...cheap.slice(1)], "UNKNOWN_MEASURE");
  fails([{ measureId: "M9", districtId: "unknown" }, ...cheap.slice(1)], "UNKNOWN_DISTRICT");
  fails([{ measureId: "M9" }, ...cheap.slice(1)], "INVALID_SCOPE");
  fails(cheap.map((decision) => decision.measureId === "M12" ? { ...decision, districtId: "nura" } : decision), "INVALID_SCOPE");
  fails([{ measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M9", districtId: "nura" }, { measureId: "M12" }, { measureId: "M10", districtId: "nura" }], "DIRECTION_LIMIT");
});

test("all incompatibilities reject before scoring, with district-specific pairs allowed elsewhere", () => {
  fails([{ measureId: "M1", districtId: "yesil" }, { measureId: "M3", districtId: "nura" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }], "INCOMPATIBLE_MEASURES");
  fails([{ measureId: "M4", districtId: "nura" }, { measureId: "M7", districtId: "nura" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }], "INCOMPATIBLE_MEASURES");
  fails([{ measureId: "M5", districtId: "saryarka" }, { measureId: "M13", districtId: "saryarka" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }], "INCOMPATIBLE_MEASURES");
  assert.doesNotThrow(() => evaluateCityCase(baseline(), { decisions: [{ measureId: "M4", districtId: "yesil" }, { measureId: "M7", districtId: "nura" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }] }));
  assert.doesNotThrow(() => evaluateCityCase(baseline(), { decisions: [{ measureId: "M5", districtId: "saryarka" }, { measureId: "M13", districtId: "almaty" }, { measureId: "M9", districtId: "nura" }, { measureId: "M11", districtId: "nura" }, { measureId: "M12" }] }));
});

test("capital budget accepts exactly 100 and rejects an otherwise valid 104-unit plan", () => {
  const exact = [{ measureId: "M3", districtId: "nura" }, { measureId: "M7", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M12" }, { measureId: "M6" }];
  assert.equal(evaluateCityCase(baseline(), { decisions: exact }).result.spent, 100);
  fails([{ measureId: "M3", districtId: "nura" }, { measureId: "M13", districtId: "almaty" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M12" }], "BUDGET_EXCEEDED");
});

test("every case yields valid, individually recomputed positive single-replacement recommendations", () => {
  assert.deepEqual(cityCases.map((cityCase) => cityCase.id), ["astana", "winter", "heat", "growth"]);
  for (const cityCase of cityCases) {
    for (const decisions of [example, cheap]) {
      const result = evaluateCityCase(cityCase, { decisions });
      assert.ok(result.recommendations.length > 0 && result.recommendations.length <= 3);
      for (const recommendation of result.recommendations) {
        const revised = decisions.map((decision) => decision.measureId === recommendation.replaceMeasureId ? recommendation.decision : decision);
        const better = evaluateCityCase(cityCase, { decisions: revised });
        assert.ok(better.result.spent <= 100);
        assert.ok(recommendation.aqolGain > 0);
        close(better.result.finalAqol - result.result.finalAqol, recommendation.aqolGain);
        close(better.result.spent - result.result.spent, recommendation.capitalChange);
      }
    }
  }
});

test("reach is a unique affected population share and equity uses the weakest final district", () => {
  assert.equal(evaluateCityCase(baseline(), { decisions: example }).reach.populationShare, 1);
  const local = [{ measureId: "M1", districtId: "nura" }, { measureId: "M4", districtId: "saryarka" }, { measureId: "M8", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M11", districtId: "nura" }];
  close(evaluateCityCase(baseline(), { decisions: local }).reach.populationShare, .36);
  const evaluation = evaluateCityCase(baseline(), { decisions: example });
  assert.equal(evaluation.equity.weakestDistrictId, "nura");
  close(evaluation.equity.gapBefore, 13.81);
  close(evaluation.equity.gapAfter, 10.465);
});

test("evaluation and blueprint construction do not mutate or alias inputs and catalog objects", () => {
  const cityCase = structuredClone(baseline());
  const decisions = structuredClone(example);
  const before = structuredClone({ cityCase, decisions });
  assert.deepEqual(evaluateCityCase(cityCase, { decisions }), evaluateCityCase(cityCase, { decisions: [...decisions].reverse() }));
  assert.deepEqual({ cityCase, decisions }, before);
  const raw = blueprint();
  const created = createCityCase({ ...raw, city: { budget: 1000, measures: [] } } as CaseBlueprint, "test", "ai");
  assert.equal(created.city.budget, 100);
  assert.equal(created.city.horizonQuarters, 8);
  assert.equal(created.city.measures.length, 14);
  created.city.districts[0].indicators.T1 = 0;
  created.city.measures[0].effects.T1 = 0;
  assert.equal(raw.districts[0].indicators.T1, 45);
  assert.equal(baseline().city.measures[0].effects.T1, 6);
});

test("blueprints reject malformed shares, districts, metrics and texts", () => {
  const corruptions: ((raw: CaseBlueprint) => unknown)[] = [
    () => null, (raw) => ({ ...raw, title: "short" }), (raw) => ({ ...raw, title: "x".repeat(101) }),
    (raw) => ({ ...raw, summary: "short" }), (raw) => ({ ...raw, summary: "x".repeat(401) }),
    (raw) => ({ ...raw, briefing: [] }), (raw) => ({ ...raw, briefing: ["x".repeat(501), raw.briefing[0]] }),
    (raw) => ({ ...raw, theme: "unknown" }), (raw) => ({ ...raw, districts: raw.districts.slice(1) }),
    (raw) => { raw.districts[0].id = "unknown"; return raw; },
    (raw) => { raw.districts[0].id = raw.districts[1].id; return raw; },
    ...[0, -1, 1.1, NaN, Infinity, "0.27", .26].map((populationShare) => (raw: CaseBlueprint) => ({ ...raw, districts: [{ ...raw.districts[0], populationShare }, ...raw.districts.slice(1)] })),
    ...[-1, 101, NaN, Infinity, "45", undefined].map((T1) => (raw: CaseBlueprint) => ({ ...raw, districts: [{ ...raw.districts[0], indicators: { ...raw.districts[0].indicators, T1 } }, ...raw.districts.slice(1)] })),
  ];
  for (const corrupt of corruptions) assert.throws(() => createCityCase(corrupt(blueprint()) as CaseBlueprint, "invalid", "ai"), { code: "INVALID_CASE" });
  const raw = blueprint();
  raw.districts[0].populationShare += .0000005;
  raw.districts[0].indicators.T1 = 0;
  raw.districts[1].indicators.T1 = 100;
  raw.districts.reverse();
  assert.equal(createCityCase(raw, "bounds", "ai").city.districts[0].id, "yesil");
});
