import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { cityCases } from "@/data/city-cases";
import type { CaseBlueprint } from "@/domain/city-case";
import { evaluateCityCase } from "@/domain/evaluate-city-case";
import { createCaseHandlers } from "./handlers";
import { CaseHttpError, readBoundedText } from "./http";
import { CaseAiLimiter } from "./limiter";
import { CaseAiProvider, providerConfig } from "./provider";
import { blueprintSchema } from "./schemas";
import { signCase, verifyCase } from "./tokens";

const secret = "test-signing-secret-with-at-least-32-characters";
const env = { NODE_ENV: "production", AI_PROVIDER: "nvidia", NVIDIA_API_KEY: "private-provider-key", CASE_SIGNING_SECRET: secret };
const caseId = "ai-00000000-0000-4000-8000-000000000001";
const instant = 1800000000000;
const blueprint = (): CaseBlueprint => ({
  title: "Новый учебный район",
  summary: "Синтетический город с дефицитом зелени и общественного транспорта.",
  theme: "heat",
  briefing: ["Улучшите доступность общественного транспорта.", "Распределите бюджет между пятью условными районами."],
  districts: cityCases[0].city.districts.map(({ id, populationShare, indicators }) => ({ id, populationShare, indicators: { ...indicators } })),
});
const validInput = () => ({ caseId: cityCases[0].id, decisions: [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M5", districtId: "saryarka" },
] });
const request = (body: unknown, contentType = "application/json") => new Request("http://localhost/api/cases", { method: "POST", headers: { "Content-Type": contentType }, body: JSON.stringify(body) });
const completion = (content: unknown, finishReason = "stop") => Response.json({ choices: [{ finish_reason: finishReason, message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] });
const narration = { summary: "Выбранные меры улучшают показатели Нуры и Сарыарки.", strengths: ["Снижается число критических показателей."], risks: ["Бюджет почти исчерпан."], tradeoffs: ["Транспорт не получает прямых улучшений."] };
const mockFetch = (fn: (input: string | URL | Request, init?: RequestInit) => Promise<Response>): typeof fetch => fn as typeof fetch;
const handlers = (options: Parameters<typeof createCaseHandlers>[0] = {}) => createCaseHandlers({ env: () => env, limiter: new CaseAiLimiter(100), now: () => instant, ...options });

test("Astana API preserves the supplied control score and critical-count formula", async () => {
  const response = await handlers().evaluate(request({ ...validInput(), caseId: "astana" }));
  assert.equal(response.status, 200);
  const { evaluation } = await response.json();
  assert.equal(evaluation.caseVersion, "astana-1");
  assert.equal(evaluation.result.spent, 95);
  assert.ok(Math.abs(evaluation.result.baselineAqol - 52.55768) < 1e-10);
  assert.ok(Math.abs(evaluation.result.finalAqol - 56.54307) < 1e-10);
  assert.equal(evaluation.result.baselineCriticalCount, 2);
  assert.equal(evaluation.result.criticalCount, 0);
});

for (const provider of ["nvidia", "openai"] as const) {
  test(`${provider} generates a signed case using a fixed official endpoint and trusted catalog`, async () => {
    const configured = { ...env, AI_PROVIDER: provider, OPENAI_API_KEY: "private-openai-key" };
    const api = handlers({ env: () => configured, request: mockFetch(async (url, init) => {
      assert.equal(url, provider === "nvidia" ? "https://integrate.api.nvidia.com/v1/chat/completions" : "https://api.openai.com/v1/chat/completions");
      const sent = JSON.parse(String(init?.body));
      assert.equal(sent.stream, false);
      assert.equal(sent.response_format.type, "json_object");
      return completion(blueprint());
    }) });
    const response = await api.generate(request({ brief: "Создай условный город с жарким летним периодом.", theme: "heat" }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, provider);
    assert.equal(body.case.source, "ai");
    assert.equal(body.case.city.budget, 100);
    assert.equal(body.case.city.horizonQuarters, 8);
    assert.equal(body.case.version, "astana-1");
    assert.deepEqual(body.case.city.measures, cityCases[0].city.measures);
    assert.deepEqual(verifyCase(body.token, body.case.id, configured, instant), blueprint());
    assert.ok(!JSON.stringify(body).includes("private-"));
    const evaluated = await api.evaluate(request({ ...validInput(), caseId: body.case.id, caseToken: body.token }));
    assert.equal(evaluated.status, 200);
    assert.equal((await evaluated.json()).evaluation.caseId, body.case.id);
  });

  test(`${provider} analysis only receives server-recalculated facts`, async () => {
    const configured = { ...env, AI_PROVIDER: provider, OPENAI_API_KEY: "private-openai-key" };
    const api = handlers({ env: () => configured, request: mockFetch(async (_, init) => {
      const sent = JSON.parse(String(init?.body));
      const facts = JSON.parse(sent.messages[1].content);
      assert.deepEqual(facts.evaluation, evaluateCityCase(cityCases[0], { decisions: validInput().decisions }));
      assert.equal(facts.evaluation.result.spent, 95);
      return completion(narration);
    }) });
    const response = await api.analyze(request(validInput()));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { narration: { status: "ready", content: narration } });
  });
}

test("list is uncached and reports generation unavailable without key or production signing secret", async () => {
  for (const configured of [{}, { ...env, NVIDIA_API_KEY: "" }, { ...env, CASE_SIGNING_SECRET: "" }, { ...env, CASE_SIGNING_SECRET: "short" }, { ...env, AI_PROVIDER: "unknown" }]) {
    const api = handlers({ env: () => configured });
    const response = await api.list();
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.json();
    assert.equal(body.cases.length, 4);
    assert.equal(body.generation.available, false);
    assert.equal((await api.generate(request({ brief: "Создай учебный город для анализа транспорта." }))).status, 503);
    assert.equal((await api.evaluate(request(validInput()))).status, 200);
  }
});

test("analysis returns honest 503 unavailable when provider missing or fails", async () => {
  for (const options of [{ env: () => ({}) }, { request: mockFetch(async () => { throw new Error("private-provider-key"); }) }, { request: mockFetch(async () => completion({ summary: "fake" })) }]) {
    const response = await handlers(options).analyze(request(validInput()));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.narration.status, "unavailable");
    assert.ok(!JSON.stringify(body).includes("private-"));
  }
});

