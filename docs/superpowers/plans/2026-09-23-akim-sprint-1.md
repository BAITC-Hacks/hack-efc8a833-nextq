# «Аким на 5 часов» — план реализации спринта 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Цель:** Собрать играбельный симулятор с пятью решениями, общим бюджетом, воспроизводимым AQoL и AI-объяснением.

**Архитектура:** Модульный монолит на Next.js. Чистый TypeScript-домен рассчитывает сценарий; серверный HTTP-адаптер проверяет запросы и вызывает NVIDIA; клиент отвечает за выбор мероприятий и показ результата.

**Стек:** Node.js 22.x, pnpm, Next.js App Router, TypeScript, Tailwind CSS, Zod, Lucide React, NVIDIA NIM chat completions API.

**Спецификация:** `docs/design/akim-na-5-chasov.md`.

## Общие ограничения

- Один и тот же версионированный набор данных, правила и бюджет 100 условных единиц для всех сессий.
- Node.js `22` закреплён в `.nvmrc`; `package.json` требует Node.js `>=22`.
- Ровно пять решений, по одному для каждого направления.
- Сервер определяет стоимость и эффекты по ID из каталога.
- Домен не импортирует Next.js, Zod, React или AI SDK.
- AQoL вычисляет детерминированный движок; AI только объясняет проверенные факты.
- AI получает только синтетические данные; API-ключ не передаётся клиенту и не коммитится.
- Код не содержит комментариев.
- В этом спринте не делать Docker, Kubernetes, постоянное хранилище, leaderboard и поиск лучшей замены.
- Все коммиты используют настроенную учётную запись Git. Авторство других участников указывается только в их собственных коммитах.

## Структура файлов

- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`: сборка и инструменты.
- `.gitignore`, `.env.example`, `.nvmrc`: исключения Git, серверные настройки без секретов, версия Node.js 22.
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`: оболочка, маршрут и визуальные токены.
- `src/app/api/scenario/route.ts`: HTTP-граница для расчёта и объяснения.
- `src/infrastructure/http/scenario-schema.ts`: схема внешнего HTTP-запроса.
- `src/domain/model.ts`, `src/domain/evaluate-scenario.ts`: предметные типы, валидация решений и детерминированная модель.
- `src/data/city-v1.ts`: общий синтетический набор данных версии 1.
- `src/application/run-scenario.ts`: оркестрация расчёта без привязки к HTTP.
- `src/application/scenario-narrator.ts`: порт объяснителя и его контракты.
- `src/infrastructure/nvidia-scenario-narrator.ts`: вызов NVIDIA API, таймаут и проверка ответа.
- `src/components/simulation/*`: выбор пяти мероприятий, остаток бюджета, ошибки и отчёт.
- `README.md`: установка, запуск, архитектура, данные, конфигурация AI и демонстрационный сценарий.

## Фокус ревью

- Неполное решение или два мероприятия одного направления должны отклоняться.
- Неизвестные ID и подменённая клиентом стоимость не должны менять расчёт.
- Сумма свыше 100 единиц должна блокироваться до подтверждения.
- Показатели ограничиваются 0–100; среднее по населению и слабейший район вычисляются с точностью до форматирования.
- Недоступность NVIDIA или некорректный ответ не должны подменять численный результат выдуманным AI-объяснением.

## Задачи

### Задача 1: Каркас приложения и визуальная система

**Файлы:**

- Создать конфигурацию Next.js, TypeScript, Tailwind CSS, ESLint и pnpm в корне, сохранив существующие документы.
- Создать `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.
- Добавить `lucide-react`, `.env.example` и `.nvmrc`.
- Обновить `.gitignore` и `README.md` минимальными шагами локального запуска.

**Интерфейсы:**

- `/` открывает единый экран «Городской штаб» на русском языке.
- Визуальный стиль: светлая бумажная основа, чернильная типографика, сигнальные бирюзовый и коралловый цвета; плотная панель бюджета и пяти этапов; без эмодзи.
- Иконки направлений импортируются отдельными именованными компонентами из Lucide React.

- [ ] Добавить `dev`, `build`, `start`, `lint` scripts в `package.json`; установить Next.js, React, Zod, Lucide React, TypeScript, Tailwind CSS и ESLint.
- [ ] Создать `.nvmrc` со значением `22`; закрепить Node.js `>=22` в `package.json` и использовать `pnpm` с lockfile.
- [ ] Создать русский корневой layout с метаданными, шрифтовыми настройками и доступным названием приложения.
- [ ] Создать адаптивные дизайн-токены, базовую сетку, фокус-контуры и типографику в `globals.css`.
- [ ] Собрать пустое состояние городского штаба с заголовком, пятью направленческими секциями и бюджетной панелью.
- [ ] Добавить в README способ установки и локального запуска, затем запустить `pnpm build` и вручную открыть главную страницу.
- [ ] Зафиксировать задачу одним коммитом `feat: scaffold city simulation app`.

### Задача 2: Синтетический каталог и доменный расчёт

Контрольный пример уточнён: `street-lighting` добавляет +1 к транспорту, поэтому суммарная транспортная дельта равна 11, а AQoL — 50.944. Эффекты каталога сохранены.

**Файлы:**

- Создать `src/domain/model.ts`, `src/domain/evaluate-scenario.ts`, `src/data/city-v1.ts`.
- Создать `src/application/run-scenario.ts`.

**Интерфейсы:**

```ts
type Direction = "transport" | "green" | "social" | "safety" | "services";

