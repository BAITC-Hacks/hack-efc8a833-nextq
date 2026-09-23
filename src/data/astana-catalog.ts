import type { CaseDistrict, CityMeasure } from "../domain/city-case";
export { districtQuality, metricDefinitions } from "../domain/astana-metrics";

export const astanaDistricts: CaseDistrict[] = [
  { id: "yesil", name: "Есиль", populationShare: .27, indicators: { T1: 45, T2: 62, E1: 68, E2: 72, S1: 48, S2: 55, B1: 78, B2: 60, C1: 75, C2: 70 } },
  { id: "almaty", name: "Алматы", populationShare: .24, indicators: { T1: 40, T2: 75, E1: 50, E2: 55, S1: 60, S2: 65, B1: 62, B2: 52, C1: 50, C2: 60 } },
  { id: "saryarka", name: "Сарыарка", populationShare: .20, indicators: { T1: 50, T2: 70, E1: 42, E2: 40, S1: 62, S2: 68, B1: 58, B2: 55, C1: 45, C2: 55 } },
  { id: "baikonur", name: "Байконур", populationShare: .13, indicators: { T1: 52, T2: 68, E1: 55, E2: 50, S1: 58, S2: 60, B1: 52, B2: 58, C1: 55, C2: 58 } },
  { id: "nura", name: "Нура", populationShare: .16, indicators: { T1: 55, T2: 40, E1: 45, E2: 65, S1: 38, S2: 35, B1: 55, B2: 50, C1: 60, C2: 50 } },
];

export const astanaMeasures: CityMeasure[] = [
  { id: "M1", direction: "transport", name: "Выделенные полосы для автобусов", description: "Приоритет автобусов в выбранном районе.", scope: "district", cost: 18, lagQuarters: 2, effects: { T1: 6, T2: 9 } },
  { id: "M2", direction: "transport", name: "Умные светофоры", description: "Координация светофоров во всех районах.", scope: "city", cost: 22, lagQuarters: 2, effects: { T1: 4, B2: 3 } },
  { id: "M3", direction: "transport", name: "Линия ЛРТ / расширение", description: "Развитие рельсового транспорта в выбранном районе.", scope: "district", cost: 30, lagQuarters: 4, effects: { T1: 16, T2: 20, E2: 4 } },
  { id: "M4", direction: "green", name: "Парк / сквер", description: "Зелёное общественное пространство в выбранном районе.", scope: "district", cost: 15, lagQuarters: 2, effects: { E1: 12, E2: 3, B1: 2 } },
  { id: "M5", direction: "green", name: "Перевод частного сектора на чистое топливо", description: "Снижение загрязнения от отопления в выбранном районе.", scope: "district", cost: 25, lagQuarters: 3, effects: { E2: 14, C1: 4 } },
  { id: "M6", direction: "green", name: "Городская программа озеленения и ветрозащитных полос", description: "Озеленение действует в каждом районе.", scope: "city", cost: 20, lagQuarters: 4, effects: { E1: 5, E2: 3 } },
  { id: "M7", direction: "social", name: "Школа + детсад (модульное строительство)", description: "Дополнительные места для детей выбранного района.", scope: "district", cost: 24, lagQuarters: 3, effects: { S1: 16 } },
  { id: "M8", direction: "social", name: "Центр семейного здоровья / поликлиника", description: "Доступность первичной медицины в выбранном районе.", scope: "district", cost: 20, lagQuarters: 3, effects: { S2: 14 } },
  { id: "M9", direction: "social", name: "Дворовые спорт-хабы", description: "Районные пространства для активности и общения.", scope: "district", cost: 10, lagQuarters: 1, effects: { S1: 3, S2: 3, B1: 3 } },
  { id: "M10", direction: "safety", name: "Освещение и камеры (расширение Safe City)", description: "Освещение и наблюдение в выбранном районе.", scope: "district", cost: 12, lagQuarters: 1, effects: { B1: 12, B2: 2 } },
  { id: "M11", direction: "safety", name: "Безопасные переходы и школьные зоны", description: "Безопасность движения с небольшим снижением разгрузки дорог.", scope: "district", cost: 10, lagQuarters: 1, effects: { B2: 12, T1: -2 } },
  { id: "M12", direction: "services", name: "Единая цифровая платформа обращений", description: "Работа с обращениями во всех районах.", scope: "city", cost: 14, lagQuarters: 1, effects: { C2: 5 } },
  { id: "M13", direction: "services", name: "Модернизация тепло- и водосетей", description: "Обновление коммунальной инфраструктуры выбранного района.", scope: "district", cost: 28, lagQuarters: 4, effects: { C1: 18, E2: 2 } },
  { id: "M14", direction: "services", name: "Аварийные бригады ЖКХ + раннее оповещение", description: "Городская готовность к коммунальным авариям.", scope: "city", cost: 16, lagQuarters: 1, effects: { C1: 5, C2: 2 } },
];