test("blueprint rejects extra fields, repeated or unknown districts, invalid bounds and strings", async () => {
  const extra = { ...blueprint(), budget: 1000 };
  const duplicate = blueprint();
  duplicate.districts[1].id = duplicate.districts[0].id;
  const unknown = blueprint();
  unknown.districts[0].id = "unknown";
  const population = blueprint();
  population.districts[0].populationShare = 1.1;
  const wrongTotal = blueprint();
  wrongTotal.districts[0].populationShare += 0.01;
  const zeroShare = blueprint();
  zeroShare.districts[0].populationShare = 0;
  const indicator = blueprint();
  indicator.districts[0].indicators.E1 = 101;
  const additionalIndicator = blueprint();
  Object.assign(additionalIndicator.districts[0].indicators, { profit: 100 });
  for (const invalid of [extra, duplicate, unknown, population, wrongTotal, zeroShare, indicator, additionalIndicator, { ...blueprint(), title: "short" }, { ...blueprint(), briefing: ["short"] }]) {
    assert.equal(blueprintSchema.safeParse(invalid).success, false);
    const response = await handlers({ request: mockFetch(async () => completion(invalid)) }).generate(request({ brief: "Создай учебный город для анализа транспорта." }));
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private-"));
  }
});

test("provider rejects truncation, malformed output, wrong requested theme, oversized response and timeout", async () => {
  for (const output of [completion(blueprint(), "length"), completion("{broken"), completion({ ...blueprint(), theme: "winter" }), new Response("x".repeat(100000)), new Response("private-provider-key", { status: 401 })]) {
    const response = await handlers({ request: mockFetch(async () => output) }).generate(request({ brief: "Создай учебный город для анализа транспорта.", theme: "heat" }));
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private-"));
  }
  let signal: AbortSignal | null | undefined;
  const provider = new CaseAiProvider(providerConfig(env)!, mockFetch(async (_, init) => {
    signal = init?.signal;
    return new Promise<Response>(() => undefined);
  }), 5);
  await assert.rejects(provider.generate("Создай учебный город для анализа транспорта."), (error: unknown) => error instanceof CaseHttpError && error.status === 503);
  assert.equal(signal?.aborted, true);
});

