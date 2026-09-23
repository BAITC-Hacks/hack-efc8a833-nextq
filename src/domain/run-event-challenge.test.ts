import assert from "node:assert/strict";
import { test } from "node:test";
import { runEventChallenge } from "../application/run-event-challenge";
import { cityV1 } from "../data/city-v1";
import { eventsV1 } from "../data/events-v1";
import { evaluateScenario } from "./evaluate-scenario";
import { EventChallengeValidationError, type EventChallengeInput, type ExternalImpact } from "./events";
import { directions, ScenarioValidationError, type ScenarioInput } from "./model";

function decisions(initiativeIds: string[], districtId = "orken") {
  return directions.map((direction, index) => ({ direction, initiativeId: initiativeIds[index], districtId }));
}

function challengeInput(
  initialDecisions = decisions(["road-widening", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"]),
  responseDecisions?: ReturnType<typeof decisions>,
): EventChallengeInput {
  const response = responseDecisions ?? decisions(["bus-priority", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"]);
  if (!responseDecisions) response[0].districtId = "bastau";
  return {
    datasetVersion: "city-1",
    rulesVersion: "rules-1",
    eventPackVersion: "event-pack-1",
    eventId: "crossing-closure",
    initialDecisions,
    responseDecisions: response,
  };
}

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);
}

test("crossing closure reports the control AQoL and budget values", () => {
  const result = runEventChallenge(challengeInput());

  close(result.initial.finalAqol, 50.896);
  close(result.disrupted.finalAqol, 50.176);
  close(result.response.finalAqol, 50.784);
  close(result.eventScoreDelta, -0.72);
  close(result.recoveryDelta, 0.608);
  close(result.responseDeltaFromInitial, -0.112);
  assert.equal(result.datasetVersion, "city-1");
  assert.equal(result.rulesVersion, "rules-1");
  assert.equal(result.eventPackVersion, "event-pack-1");
  assert.deepEqual(result.event.rawDeltas, { transport: -10 });
  assert.deepEqual(result.event.observedDeltas, { transport: -10 });
  assert.equal(result.response.spent, 85);
  assert.equal(result.response.remaining, 15);
  close(result.initial.baselineAqol, 50);
  close(result.disrupted.baselineAqol, 50);
  close(result.response.baselineAqol, 50);
});

test("event impact is limited to its catalog district", () => {
  const result = runEventChallenge(challengeInput());
  const bastau = result.disrupted.districts.find((district) => district.districtId === "bastau");
  const orken = result.disrupted.districts.find((district) => district.districtId === "orken");

  assert.ok(bastau);
  assert.ok(orken);
  assert.equal(bastau.realizedDelta.transport, -10);
  assert.equal(orken.realizedDelta.transport, 16);
  assert.equal(orken.realizedDelta.green, 2);
});

test("unchanged decisions have no recovery after the event", () => {
  const unchanged = decisions(["road-widening", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"]);
  const result = runEventChallenge(challengeInput(unchanged, structuredClone(unchanged)));

  close(result.response.finalAqol, result.disrupted.finalAqol);
  close(result.recoveryDelta, 0);
});

test("event, initiatives, and interaction are summed before a single clamp", () => {
  const city = structuredClone(cityV1);
  const orken = city.districts.find((district) => district.id === "orken");
  assert.ok(orken);
  orken.indicators.green = 2;
  orken.indicators.safety = 1;
  const input: ScenarioInput = {
    datasetVersion: "city-1",
    rulesVersion: "rules-1",
    decisions: decisions(["keep-transport", "pocket-parks", "keep-social", "street-lighting", "keep-services"]),
  };
  const event: ExternalImpact = {
    kind: "event",
    eventId: "heat-island",
    districtId: "orken",
    rawDeltas: { green: -8, safety: -2 },
  };

  const result = evaluateScenario(input, city, [event]);
  const affected = result.districts.find((district) => district.districtId === "orken");

  assert.ok(affected);
  assert.equal(affected.final.green, 4);
  assert.equal(affected.final.safety, 11);
  assert.equal(result.impacts.filter((impact) => impact.kind === "interaction").length, 1);
  assert.equal(result.impacts.filter((impact) => impact.kind === "event").length, 1);
});

test("repeated challenge calls are deterministic and do not mutate inputs or catalogs", () => {
  const input = challengeInput();
  const inputBefore = structuredClone(input);
  const cityBefore = structuredClone(cityV1);
  const eventsBefore = structuredClone(eventsV1);
  const first = runEventChallenge(input);
  const second = runEventChallenge(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, inputBefore);
  assert.deepEqual(cityV1, cityBefore);
  assert.deepEqual(eventsV1, eventsBefore);
});

const invalidInputs: [string, (input: EventChallengeInput) => void, string][] = [
  ["dataset version", (input) => { input.datasetVersion = "city-0"; }, "VERSION_MISMATCH"],
  ["rules version", (input) => { input.rulesVersion = "rules-0"; }, "VERSION_MISMATCH"],
  ["event pack version", (input) => { input.eventPackVersion = "event-pack-0"; }, "EVENT_PACK_VERSION_MISMATCH"],
  ["unknown event", (input) => { input.eventId = "missing-event"; }, "UNKNOWN_EVENT"],
  ["initial initiative", (input) => { input.initialDecisions[0].initiativeId = "missing"; }, "UNKNOWN_INITIATIVE"],
  ["response initiative", (input) => { input.responseDecisions[0].initiativeId = "missing"; }, "UNKNOWN_INITIATIVE"],
  ["initial budget", (input) => { input.initialDecisions = decisions(["road-widening", "tree-corridor", "neighborhood-center", "cameras", "mobile-desk"]); }, "BUDGET_EXCEEDED"],
  ["response budget", (input) => { input.responseDecisions = decisions(["road-widening", "tree-corridor", "neighborhood-center", "cameras", "mobile-desk"]); }, "BUDGET_EXCEEDED"],
];

for (const [name, mutate, code] of invalidInputs) {
  test(`rejects invalid ${name}`, () => {
    const input = challengeInput();
    mutate(input);
    assert.throws(
      () => runEventChallenge(input),
      (error) => error instanceof ScenarioValidationError || error instanceof EventChallengeValidationError
        ? error.code === code
        : false,
    );
  });
}
