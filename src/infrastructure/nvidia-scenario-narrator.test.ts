import assert from "node:assert/strict";
import { test } from "node:test";
import { narrateScenario, type ScenarioNarration } from "../application/scenario-narrator";
import { runScenario } from "../application/run-scenario";
import { directions } from "../domain/model";
import { NvidiaScenarioNarrator } from "./nvidia-scenario-narrator";

const result = runScenario({
  datasetVersion: "city-1",
  rulesVersion: "rules-1",
  decisions: directions.map((direction) => ({ direction, initiativeId: `keep-${direction}`, districtId: "orken" })),
});

const content: ScenarioNarration = {
  summary: "Показатели и AQoL не изменились; весь бюджет сохранён.",
  strengths: [],
  risks: [],
  tradeoffs: [],
};

function completion(value: unknown): Response {
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) }, finish_reason: "stop" }] });
}

test("NVIDIA sends computed facts and accepts valid narration with empty arrays", async () => {
  const request: typeof fetch = async (url, options) => {
    assert.equal(url, "https://integrate.api.nvidia.com/v1/chat/completions");
    assert.equal(options?.method, "POST");
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer test-key");
    assert.equal(options?.cache, "no-store");
    assert.ok(options?.signal instanceof AbortSignal);
    const payload = JSON.parse(String(options?.body));
    assert.equal(payload.model, "nvidia/nemotron-3-nano-30b-a3b");
    assert.deepEqual(JSON.parse(payload.messages[1].content), result);
    assert.deepEqual(payload.response_format, { type: "json_object" });
    assert.deepEqual(payload.chat_template_kwargs, { enable_thinking: false });
    assert.equal(payload.stream, false);
    return completion(content);
  };
  const narrator = new NvidiaScenarioNarrator({ apiKey: "test-key", request });
  assert.deepEqual(await narrateScenario(result, narrator), { status: "ready", content });
});

test("NVIDIA uses the configured model", async () => {
  const narrator = new NvidiaScenarioNarrator({
    apiKey: "test-key",
    model: "configured-model",
    request: async (_url, options) => {
      assert.equal(JSON.parse(String(options?.body)).model, "configured-model");
      return completion(content);
    },
  });
  assert.deepEqual(await narrator.explain(result), content);
});

test("missing key returns unavailable without making a provider request", async () => {
  let requested = false;
  const narrator = new NvidiaScenarioNarrator({
    apiKey: " ",
    request: async () => { requested = true; return completion(content); },
  });
  const original = structuredClone(result);
  const narration = await narrateScenario(result, narrator);
  assert.equal(narration.status, "unavailable");
  assert.equal(requested, false);
  assert.deepEqual(result, original);
});

test("provider errors, invalid JSON, invalid schemas and truncation return unavailable", async () => {
  const requests: (typeof fetch)[] = [
    async () => { throw new Error("private-provider-detail"); },
    async () => new Response("private-provider-detail", { status: 429 }),
    async () => new Response("invalid-json"),
    async () => Response.json({ choices: [] }),
    async () => Response.json({ choices: [{ message: { content: "invalid-json" }, finish_reason: "stop" }] }),
    async () => completion({ ...content, summary: " " }),
    async () => completion({ ...content, risks: [42] }),
    async () => completion({ ...content, finalAqol: 100 }),
    async () => Response.json({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "length" }] }),
  ];
  const original = structuredClone(result);
  for (const request of requests) {
    const narrator = new NvidiaScenarioNarrator({ apiKey: "test-key", request });
    const narration = await narrateScenario(result, narrator);
    assert.equal(narration.status, "unavailable");
    assert.ok(!JSON.stringify(narration).includes("private-provider-detail"));
    assert.deepEqual(result, original);
  }
});

test("provider timeout returns unavailable and preserves the result", async () => {
  let aborted = false;
  const request: typeof fetch = async (_url, options) => new Promise((_resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("test exceeded deadline")), 1000);
    options?.signal?.addEventListener("abort", () => {
      aborted = true;
      clearTimeout(deadline);
      reject(options.signal?.reason);
    }, { once: true });
  });
  const original = structuredClone(result);
  const narrator = new NvidiaScenarioNarrator({ apiKey: "test-key", request, timeoutMs: 5 });
  const narration = await narrateScenario(result, narrator);
  assert.equal(narration.status, "unavailable");
  assert.equal(aborted, true);
  assert.deepEqual(result, original);
});
