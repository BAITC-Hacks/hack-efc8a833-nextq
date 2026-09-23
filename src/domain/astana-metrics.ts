import { metricCodes, type MetricCode, type MetricValues } from "./city-case";
import type { Direction } from "./model";

export const metricDefinitions: Record<MetricCode, { name: string; weight: number; direction: Direction; description: string }> = {
  T1: { name: "Разгрузка дорог", weight: .10, direction: "transport", description: "100 — нет пробок в час пик." },
  T2: { name: "Доступность ОТ", weight: .10, direction: "transport", description: "100 — все жители в 500 м от остановки с интервалом не более 10 минут." },
  E1: { name: "Озеленение", weight: .09, direction: "green", description: "100 — не менее 20 м² зелени на жителя." },
  E2: { name: "Качество воздуха", weight: .11, direction: "green", description: "100 — зимой AQI не выше 50." },
  S1: { name: "Школы и детсады", weight: .11, direction: "social", description: "100 — норматив выполнен, нет второй смены." },
  S2: { name: "Первичная медицина", weight: .11, direction: "social", description: "100 — норматив на жителя выполнен." },
  B1: { name: "Безопасность улиц", weight: .09, direction: "safety", description: "100 — освещение и камеры, минимум происшествий." },
  B2: { name: "Дорожная безопасность", weight: .09, direction: "safety", description: "100 — минимум ДТП с пострадавшими." },
  C1: { name: "Надёжность ЖКХ", weight: .10, direction: "services", description: "100 — нет аварий отопления и воды за год." },
  C2: { name: "Обращения жителей", weight: .10, direction: "services", description: "100 — все обращения закрыты в срок." },
};

export function districtQuality(indicators: MetricValues): number {
  return metricCodes.reduce((sum, code) => sum + indicators[code] * metricDefinitions[code].weight, 0);
}

