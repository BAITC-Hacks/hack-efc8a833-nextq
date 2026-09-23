import { CaseValidationError, caseThemes, metricCodes, type CaseBlueprint, type CityCase, type MetricEffects, type MetricValues } from "../domain/city-case";
import { astanaDistricts, astanaMeasures } from "./astana-catalog";
export { districtQuality, metricDefinitions } from "./astana-catalog";

const assumptions = [
  "Основной кейс воспроизводит данные пользователя; независимая статистическая верификация не заявляется. Вариации и AI-кейсы — учебные сценарии.",
  "Пять районов, десять индексов 0–100; выше лучше. Население задано долями, без абсолютного числа жителей.",
  "Ровно пять разных мер, максимум две одного направления; бюджет 100 условных единиц, остаток не даёт бонуса.",
  "Горизонт — восемь кварталов. Все эффекты, включая отрицательные, умножаются на (8 − лаг) / 8.",
  "Городские меры действуют во всех районах. Синергии фиксированы и не масштабируются по лагу; все эффекты суммируются до одного clip(0,100).",
  "Score = 0,7 × среднее D с весом населения + 0,3 × минимальное D − число ячеек район×показатель строго ниже 40 после воздействий.",
  "Полные эффекты представлены в каталоге, вклады — после лага до ограничения, реализованное изменение района — после ограничения.",
  "Охват — доля населения затронутых районов, включая отрицательные эффекты, а не доля жителей с доказанным улучшением.",
  "Рекомендации — независимые пересчитанные замены одной меры или её района; глобальный оптимум не гарантируется.",
];

function validText(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum;
}
function invalid(): never {
  throw new CaseValidationError("INVALID_CASE", "Кейс должен содержать пять известных районов, доли населения > 0 с суммой 1 и десять показателей 0–100.");
}

export function createCityCase(blueprint: CaseBlueprint, id: string, source: "curated" | "ai"): CityCase {
  if (!blueprint || typeof blueprint !== "object" || !validText(id, 1, 120) || !["curated", "ai"].includes(source)) invalid();
  if (!validText(blueprint.title, 8, 100) || !validText(blueprint.summary, 20, 400) || !caseThemes.includes(blueprint.theme)) invalid();
  if (!Array.isArray(blueprint.briefing) || blueprint.briefing.length < 2 || blueprint.briefing.length > 5 || blueprint.briefing.some((line) => !validText(line, 20, 500))) invalid();
  if (!Array.isArray(blueprint.districts) || blueprint.districts.length !== astanaDistricts.length) invalid();
  const ids = new Set<string>();
  let totalShare = 0;
  for (const district of blueprint.districts) {
    if (!district || !astanaDistricts.some((known) => known.id === district.id) || ids.has(district.id)) invalid();
    if (!Number.isFinite(district.populationShare) || district.populationShare <= 0 || district.populationShare > 1) invalid();
    if (!district.indicators || typeof district.indicators !== "object" || metricCodes.some((code) => !Number.isFinite(district.indicators[code]) || district.indicators[code] < 0 || district.indicators[code] > 100)) invalid();
    ids.add(district.id);
    totalShare += district.populationShare;
  }
  if (Math.abs(totalShare - 1) > 1e-6) invalid();
  return {
    id, version: "astana-1", source, theme: blueprint.theme,
    title: blueprint.title.trim(), summary: blueprint.summary.trim(), briefing: blueprint.briefing.map((line) => line.trim()),
    assumptions: [...assumptions],
    city: {
      budget: 100, horizonQuarters: 8,
      districts: astanaDistricts.map((known) => {
        const district = blueprint.districts.find((candidate) => candidate.id === known.id)!;
        return { id: known.id, name: known.name, populationShare: district.populationShare, indicators: Object.fromEntries(metricCodes.map((code) => [code, district.indicators[code]])) as MetricValues };
      }),
      measures: astanaMeasures.map((measure) => ({ ...measure, effects: { ...measure.effects } })),
    },
  };
}