type Decision = {
  direction: Direction;
  initiativeId: string;
  districtId: string;
};

type IndicatorValues = Record<Direction, number>;
type IndicatorDelta = Partial<IndicatorValues>;

type CityDistrict = {
  id: string;
  name: string;
  population: number;
  indicators: IndicatorValues;
};

type CityInitiative = {
  id: string;
  direction: Direction;
  name: string;
  description: string;
  cost: number;
  deltas: IndicatorDelta;
};

type PairInteraction = {
  initiativeIds: [string, string];
  deltas: IndicatorDelta;
};

type CityDataset = {
  datasetVersion: string;
  rulesVersion: string;
  budget: number;
  districts: CityDistrict[];
  initiatives: CityInitiative[];
  pairInteractions: PairInteraction[];
};

type AppliedDecision = {
  direction: Direction;
  initiativeId: string;
  initiativeName: string;
  districtId: string;
  districtName: string;
  cost: number;
  deltas: IndicatorDelta;
};

type ScenarioInput = {
  datasetVersion: string;
  rulesVersion: string;
  decisions: Decision[];
};

type DistrictResult = {
  districtId: string;
  districtName: string;
  population: number;
  baseline: IndicatorValues;
  final: IndicatorValues;
  realizedDelta: IndicatorValues;
  quality: number;
};

type AppliedImpact = {
  kind: "initiative" | "interaction";
  initiativeIds: string[];
  districtId: string;
  rawDeltas: IndicatorDelta;
};

type ScenarioResult = {
  datasetVersion: string;
  rulesVersion: string;
  budget: number;
  spent: number;
  remaining: number;
  baselineAqol: number;
  finalAqol: number;
  decisions: AppliedDecision[];
  districts: DistrictResult[];
  impacts: AppliedImpact[];
};

