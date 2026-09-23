# Релиз City Lab — контракт реализации

## Цель

Играбельный симулятор с четырьмя подготовленными кейсами, безопасной AI-генерацией, экономическими компромиссами и визуальным сравнением. Районы и коэффициенты синтетические; проект не выдаёт учебную модель за эмпирический прогноз Астаны.

## Модель и границы

- Публичные типы закреплены в `src/domain/city-case.ts`.
- Каждый кейс: шесть известных районов, пять направлений, общий инвестиционный бюджет 100. Годовой лимит содержания 15 единиц. Цены и правила заданы серверным каталогом.
- `src/data/city-cases.ts` экспортирует `cityCases: CityCase[]` и `createCityCase(blueprint: CaseBlueprint, id: string, source: "curated" | "ai"): CityCase`.
- `src/domain/evaluate-city-case.ts` экспортирует `evaluateCityCase(cityCase: CityCase, input: CaseEvaluationInput): CaseEvaluation`.
- Горизонты 3/12/36 месяцев: положительные эффекты реализуются постепенно по сроку инициативы, отрицательные учитываются сразу. Синергия не опережает готовность обеих инициатив. Содержание проверяется независимо от CAPEX; lifecycleCost — CAPEX плюс годовое содержание пропорционально горизонту, это консервативный резерв, а не прогноз платежей.
- Чувствительность: низкий/центральный/высокий эффект по прозрачным множителям; это не статистический доверительный интервал. Рекомендации: до трёх реально пересчитанных улучшений заменой одного решения с соблюдением обоих бюджетов.
- AI генерирует `CaseBlueprint`, а не формулу и не цены. Только известные районные ID, ограниченные показатели и население. Сервер повторно валидирует и подписывает blueprint; произвольный клиентский каталог не принимается.

## HTTP-контракт

- `GET /api/cases`: `{ cases: CityCase[], generation: { available: boolean, provider: string | null } }`.
- `POST /api/cases/generate`: `{ brief: string, theme?: CaseTheme }` → `{ case: CityCase, token: string, provider: string, model: string }`. Ошибка → `{ error: string, code?: string }` с соответствующим HTTP status. Без ключа — понятная недоступность, без поддельной AI-генерации.
- `POST /api/cases/evaluate`: `{ caseId: string, caseToken?: string, decisions: Decision[], horizonMonths: 3 | 12 | 36 }` → `{ evaluation: CaseEvaluation }`.
- `POST /api/cases/analyze`: тот же запрос → `{ narration: { status: "ready", content: { summary, strengths, risks, tradeoffs } } | { status: "unavailable", reason: string } }`. Сервер заново вычисляет результат; клиентские score не принимает.
- Генерация и анализ: NVIDIA/OpenAI из серверных env; размер запросов ограничен, AI-вызовы ограничены по частоте и времени. Подпись с `CASE_SIGNING_SECRET`; в production генерация без настроенного секрета недоступна.

## Интерфейс

Новая главная — каталог и рабочее место City Lab. Старый симулятор остаётся на `/sandbox`, лаборатория событий — на `/challenge`. В интерфейсе доступны готовые кейсы, генерация, выбор решений, горизонт, CAPEX/OPEX, траектория AQoL, чувствительность, рекомендации, AI-разбор, сохранение нескольких сценариев в этом браузере, сравнение только одинакового кейса/версии/горизонта, экспорт JSON и печатный отчёт. При недоступности WebGL есть обычная HTML-визуализация; 3D не требуется для принятия решения.

## Работы

- [ ] Домен, четыре кейса, экономика, рекомендации и методика.
- [ ] AI-генерация, подписанные кейсы, HTTP-валидация, контролируемые ошибки.
- [ ] Интерфейс, сохранение, сравнение, экспорт и мобильная версия.
- [ ] Процедурная визуализация города с доступной альтернативой.
- [ ] Проверки браузером, тесты, сборка, Docker/Kubernetes, документация.
- [ ] Ревью, PR/merge и удаление только интегрированных веток.

## Источники контекста

- [World Bank: города Центральной Азии и климатическая устойчивость](https://www.worldbank.org/en/news/press-release/2023/09/27/cities-across-central-asia-can-unlock-full-economic-potential-by-implementing-low-carbon-development-strategies).
- [World Bank: городская жара и адаптация](https://www.worldbank.org/en/region/eca/publication/unlivable-how-cities-in-europe-and-central-asia-can-survive-and-thrive-in-a-hotter-future).
- [OECD Regional Well-Being](https://www.oecd.org/en/data/tools/oecd-regional-well-being.html).

Эти источники обосновывают выбранные темы и направления оценки; они не являются источником численных эффектов инициатив и формулы AQoL.
