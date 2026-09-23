import assert from "node:assert/strict";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response;
}

const health = await request("/api/health");
assert.deepEqual(await health.json(), { status: "ok" });
assert.match(health.headers.get("cache-control") ?? "", /no-store/);

const html = await (await request("/")).text();
assert.match(html, /Аким/);
const assetPath = html.match(/(?:src|href)="([^\"]*\/_next\/static\/[^\"]+)"/)?.[1];
assert.ok(assetPath, "The page must reference a bundled asset");
await request(assetPath.replaceAll("&amp;", "&"));

const directions = ["transport", "green", "social", "safety", "services"];
const initialDecisions = directions.map((direction, index) => ({
  direction,
  initiativeId: ["road-widening", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"][index],
  districtId: "orken",
}));
const responseDecisions = initialDecisions.map((decision, index) => index === 0
  ? { ...decision, initiativeId: "bus-priority", districtId: "bastau" }
  : decision);
const challenge = await request("/api/challenge", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    datasetVersion: "city-1",
    rulesVersion: "rules-1",
    eventPackVersion: "event-pack-1",
    eventId: "crossing-closure",
    initialDecisions,
    responseDecisions,
  }),
});
const { result } = await challenge.json();
assert.ok(Math.abs(result.initial.finalAqol - 50.896) < 1e-10);
assert.ok(Math.abs(result.disrupted.finalAqol - 50.176) < 1e-10);
assert.ok(Math.abs(result.response.finalAqol - 50.784) < 1e-10);
assert.equal(result.initial.spent, 100);
assert.equal(result.response.spent, 85);

const catalog = await (await request("/api/cases")).json();
assert.equal(catalog.cases.length, 4);
const caseDecisions = [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M5", districtId: "saryarka" },
];
for (const cityCase of catalog.cases) {
  assert.equal(cityCase.city.budget, 100);
  assert.equal(cityCase.city.horizonQuarters, 8);
  assert.equal(cityCase.city.districts.length, 5);
  assert.equal(cityCase.city.measures.length, 14);
  const { evaluation } = await (await request("/api/cases/evaluate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId: cityCase.id, decisions: caseDecisions }),
  })).json();
  assert.equal(evaluation.result.spent, 95);
  assert.ok(evaluation.result.finalAqol > evaluation.result.baselineAqol);
  if (cityCase.id === "astana") {
    assert.ok(Math.abs(evaluation.result.baselineAqol - 52.55768) < 1e-10);
    assert.ok(Math.abs(evaluation.result.finalAqol - 56.54307) < 1e-10);
    assert.equal(evaluation.result.criticalCount, 0);
    assert.equal(evaluation.result.synergies.length, 1);
  }
}

const invalid = await fetch(new URL("/api/cases/evaluate", baseUrl), {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ caseId: "astana", decisions: caseDecisions.slice(1) }),
  signal: AbortSignal.timeout(30000),
});
assert.equal(invalid.status, 400);
assert.ok(!(await invalid.json()).evaluation);
process.stdout.write("Deployment smoke passed: health, assets, challenge, four city cases, exact Astana score and invalid-plan rejection.\n");
