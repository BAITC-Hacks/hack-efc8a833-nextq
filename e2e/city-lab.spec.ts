import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const decisions = [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12" },
  { measureId: "M5", districtId: "saryarka" },
];

test("production API reproduces the supplied Astana score and rejects invalid plans", async ({ request }) => {
  const response = await request.post("/api/cases/evaluate", { data: { caseId: "astana", decisions } });
  expect(response.status()).toBe(200);
  const { evaluation } = await response.json();
  expect(evaluation.result.baselineAqol).toBeCloseTo(52.55768, 8);
  expect(evaluation.result.finalAqol).toBeCloseTo(56.54307, 8);
  expect(evaluation.result.spent).toBe(95);
  expect(evaluation.result.criticalCount).toBe(0);
  const invalid = await request.post("/api/cases/evaluate", { data: { caseId: "astana", decisions: decisions.slice(1) } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).not.toHaveProperty("evaluation");
  const injection = await request.post("/api/cases/evaluate", { data: { caseId: "astana", decisions, score: 100 } });
  expect(injection.status()).toBe(400);
});

test("catalog recovers from a network failure", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/cases", (route) => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Временная ошибка каталога" }) }) : route.continue();
  });
  await page.goto("/");
  await expect(page.getByText("Временная ошибка каталога", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Повторить загрузку" }).click();
  await expect(page.getByRole("button", { name: /^Открыть кейс:/ })).toHaveCount(4);
});

test("catalog fits narrow screens and keeps keyboard navigation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Открыть кейс:/ })).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Перейти к содержанию" })).toBeFocused();
  await page.getByRole("button", { name: /^Открыть кейс:/ }).first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("five decisions calculate, explain, save, compare and export", async ({ page }) => {
  await page.route("**/api/cases/analyze", (route) => route.fulfill({ json: { narration: { status: "ready", content: {
    summary: "Тестовый AI-разбор: два критических показателя устранены, расчёт сервера сохранён.",
    strengths: ["Нура получила социальную инфраструктуру."], risks: ["Бюджетный резерв составляет 5 единиц."], tradeoffs: ["Транспортных мер в плане нет."],
  } } } }));
  await page.goto("/");
  await page.getByRole("button", { name: /^Открыть кейс:/ }).first().click();
  await expect(page.getByRole("button", { name: "Рассчитать сценарий" })).toBeDisabled();
  await page.getByRole("button", { name: "Загрузить пример" }).click();
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByTestId("final-score")).toHaveText("56,543");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "Объяснить результат" }).click();
  await expect(page.getByText(/^Тестовый AI-разбор:/)).toBeVisible();
  await page.getByRole("button", { name: "Сохранить сценарий" }).click();
  await expect(page.getByRole("checkbox", { name: /^Сравнить / })).toHaveCount(1);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.evaluation.result.finalAqol).toBeCloseTo(56.54307, 8);
  expect(exported.decisions).toHaveLength(5);
  await page.getByRole("button", { name: "Применить", exact: true }).first().click();
  await expect(page.getByTestId("final-score")).toHaveCount(0);
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByTestId("final-score")).not.toHaveText("56,543");
  await page.getByRole("button", { name: "Сохранить сценарий" }).click();
  const saved = page.getByRole("checkbox", { name: /^Сравнить / });
  await expect(saved).toHaveCount(2);
  await saved.nth(0).check();
  await saved.nth(1).check();
  await expect(page.getByRole("heading", { name: "Сравнение совместимых сценариев" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /^Сравнить / })).toHaveCount(2);
  await page.getByRole("button", { name: /Открыть отчёт/ }).first().click();
  await expect(page.getByTestId("final-score")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^M\d+:/ }).and(page.locator(":checked"))).toHaveCount(5);
});