function evaluateScenario(input: ScenarioInput, city: CityDataset): ScenarioResult;
```

`evaluateScenario` validates all invariants itself, including matching dataset/rules versions, known district and initiative IDs, `initiative.direction === decision.direction`, exactly five unique directions, integer costs, and budget. The HTTP adapter repeats shape validation at its untrusted boundary. Initiative effects target the selected district. Pair IDs are stored in sorted order, applied once only when both initiatives are selected for the same district. `rawDeltas` records model contributions before clamping; `realizedDelta` is `final - baseline` after clamping.

- [x] Определить типы для пяти направлений, районов, мероприятий, векторов эффектов, взаимодействий и результатов.
- [x] Закрепить `datasetVersion: "city-1"`, `rulesVersion: "rules-1"`, бюджет `100`, шесть вымышленных районов и популяции в тысячах: Оркен 10, Арна 15, Самал 15, Бастау 20, Керуен 20, Жибек 20.
- [x] Задать базовые показатели по порядку транспорт/зелень/соцсфера/безопасность/сервисы: Оркен `[40,50,50,55,55]`, Арна `[45,45,50,55,55]`, Самал `[45,50,50,50,55]`, Бастау `[40,55,50,55,50]`, Керуен `[50,50,45,55,50]`, Жибек `[45,50,55,50,50]`. У каждого района среднее равно 50; 100 всегда означает лучший результат.
- [x] Для каждой области задать бесплатное мероприятие с нулевыми эффектами и два платных мероприятия: транспорт `bus-priority` (20, транспорт +10), `road-widening` (35, транспорт +15, зелень -8); зелень `pocket-parks` (15, зелень +10), `tree-corridor` (25, зелень +15, транспорт -1); соцсфера `neighborhood-center` (25, соцсфера +12, сервисы +2), `mobile-clinic` (18, соцсфера +8, безопасность +1); безопасность `street-lighting` (15, безопасность +10, транспорт +1), `cameras` (20, безопасность +10, сервисы +2); сервисы `digital-one-stop` (10, сервисы +10, соцсфера +2), `mobile-desk` (16, сервисы +8, соцсфера +3). Все дельты применяются к выбранному району.
- [x] Задать одну проверяемую парную синергию `pocket-parks` + `street-lighting`: безопасность +2 только если обе инициативы назначены одному району; применить один раз к этому району.
- [x] Реализовать проверку: ровно пять уникальных направлений, `initiative.direction === decision.direction`, существующие район и инициатива, совпадающие версии данных и правил, общий расход не выше 100.
- [x] Рассчитать значения районов через сумму исходных значений, эффектов и взаимодействий с `clamp(0, 100)`.
- [x] Рассчитать районное среднее по пяти направлениям и AQoL как `0.8 * populationWeightedMean + 0.2 * weakestDistrict`.
- [x] Вернуть полные данные по районам, применённым эффектам, расходу и остатку без округления расчётных чисел.
- [x] Подключить `runScenario` к доменной функции; убедиться, что её сигнатуры не импортируют UI, HTTP или NVIDIA.
- [x] Зафиксировать контрольные сценарии: все бесплатные решения дают расход 0 и AQoL 50; `bus-priority` в Оркене даёт расход 20 и AQoL 50.160; `bus-priority`, `pocket-parks`, `neighborhood-center`, `street-lighting`, `digital-one-stop` в Оркене дают расход 85, дельты `[11,10,14,12,12]` и AQoL 50.944; `road-widening`, `tree-corridor`, `neighborhood-center`, `cameras`, `mobile-desk` дают расход 121 и отклоняются.
- [x] Проверить `pnpm test`, `pnpm build` и вручную сверить контрольные сценарии по данным, clamp и формуле.
- [x] Зафиксировать задачу одним коммитом `feat: add deterministic city scenario engine`.

### Задача 3: Серверная граница сценария

**Файлы:**

- Создать `src/app/api/scenario/route.ts`.
- Создать схему HTTP-входа рядом с application-адаптером либо в отдельном `src/infrastructure/http/scenario-schema.ts`.
- Дополнить `src/application/run-scenario.ts` проверкой версии набора данных.

**Интерфейсы:**

- `POST /api/scenario` принимает только `datasetVersion`, `rulesVersion` и пять решений с `direction`, `initiativeId`, `districtId`.
- На шаге задачи 3 успех возвращает `{ result: ScenarioResult }`; задача 4 расширяет его полем `narration: { status: "ready", content: ScenarioNarration } | { status: "unavailable", reason: string }`.
- Некорректный ввод возвращает `400` с безопасным сообщением; внутренняя ошибка не включает секреты или текст провайдера.

- [ ] Описать Zod-схему входа с фиксированным enum направлений и строковыми ID.
- [ ] Отклонять неизвестные версии набора/правил, неполные/дублированные решения, неизвестные ID, неизвестный район и мероприятие, чьё направление не совпадает с направлением решения.
- [ ] Вычислять стоимость только на сервере по `initiativeId`; не принимать цену, эффекты или score от клиента.
- [ ] Реализовать `POST`-обработчик, который разбирает JSON, вызывает `runScenario` и сериализует расчёт.
- [ ] Добавить явную обработку неверного JSON, доменной ошибки и неожиданного исключения.
- [ ] Проверить `pnpm build`; вручную отправить корректный сценарий и варианты с неполным выбором, неизвестным ID и расходом выше лимита.
- [ ] Зафиксировать задачу одним коммитом `feat: add validated scenario endpoint`.

### Задача 4: NVIDIA-объяснение

**Файлы:**

- Создать `src/application/scenario-narrator.ts`, `src/infrastructure/nvidia-scenario-narrator.ts`.
- Дополнить `src/app/api/scenario/route.ts` вызовом порта.
- Добавить в `.env.example` пустой `NVIDIA_API_KEY` и `NVIDIA_MODEL=nvidia/nemotron-3-nano-30b-a3b`; секрет задаётся только в `.env.local`.
- Дополнить раздел AI в `README.md`.

**Интерфейсы:**

```ts
type ScenarioNarration = {
  summary: string;
  strengths: string[];
  risks: string[];
  tradeoffs: string[];
};