function variation(changes: Record<string, MetricEffects>): CaseBlueprint["districts"] {
  return astanaDistricts.map((district) => ({ id: district.id, populationShare: district.populationShare, indicators: { ...district.indicators, ...changes[district.id] } }));
}

export const cityCases: CityCase[] = [
  createCityCase({
    theme: "baseline", title: "Астана: пять районов, один бюджет",
    summary: "Основной датасет пользователя: Есиль, Алматы, Сарыарка, Байконур и Нура. Выберите пять мер из четырнадцати, учитывая лаги, совместимость и критические показатели.",
    briefing: [
      "Есиль: обеспеченный район с пробками на мостах и переполненными школами. Алматы: старые сети ЖКХ и пробки.",
      "Сарыарка: смог частного сектора и нехватка зелени. Байконур: средние показатели. Нура: дефицит транспорта и социальной инфраструктуры.",
      "Исходные показатели и доли населения точно воспроизводят таблицу пользователя; они не заявлены как независимо проверенная официальная статистика.",
      "Контрольный план за 95: M7, M8 и M10 в Нуре, M12 по городу и M5 в Сарыарке. Score меняется с 52,55768 до 56,54307.",
    ],
    districts: variation({}),
  }, "astana", "curated"),
  createCityCase({
    theme: "winter", title: "Учебная вариация: зимняя устойчивость",
    summary: "Учебная вариация основного датасета: в Сарыарке и Алматы снижены индексы воздуха и надёжности ЖКХ. Правила, цены, доли населения и горизонт сохраняются.",
    briefing: [
      "Эта таблица — авторская учебная вариация, а не измерения зимней ситуации или метеорологический прогноз.",
      "Изменения от основного кейса: Сарыарка E2=30, C1=35; Алматы E2=45, C1=38; Байконур C1=42. Остальные ячейки сохранены.",
      "Чистое топливо несовместимо с модернизацией сетей в одном районе; городское озеленение усиливает эффект чистого топлива фиксированной синергией.",
    ],
    districts: variation({ saryarka: { E2: 30, C1: 35 }, almaty: { E2: 45, C1: 38 }, baikonur: { C1: 42 } }),
  }, "winter", "curated"),
  createCityCase({
    theme: "heat", title: "Учебная вариация: зелёная среда",
    summary: "Учебная вариация: доступность зелени хуже в Алматы, Сарыарке и Нуре. Индексы описывают условную городскую среду, а не температуру или медицинские последствия жары.",
    briefing: [
      "Эта таблица — авторская учебная вариация основного датасета, без утверждения о реальных температурных измерениях.",
      "Изменения от основного кейса: Алматы E1=35; Сарыарка E1=30; Нура E1=32. Остальные показатели и доли населения сохранены.",
      "Парк повышает показатели одного района, городское озеленение действует во всех пяти. Парк и школа несовместимы в одном районе.",
    ],
    districts: variation({ almaty: { E1: 35 }, saryarka: { E1: 30 }, nura: { E1: 32 } }),
  }, "heat", "curated"),
  createCityCase({
    theme: "growth", title: "Учебная вариация: социальная инфраструктура",
    summary: "Учебная вариация: новые кварталы усиливают дефицит транспорта, школ и первичной медицины. Нужно устранить критические показатели при прежнем бюджете и ограничении пяти мер.",
    briefing: [
      "Это авторский учебный сценарий инфраструктурного отставания, а не прогноз миграции или строительства жилья.",
      "Изменения от основного кейса: Нура T2=32, S1=28, S2=30; Есиль S1=38. Доли населения и остальные показатели сохранены.",
      "Нельзя выбрать все три социальные меры: допустимы максимум две одного направления. Их лаг влияет на достижение порога 40.",
    ],
    districts: variation({ nura: { T2: 32, S1: 28, S2: 30 }, yesil: { S1: 38 } }),
  }, "growth", "curated"),
];
