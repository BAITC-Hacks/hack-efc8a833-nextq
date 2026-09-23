import assert from "node:assert/strict";
import { test } from "node:test";
import { runScenario } from "../application/run-scenario";
import { cityV1 } from "../data/city-v1";
import { evaluateScenario } from "./evaluate-scenario";
import { directions, ScenarioValidationError, type ScenarioInput } from "./model";

function scenario(initiativeIds = directions.map((direction) => `keep-${direction}`)): ScenarioInput {
  return {
    datasetVersion: "city-1",
    rulesVersion: "rules-1",
    decisions: directions.map((direction, index) => ({ direction, initiativeId: initiativeIds[index], districtId: "orken" })),
  };
}

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
}

test("free decisions preserve all district indicators and the initial score", () => {
  const result = runScenario(scenario());
  assert.equal(result.spent, 0);
  assert.equal(result.remaining, 100);
  assert.equal(result.baselineAqol, 50);
  assert.equal(result.finalAqol, 50);
  for (const district of result.districts) {
    assert.deepEqual(district.final, district.baseline);
  }
});

test("bus priority respects the selected district population weight", () => {
  const input = scenario();
  input.decisions[0].initiativeId = "bus-priority";
  const result = runScenario(input);
  assert.equal(result.spent, 20);
  close(result.finalAqol, 50.16);
  assert.equal(result.districts[0].final.transport, 50);
  assert.deepEqual(result.districts[1].final, result.districts[1].baseline);
  input.decisions[0].districtId = "bastau";
  close(runScenario(input).finalAqol, 50.32);
});

test("full scenario includes cross-direction effects and one park-lighting interaction", () => {
  const result = runScenario(scenario(["bus-priority", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"]));
  assert.equal(result.spent, 85);
  assert.equal(result.remaining, 15);
  assert.deepEqual(result.districts[0].realizedDelta, { transport: 11, green: 10, social: 14, safety: 12, services: 12 });
  close(result.finalAqol, 50.944);
  assert.equal(result.impacts.filter((impact) => impact.kind === "interaction").length, 1);
});

test("park-lighting interaction requires the same district", () => {
  const input = scenario();
  input.decisions[1].initiativeId = "pocket-parks";
  input.decisions[3].initiativeId = "street-lighting";
  input.decisions[3].districtId = "arna";
  const result = runScenario(input);
  assert.equal(result.impacts.filter((impact) => impact.kind === "interaction").length, 0);
  assert.equal(result.districts[0].realizedDelta.safety, 0);
  assert.equal(result.districts[1].realizedDelta.safety, 10);
});

test("121-unit scenario is rejected", () => {
  assert.throws(
    () => runScenario(scenario(["road-widening", "tree-corridor", "neighborhood-center", "cameras", "mobile-desk"])),
    { name: "ScenarioValidationError", code: "BUDGET_EXCEEDED" },
  );
});

test("exactly 100 units is valid", () => {
  const result = runScenario(scenario(["road-widening", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"]));
  assert.equal(result.spent, 100);
  assert.equal(result.remaining, 0);
});

test("clamping happens after summing positive and negative contributions", () => {
  const city = structuredClone(cityV1);
  city.districts[0].indicators.transport = 98;
  city.districts[0].indicators.green = 2;
  const input = scenario();
  input.decisions[0].initiativeId = "road-widening";
  input.decisions[1].initiativeId = "tree-corridor";
  const result = evaluateScenario(input, city);
  assert.equal(result.districts[0].final.transport, 100);
  assert.equal(result.districts[0].realizedDelta.transport, 2);
  assert.equal(result.districts[0].final.green, 9);
  assert.equal(result.impacts[0].rawDeltas.transport, 15);
  input.decisions[1].initiativeId = "keep-green";
  assert.equal(evaluateScenario(input, city).districts[0].final.green, 0);
});

test("the weakest district penalizes a scenario independently of the city mean", () => {
  const input = scenario();
  input.decisions[0].initiativeId = "road-widening";
  const result = runScenario(input);
  close(result.finalAqol, 50.112);
  const city = structuredClone(cityV1);
  city.initiatives.find((initiative) => initiative.id === "road-widening")!.deltas = { green: -10 };
  close(evaluateScenario(input, city).finalAqol, 49.44);
});

test("input, catalog and result do not share mutable indicator objects", () => {
  const input = scenario();
  const city = structuredClone(cityV1);
  const original = structuredClone({ input, city });
  const result = evaluateScenario(input, city);
  assert.deepEqual({ input, city }, original);
  assert.deepEqual(evaluateScenario({ ...input, decisions: [...input.decisions].reverse() }, city), result);
  result.districts[0].baseline.transport = 0;
  result.decisions[0].deltas.transport = 100;
  assert.deepEqual({ input, city }, original);
});

const invalidInputs: [string, (input: ScenarioInput) => void, string][] = [
  ["stale dataset", (input) => { input.datasetVersion = "city-0"; }, "VERSION_MISMATCH"],
  ["stale rules", (input) => { input.rulesVersion = "rules-0"; }, "VERSION_MISMATCH"],
  ["missing direction", (input) => { input.decisions.pop(); }, "INVALID_DECISIONS"],
  ["duplicate direction", (input) => { input.decisions[1].direction = "transport"; }, "INVALID_DECISIONS"],
  ["unknown initiative", (input) => { input.decisions[0].initiativeId = "missing"; }, "UNKNOWN_INITIATIVE"],
  ["unknown district", (input) => { input.decisions[0].districtId = "missing"; }, "UNKNOWN_DISTRICT"],
  ["direction mismatch", (input) => { input.decisions[0].initiativeId = "pocket-parks"; }, "DIRECTION_MISMATCH"],
];

for (const [name, mutate, code] of invalidInputs) {
  test(`rejects ${name}`, () => {
    const input = scenario();
    mutate(input);
    assert.throws(() => runScenario(input), (error) => error instanceof ScenarioValidationError && error.code === code);
  });
}

test("invalid costs and duplicate pair rules are rejected as catalog errors", () => {
  const city = structuredClone(cityV1);
  city.initiatives[0].cost = 0.5;
  assert.throws(() => evaluateScenario(scenario(), city), /Каталог/);
  city.initiatives[0].cost = 0;
  city.pairInteractions.push(structuredClone(city.pairInteractions[0]));
  assert.throws(() => evaluateScenario(scenario(), city), /Каталог/);
});