interface ScenarioNarrator {
  explain(result: ScenarioResult): Promise<ScenarioNarration>;
}
```

- [ ] Определить JSON-схему Zod для объяснения: непустая строка `summary`, массивы строк `strengths`, `risks`, `tradeoffs` (пустые массивы допустимы).
- [ ] Подключить официальный NVIDIA NIM endpoint `https://integrate.api.nvidia.com/v1/chat/completions`; использовать серверный `NVIDIA_MODEL` со значением по умолчанию `nvidia/nemotron-3-nano-30b-a3b`.
- [ ] Отправлять только результат с названиями районов/мероприятий, raw effects, фактическими baseline/final/realizedDelta, расходом и AQoL; требовать объяснение по переданным фактам и запрещать модели пересчитывать AQoL.
- [ ] Установить конечный таймаут через `AbortSignal.timeout`; проверить структуру ответа и JSON схемой до возврата.
- [ ] Обработать отсутствующий ключ, HTTP-ошибку, таймаут и некорректный JSON как `unavailable` без имитации AI-текста; валидный `summary` с пустыми массивами не считать ошибкой.
- [ ] Обновить endpoint: возвращать численный результат даже при ошибке AI и передавать отдельный статус/сообщение для AI.
- [ ] Проверить `pnpm build`; при наличии NVIDIA API key вручную получить объяснение, без ключа убедиться, что итоговый Score всё равно отображается.
- [ ] Зафиксировать задачу одним коммитом `feat: explain scenarios with NVIDIA NIM`.

### Задача 5: Интерактивный сценарий и README

**Файлы:**

- Создать `src/components/simulation/scenario-builder.tsx`, `initiative-picker.tsx`, `budget-meter.tsx`, `scenario-report.tsx`.
- Дополнить `src/app/page.tsx` и API endpoint-контракты в client adapter.
- Дополнить `src/app/globals.css` только необходимыми стилями.
- Завершить `README.md`.

**Интерфейсы:**

- Каждый этап начинается без выбора; бесплатный вариант «оставить как есть» предлагается явно и после нажатия хранит свой `initiativeId` и `districtId`.
- Пользователь может вернуться к любому из пяти этапов и изменить черновик.
- Кнопка расчёта недоступна, пока не выбрано пять решений либо расход превышает 100.
- Отчёт показывает AQoL до/после, потраченный и оставшийся бюджет, изменения районов и статус AI-объяснения.

- [ ] Реализовать состояние пяти пустых решений; бесплатное мероприятие доступно как явный выбор в каждом направлении.
- [ ] Сделать выбор района и мероприятия с отображением цены, эффекта, побочного эффекта и обновляемого остатка.
- [ ] Визуально различать пять этапов, выбранные/невыбранные решения и ошибку бюджета; все действия доступны клавиатурой.
- [ ] Отправлять только ID решений в `POST /api/scenario` и блокировать повторное нажатие на время расчёта.
- [ ] Показать итог AQoL, дельту к исходному состоянию, бюджет, районные значения, сильные стороны, риски и компромиссы.
- [ ] Если AI недоступен, сохранить и показать численный результат с явной меткой отсутствующего AI-объяснения.
- [ ] Обновить README: архитектурные слои, версии синтетических данных, формулу AQoL, игровые ограничения, требования к Node.js, запуск, `NVIDIA_API_KEY` и `NVIDIA_MODEL`, демонстрационный сценарий.
- [ ] Запустить `pnpm build`; пройти сценарий в браузере: выбрать пять мероприятий, рассчитать Score, изменить одно решение, проверить бюджетную блокировку и состояние AI.
- [ ] Зафиксировать задачу одним коммитом `feat: complete five-decision simulation flow`.

## Проверка покрытия спецификации

- Общий бюджет, фиксированные исходные данные и проверки пяти решений входят в задачи 2–3.
- Детерминированная стоимость и AQoL входят в задачу 2.
- Понятные районные эффекты, AI-анализ, ошибки AI и UI входят в задачи 4–5.
- Docker, Kubernetes, сравнение команд, события и поиск замены не входят в спринт 1 согласно спецификации.
- Вычисления модели детерминированы; единственный недетерминированный компонент — текст объяснения NVIDIA.

## Проверенные источники

- Next.js installation, Node.js minimum и конфигурация: https://nextjs.org/docs/app/getting-started/installation
- NVIDIA NIM chat completions endpoint и каталог моделей: https://docs.api.nvidia.com/nim/reference/llm-apis
- Lucide React package и иконки: https://lucide.dev/guide/react
