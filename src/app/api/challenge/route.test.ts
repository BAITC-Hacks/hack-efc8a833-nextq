import assert from "node:assert/strict";
import { test } from "node:test";
import { directions } from "../../../domain/model";
import { POST } from "./route";

function decisions(initiativeIds: string[], districtId = "orken") {
  return directions.map((direction, index) => ({ direction, initiativeId: initiativeIds[index], districtId }));
}

function challenge() {
  const responseDecisions = decisions([
    "bus-priority",
    "pocket-parks",
    "neighborhood-center",
    "street-lighting",
    "digital-one-stop",
  ]);
  responseDecisions[0].districtId = "bastau";
  return {
    datasetVersion: "city-1",
    rulesVersion: "rules-1",
    eventPackVersion: "event-pack-1",
    eventId: "crossing-closure",
    initialDecisions: decisions([
      "road-widening",
      "pocket-parks",
      "neighborhood-center",
      "street-lighting",
      "digital-one-stop",
    ]),
    responseDecisions,
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST returns trusted event effects and all three scenario results", async () => {
  const response = await POST(request(challenge()));

  assert.equal(response.status, 200);
  const { result } = await response.json();
  assert.equal(result.event.id, "crossing-closure");
  assert.equal(result.event.districtId, "bastau");
  assert.deepEqual(result.event.rawDeltas, { transport: -10 });
  assert.deepEqual(result.event.observedDeltas, { transport: -10 });
  assert.ok(Math.abs(result.initial.finalAqol - 50.896) < 1e-10);
  assert.ok(Math.abs(result.disrupted.finalAqol - 50.176) < 1e-10);
  assert.ok(Math.abs(result.response.finalAqol - 50.784) < 1e-10);
  assert.equal(result.initial.spent, 100);
  assert.equal(result.response.spent, 85);
  assert.ok(Math.abs(result.eventScoreDelta + 0.72) < 1e-10);
  assert.ok(Math.abs(result.recoveryDelta - 0.608) < 1e-10);
  assert.ok(Math.abs(result.responseDeltaFromInitial + 0.112) < 1e-10);
});

test("POST rejects malformed JSON without exposing its contents", async () => {
  const response = await POST(new Request("http://localhost/api/challenge", {
    method: "POST",
    body: "private-invalid-json",
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Тело запроса должно содержать корректный JSON." });
});

test("POST rejects client-supplied event effects and target identifiers", async () => {
  const input = challenge();
  const bodies = [
    { ...input, eventEffects: { transport: 100 } },
    { ...input, targetDistrictId: "orken" },
    { ...input, initialDecisions: input.initialDecisions.map((decision) => ({ ...decision, eventEffects: {} })) },
    { ...input, initialDecisions: input.initialDecisions.map((decision) => ({ ...decision, targetDistrictId: "orken" })) },
    { ...input, responseDecisions: input.responseDecisions.map((decision) => ({ ...decision, eventEffects: {} })) },
    { ...input, responseDecisions: input.responseDecisions.map((decision) => ({ ...decision, targetDistrictId: "orken" })) },
  ];

  for (const body of bodies) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(await response.json()), ["error"]);
  }
});

test("POST rejects unknown versions and events", async () => {
  const mutations = [
    (input: ReturnType<typeof challenge>) => { input.datasetVersion = "city-private"; },
    (input: ReturnType<typeof challenge>) => { input.rulesVersion = "rules-private"; },
    (input: ReturnType<typeof challenge>) => { input.eventPackVersion = "event-pack-private"; },
    (input: ReturnType<typeof challenge>) => { input.eventId = "event-private"; },
  ];

  for (const mutate of mutations) {
    const input = challenge();
    mutate(input);
    const response = await POST(request(input));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(typeof body.error, "string");
    assert.ok(!body.error.includes("private"));
  }
});

test("POST rejects incomplete decisions and plans that exceed the budget", async () => {
  const input = challenge();
  const expensive = decisions([
    "road-widening",
    "tree-corridor",
    "neighborhood-center",
    "cameras",
    "mobile-desk",
  ]);
  const bodies = [
    { ...input, initialDecisions: input.initialDecisions.slice(1) },
    { ...input, responseDecisions: input.responseDecisions.slice(1) },
    { ...challenge(), initialDecisions: expensive },
    { ...challenge(), responseDecisions: expensive },
  ];

  for (const body of bodies) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(await response.json()), ["error"]);
  }
});