test("blueprint permits metric endpoints and population-share rounding tolerance", () => {
  const valid = blueprint();
  valid.theme = "baseline";
  valid.districts[0].indicators.T1 = 0;
  valid.districts[0].indicators.T2 = 100;
  valid.districts[0].populationShare += 0.0000005;
  assert.equal(blueprintSchema.safeParse(valid).success, true);
  valid.districts[0].populationShare += 0.000001;
  assert.equal(blueprintSchema.safeParse(valid).success, false);
});

test("case tokens reject modifications, wrong ID, expiry, oversized input and missing production secret", () => {
  const token = signCase(blueprint(), caseId, env, instant);
  assert.deepEqual(verifyCase(token, caseId, env, instant), blueprint());
  for (const [candidate, id, at] of [[`${token.slice(0, -4)}aaaa`, caseId, instant], [token, `${caseId}2`, instant], [token, caseId, instant + 7 * 86400000], [token, caseId, instant - 1], ["x".repeat(20001), caseId, instant]] as const) {
    assert.throws(() => verifyCase(candidate, id, env, at), (error: unknown) => error instanceof CaseHttpError && error.code === "INVALID_CASE_TOKEN");
  }
  assert.throws(() => verifyCase(token, caseId, { NODE_ENV: "production" }, instant), (error: unknown) => error instanceof CaseHttpError && error.status === 503);
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  for (const altered of [{ ...payload, version: "cases-1" }, { ...payload, expiresAt: instant + 8 * 86400000 }, { ...payload, blueprint: { ...blueprint(), budget: 1000 } }]) {
    const content = Buffer.from(JSON.stringify(altered)).toString("base64url");
    const signature = createHmac("sha256", secret).update(`v1.${content}`).digest("base64url");
    assert.throws(() => verifyCase(`v1.${content}.${signature}`, caseId, env, instant));
  }
});

test("development signing survives separate handler instances within the process", () => {
  const token = signCase(blueprint(), caseId, { NODE_ENV: "development" }, instant);
  assert.deepEqual(verifyCase(token, caseId, { NODE_ENV: "development" }, instant), blueprint());
});

test("HTTP rejects non-JSON, malformed JSON, unknown cases, unsigned AI cases and extra score fields", async () => {
  const api = handlers();
  assert.equal((await api.evaluate(request(validInput(), "text/plain"))).status, 415);
  assert.equal((await api.evaluate(new Request("http://localhost/api/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{private-data" }))).status, 400);
  assert.equal((await api.evaluate(request({ ...validInput(), caseId: "unknown" }))).status, 404);
  assert.equal((await api.evaluate(request({ ...validInput(), caseId }))).status, 404);
  assert.equal((await api.evaluate(request({ ...validInput(), score: 99 }))).status, 400);
  assert.equal((await api.analyze(request({ ...validInput(), score: 99 }))).status, 400);
  assert.equal((await api.evaluate(request({ ...validInput(), horizonMonths: 12 }))).status, 400);
  assert.equal((await api.evaluate(request({ ...validInput(), caseToken: "invalid" }))).status, 400);
  assert.equal((await api.evaluate(request({ ...validInput(), decisions: validInput().decisions.slice(1) }))).status, 400);
  for (const untrusted of [
    { ...validInput(), city: cityCases[0].city },
    { ...validInput(), model: "client-model" },
    { ...validInput(), decisions: validInput().decisions.map((decision) => ({ ...decision, cost: 0 })) },
    { ...validInput(), decisions: validInput().decisions.map(() => ({ direction: "transport", initiativeId: "M1", districtId: "nura" })) },
  ]) assert.equal((await api.evaluate(request(untrusted))).status, 400);
});

