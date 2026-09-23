import assert from "node:assert/strict";
import { after, test } from "node:test";
import { directions, type ScenarioInput } from "../../../domain/model";
import { POST } from "./route";

const originalApiKey = process.env.NVIDIA_API_KEY;
delete process.env.NVIDIA_API_KEY;
after(() => {
  if (originalApiKey === undefined) {
    delete process.env.NVIDIA_API_KEY;
  } else {
    process.env.NVIDIA_API_KEY = originalApiKey;
  }
});

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
  const { result, narration } = await response.json();
  assert.equal(result.spent, 20);
  assert.equal(result.remaining, 80);
  assert.ok(Math.abs(result.finalAqol - 50.16) < 1e-10);
  assert.equal(narration.status, "unavailable");
});

test("POST returns the calculated result and unavailable state after a provider failure", async (context) => {
  process.env.NVIDIA_API_KEY = "test-key";
  context.after(() => { delete process.env.NVIDIA_API_KEY; });
  context.mock.method(globalThis, "fetch", async () => new Response("private-provider-detail", { status: 503 }));
  const response = await POST(request(scenario()));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.finalAqol, 50);
  assert.equal(body.result.remaining, 100);
  assert.equal(body.narration.status, "unavailable");
  assert.ok(!JSON.stringify(body).includes("private-provider-detail"));
});

test("POST returns validated narration alongside the unchanged computed result", async (context) => {
  process.env.NVIDIA_API_KEY = "test-key";
  context.after(() => { delete process.env.NVIDIA_API_KEY; });
  const content = { summary: "AQoL не изменился.", strengths: [], risks: [], tradeoffs: [] };
  context.mock.method(globalThis, "fetch", async () => Response.json({
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
  }));
  const response = await POST(request(scenario()));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.result.finalAqol, 50);
  assert.equal(body.result.remaining, 100);
  assert.deepEqual(body.narration, { status: "ready", content });
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
  Object.defineProperty(incoming, "body", { get() { throw new Error("private-key-secret"); } });
  const response = await POST(incoming);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Не удалось рассчитать сценарий. Повторите попытку позже." });
});

test("POST bounds the legacy request body", async () => {
  const response = await POST(request({ payload: "x".repeat(32769) }));
  assert.equal(response.status, 413);
});