test("budget, maximum count and incompatible measures block calculation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Открыть кейс:/ }).first().click();
  await page.getByRole("button", { name: "Загрузить пример" }).click();
  await page.getByRole("checkbox", { name: /^M4:/ }).check();
  await expect(page.getByText("Бюджет превышен. Выберите более доступные меры.")).toBeVisible();
  await expect(page.getByText("M4 и M7 несовместимы в одном районе.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Рассчитать сценарий" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /^M4:/ }).uncheck();
  await expect(page.getByRole("button", { name: "Рассчитать сценарий" })).toBeEnabled();
  await page.route("**/api/cases/evaluate", (route) => route.fulfill({ status: 503, json: { error: "Тестовая временная ошибка расчёта" } }));
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByText("Тестовая временная ошибка расчёта")).toBeVisible();
  await page.unroute("**/api/cases/evaluate");
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByTestId("final-score")).toHaveText("56,543");
});

test("AI case generation and unavailable analysis retain the calculated result", async ({ page, request }) => {
  const { cases } = await (await request.get("/api/cases")).json();
  const generated = { ...cases[0], id: "ai-test-case", source: "ai", title: "Тестовый городской кейс" };
  const { evaluation } = await (await request.post("/api/cases/evaluate", { data: { caseId: "astana", decisions } })).json();
  await page.route("**/api/cases", (route) => route.fulfill({ json: { cases, generation: { available: true, provider: "openai" } } }));
  await page.route("**/api/cases/generate", (route) => route.fulfill({ json: { case: generated, token: "test-token", provider: "openai", model: "test-model" } }));
  await page.route("**/api/cases/evaluate", (route) => {
    expect(route.request().postDataJSON()).toEqual({ caseId: "ai-test-case", caseToken: "test-token", decisions });
    return route.fulfill({ json: { evaluation: { ...evaluation, caseId: generated.id } } });
  });
  await page.route("**/api/cases/analyze", (route) => route.fulfill({ status: 503, json: { narration: { status: "unavailable", reason: "Провайдер временно недоступен" } } }));
  await page.goto("/");
  await page.getByLabel("Какую задачу должен решить город?").fill("Учебный сценарий роста жилых кварталов и городской инфраструктуры");
  await page.getByRole("button", { name: "Создать AI-кейс" }).click();
  await expect(page.getByRole("heading", { name: generated.title })).toBeVisible();
  await page.getByRole("button", { name: "Загрузить пример" }).click();
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByTestId("final-score")).toHaveText("56,543");
  await page.getByRole("button", { name: "Объяснить результат" }).click();
  await expect(page.getByText(/AI-разбор недоступен:/)).toBeVisible();
  await expect(page.getByTestId("final-score")).toHaveText("56,543");
});

test("3D has an accessible fallback without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      if (type === "webgl2") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Открыть кейс:/ }).first().click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByText(/3D недоступно в этом браузере/)).toBeVisible();
  await page.getByRole("button", { name: "Загрузить пример" }).click();
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByTestId("final-score")).toHaveText("56,543");
});

test("late generation cannot replace a case already being edited", async ({ page, request }) => {
  const { cases } = await (await request.get("/api/cases")).json();
  let release!: () => void;
  let completed!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const handled = new Promise<void>((resolve) => { completed = resolve; });
  await page.route("**/api/cases", (route) => route.fulfill({ json: { cases, generation: { available: true, provider: "openai" } } }));
  await page.route("**/api/cases/generate", async (route) => {
    await pending;
    await route.fulfill({ json: { case: { ...cases[1], id: "ai-late", source: "ai", title: "Поздний ответ генератора" }, token: "test-token", provider: "openai", model: "test" } }).catch(() => undefined);
    completed();
  });
  await page.goto("/");
  await page.getByLabel("Какую задачу должен решить город?").fill("Сгенерировать учебный сценарий городского развития для проверки");
  const started = page.waitForRequest("**/api/cases/generate");
  await page.getByRole("button", { name: "Создать AI-кейс" }).click();
  await started;
  await page.getByRole("button", { name: /^Открыть кейс:/ }).first().click();
  await page.getByRole("button", { name: "Загрузить пример" }).click();
  release();
  await handled;
  await page.getByRole("button", { name: "Рассчитать сценарий" }).click();
  await expect(page.getByTestId("final-score")).toHaveText("56,543");
  await expect(page.getByRole("heading", { name: cases[0].title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Поздний ответ генератора" })).toHaveCount(0);
});
