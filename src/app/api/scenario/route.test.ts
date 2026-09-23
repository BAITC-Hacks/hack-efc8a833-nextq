import assert from "node:assert/strict";
import { test } from "node:test";
import { directions, type ScenarioInput } from "../../../domain/model";
import { POST } from "./route";

function scenario(): ScenarioInput {
  return {
    datasetVersion: "city-1",
    rulesVersion: "rules-1",
    decisions: directions.map((direction) => ({ direction, initiativeId: `keep-${direction}`, districtId: "orken" })),
  };
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST returns server-calculated costs and score", async () => {
  const input = scenario();
  input.decisions[0].initiativeId = "bus-priority";
  const response = await POST(request(input));
  assert.equal(response.status, 200);
  const { result } = await response.json();
  assert.equal(result.spent, 20);
  assert.equal(result.remaining, 80);
  assert.ok(Math.abs(result.finalAqol - 50.16) < 1e-10);
});

test("POST rejects malformed JSON without echoing its contents", async () => {
  const response = await POST(new Request("http://localhost/api/scenario", { method: "POST", body: "secret-invalid-json" }));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Тело запроса должно содержать корректный JSON." });
});

test("POST rejects additional prices, effects, scores, and invalid shapes", async () => {
  const input = scenario();
  const bodies = [
    null,
    {},
    { ...input, score: 100 },
    { ...input, decisions: input.decisions.slice(1) },
    { ...input, decisions: [...input.decisions, input.decisions[0]] },
    { ...input, decisions: input.decisions.map((decision) => ({ ...decision, cost: 0 })) },
    { ...input, decisions: input.decisions.map((decision) => ({ ...decision, deltas: {} })) },
    { ...input, decisions: input.decisions.map((decision) => ({ ...decision, direction: "invalid" })) },
    { ...input, datasetVersion: 1 },
    { ...input, rulesVersion: "" },
  ];
  for (const body of bodies) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(await response.json()), ["error"]);
  }
});

test("POST rejects every domain validation failure", async () => {
  const mutations: ((input: ScenarioInput) => void)[] = [
    (input) => { input.datasetVersion = "city-2"; },
    (input) => { input.rulesVersion = "rules-2"; },
    (input) => { input.decisions[1] = input.decisions[0]; },
    (input) => { input.decisions[0].initiativeId = "missing-secret"; },
    (input) => { input.decisions[0].districtId = "missing-secret"; },
    (input) => { input.decisions[0].initiativeId = "pocket-parks"; },
    (input) => {
      const ids = ["road-widening", "tree-corridor", "neighborhood-center", "cameras", "mobile-desk"];
      input.decisions.forEach((decision, index) => { decision.initiativeId = ids[index]; });
    },
  ];
  for (const mutate of mutations) {
    const input = scenario();
    mutate(input);
    const response = await POST(request(input));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(typeof body.error, "string");
    assert.ok(!body.error.includes("secret"));
  }
});

test("POST hides unexpected exception details", async () => {
  const incoming = request(scenario());
  incoming.json = async () => { throw new Error("private-key-secret"); };
  const response = await POST(incoming);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Не удалось рассчитать сценарий. Повторите попытку позже." });
});