test("HTTP rejects budget, scope, direction and incompatibility violations before contacting AI", async () => {
  let calls = 0;
  const api = handlers({ request: mockFetch(async () => { calls += 1; return completion(narration); }) });
  const inputs = [
    { code: "BUDGET_EXCEEDED", decisions: [{ measureId: "M3", districtId: "yesil" }, { measureId: "M5", districtId: "saryarka" }, { measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M13", districtId: "almaty" }] },
    { code: "INVALID_SCOPE", decisions: validInput().decisions.map((decision) => decision.measureId === "M12" ? { ...decision, districtId: "yesil" } : decision) },
    { code: "INVALID_SCOPE", decisions: validInput().decisions.map((decision) => decision.measureId === "M7" ? { measureId: "M7" } : decision) },
    { code: "DUPLICATE_MEASURE", decisions: [...validInput().decisions.slice(0, 4), { measureId: "M7", districtId: "yesil" }] },
    { code: "DIRECTION_LIMIT", decisions: [{ measureId: "M7", districtId: "nura" }, { measureId: "M8", districtId: "nura" }, { measureId: "M9", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M12" }] },
    { code: "INCOMPATIBLE_MEASURES", decisions: [{ measureId: "M1", districtId: "yesil" }, { measureId: "M3", districtId: "nura" }, { measureId: "M9", districtId: "nura" }, { measureId: "M10", districtId: "nura" }, { measureId: "M12" }] },
  ];
  for (const { code, decisions } of inputs) {
    const input = { ...validInput(), decisions };
    const response = await api.evaluate(request(input));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, code);
    assert.equal((await api.analyze(request(input))).status, 400);
  }
  assert.equal(calls, 0);
});

test("HTTP bounds actual streamed bytes even with a forged Content-Length", async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(33000))); controller.close(); } });
  const streamed = new Request("http://localhost/api/cases", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": "1" }, body, duplex: "half" } as RequestInit);
  assert.equal((await handlers().evaluate(streamed)).status, 413);
  const declared = request(validInput());
  declared.headers.set("Content-Length", "33000");
  assert.equal((await handlers().evaluate(declared)).status, 413);
});

test("slow request bodies time out and cancel the reader", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  await assert.rejects(readBoundedText(body, 1000, 5), (error: unknown) => error instanceof CaseHttpError && error.status === 408);
  assert.equal(cancelled, true);
});

test("AI guard enforces frequency and concurrency and releases failed requests", async () => {
  let now = instant;
  const rate = new CaseAiLimiter(1, 2, () => now);
  await rate.run(async () => 1);
  await assert.rejects(rate.run(async () => 2), (error: unknown) => error instanceof CaseHttpError && error.status === 429);
  now += 60000;
  assert.equal(await rate.run(async () => 3), 3);
  const concurrent = new CaseAiLimiter(10, 1);
  let release: (() => void) | undefined;
  const pending = concurrent.run(() => new Promise<void>((resolve) => { release = resolve; }));
  await assert.rejects(concurrent.run(async () => 2), (error: unknown) => error instanceof CaseHttpError && error.status === 429);
  release!();
  await pending;
  await assert.rejects(concurrent.run(async () => { throw new Error("failure"); }));
  assert.equal(await concurrent.run(async () => 3), 3);
});

test("HTTP rate rejection has 429 and Retry-After without provider access", async () => {
  const api = handlers({ limiter: new CaseAiLimiter(0), request: mockFetch(async () => { throw new Error("must not call"); }) });
  const response = await api.generate(request({ brief: "Создай учебный город для анализа транспорта." }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});
