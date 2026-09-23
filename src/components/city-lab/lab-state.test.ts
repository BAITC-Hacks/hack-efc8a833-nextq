import assert from "node:assert/strict";
import test from "node:test";
import { cityCases, createCityCase } from "@/data/city-cases";
import { evaluateCityCase } from "@/domain/evaluate-city-case";
import { compatibleRuns, exampleDecisions, makeSavedRun, parseSavedRuns, planCost, planIssues, replaceDecision, restoreSavedRun, storageByteLimit } from "./lab-state";

const cityCase = cityCases.find((item) => item.id === "astana")!;
const evaluation = evaluateCityCase(cityCase, { decisions: exampleDecisions });
const run = makeSavedRun(cityCase, exampleDecisions, evaluation, "one", "2026-09-23T12:00:00.000Z");

test("saved reports reject corrupt data, old model, invalid values and oversize storage", () => {
  assert.deepEqual(parseSavedRuns("broken"), []);
  assert.deepEqual(parseSavedRuns(" ".repeat(storageByteLimit + 1)), []);
  assert.deepEqual(parseSavedRuns(JSON.stringify([{ ...run, aqol: 101 }])), []);
  assert.deepEqual(parseSavedRuns(JSON.stringify([{ ...run, caseVersion: "cases-1" }])), []);
  assert.deepEqual(parseSavedRuns(JSON.stringify([{ ...run, criticalCount: -1 }])), []);
  assert.deepEqual(parseSavedRuns(JSON.stringify([{ ...run, decisions: [...exampleDecisions.slice(0, 4), exampleDecisions[0]] }])), []);
  assert.deepEqual(parseSavedRuns(JSON.stringify([{ ...run, blueprint: { ...run.blueprint, districts: [] } }])), []);
  assert.deepEqual(parseSavedRuns(JSON.stringify(Array.from({ length: 13 }, (_, index) => ({ ...run, id: String(index) })))), []);
  assert.equal(parseSavedRuns(JSON.stringify([run])).length, 1);
});

test("comparison cannot cross cases or differing AI blueprints", () => {
  assert.equal(compatibleRuns(run, { ...run, id: "two" }), true);
  assert.equal(compatibleRuns(run, { ...run, caseId: "heat" }), false);
  const aiRun = { ...run, caseId: "ai-test", source: "ai" as const };
  assert.equal(compatibleRuns(aiRun, { ...aiRun, blueprint: { ...aiRun.blueprint, title: "Изменённый кейс" } }), false);
});

test("recommendation replaces one measure and preserves other choices", () => {
  const change = { measureId: "M9", districtId: "yesil" };
  const updated = replaceDecision(run.decisions, "M7", change);
  assert.equal(updated.length, 5);
  assert.deepEqual(updated[0], change);
  assert.deepEqual(updated.slice(1), run.decisions.slice(1));
});

test("example is a valid 95 unit plan and geographic conflicts block submission", () => {
  assert.equal(planCost(cityCase, exampleDecisions), 95);
  assert.deepEqual(planIssues(cityCase, exampleDecisions), []);
  assert.ok(planIssues(cityCase, exampleDecisions.slice(1)).some((issue) => issue.includes("ровно 5")));
  assert.ok(planIssues(cityCase, replaceDecision(exampleDecisions, "M10", { measureId: "M9", districtId: "nura" })).some((issue) => issue.includes("2 мер")));
  assert.ok(planIssues(cityCase, replaceDecision(exampleDecisions, "M5", { measureId: "M4", districtId: "nura" })).some((issue) => issue.includes("M4 и M7")));
  assert.ok(planIssues(cityCase, replaceDecision(exampleDecisions, "M12", { measureId: "M12", districtId: "nura" })).some((issue) => issue.includes("не требует района")));
});

test("curated reports restore from trusted catalog and recompute persisted summaries", () => {
  const altered = { ...run, aqol: 99, spent: 0, criticalCount: 49, blueprint: { ...run.blueprint, districts: run.blueprint.districts.map((district) => ({ ...district, indicators: { ...district.indicators, T1: 100 } })) } };
  const parsed = parseSavedRuns(JSON.stringify([altered]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].aqol, evaluation.result.finalAqol);
  assert.equal(parsed[0].spent, 95);
  assert.equal(parsed[0].criticalCount, 0);
  const restored = restoreSavedRun(parsed[0]);
  assert.deepEqual(restored.decisions, exampleDecisions);
  assert.deepEqual(restored.evaluation, evaluation);
  assert.equal(restored.cityCase.city.districts[0].indicators.T1, 45);
});

test("AI report can reopen after reload from validated blueprint without a live token", () => {
  const aiCase = createCityCase({ ...run.blueprint, title: "Учебный AI-кейс Астаны" }, "ai-saved-test", "ai");
  const aiEvaluation = evaluateCityCase(aiCase, { decisions: exampleDecisions });
  const aiRun = makeSavedRun(aiCase, exampleDecisions, aiEvaluation, "ai-run", "2026-09-23T12:00:00.000Z", "expired-signed-token");
  const parsed = parseSavedRuns(JSON.stringify([aiRun]));
  assert.equal(parsed.length, 1);
  const restored = restoreSavedRun(parsed[0]);
  assert.equal(restored.cityCase.source, "ai");
  assert.equal(restored.cityCase.city.measures.length, 14);
  assert.equal(restored.cityCase.city.budget, 100);
  assert.equal(restored.token, "expired-signed-token");
  assert.deepEqual(restored.evaluation, aiEvaluation);
});
