import type { CityDataset } from "../domain/model";

export const cityV1: CityDataset = {
  datasetVersion: "city-1",
  rulesVersion: "rules-1",
  budget: 100,
  districts: [
    { id: "orken", name: "Оркен", population: 10, indicators: { transport: 40, green: 50, social: 50, safety: 55, services: 55 } },
    { id: "arna", name: "Арна", population: 15, indicators: { transport: 45, green: 45, social: 50, safety: 55, services: 55 } },
    { id: "samal", name: "Самал", population: 15, indicators: { transport: 45, green: 50, social: 50, safety: 50, services: 55 } },
    { id: "bastau", name: "Бастау", population: 20, indicators: { transport: 40, green: 55, social: 50, safety: 55, services: 50 } },
    { id: "keruen", name: "Керуен", population: 20, indicators: { transport: 50, green: 50, social: 45, safety: 55, services: 50 } },
    { id: "zhibek", name: "Жибек", population: 20, indicators: { transport: 45, green: 50, social: 55, safety: 50, services: 50 } },
  ],
  initiatives: [
    { id: "keep-transport", direction: "transport", name: "Сохранить транспортную схему", description: "Оставить транспортные показатели без изменений.", cost: 0, deltas: {} },
    { id: "bus-priority", direction: "transport", name: "Приоритет автобусов", description: "Выделить полосу и настроить приоритет на перекрёстках.", cost: 20, deltas: { transport: 10 } },
    { id: "road-widening", direction: "transport", name: "Расширение дороги", description: "Повысить пропускную способность за счёт части зелёной зоны.", cost: 35, deltas: { transport: 15, green: -8 } },
    { id: "keep-green", direction: "green", name: "Сохранить озеленение", description: "Оставить зелёные зоны без изменений.", cost: 0, deltas: {} },
    { id: "pocket-parks", direction: "green", name: "Карманные парки", description: "Создать небольшие зелёные пространства рядом с жильём.", cost: 15, deltas: { green: 10 } },
    { id: "tree-corridor", direction: "green", name: "Зелёный коридор", description: "Высадить деревья вдоль улиц с небольшим сужением проезда.", cost: 25, deltas: { green: 15, transport: -1 } },
    { id: "keep-social", direction: "social", name: "Сохранить социальную инфраструктуру", description: "Оставить доступность социальных объектов без изменений.", cost: 0, deltas: {} },
    { id: "neighborhood-center", direction: "social", name: "Районный общественный центр", description: "Объединить социальные программы и помощь жителям в одном месте.", cost: 25, deltas: { social: 12, services: 2 } },
    { id: "mobile-clinic", direction: "social", name: "Мобильная поликлиника", description: "Организовать выездные приёмы и профилактическую помощь.", cost: 18, deltas: { social: 8, safety: 1 } },
    { id: "keep-safety", direction: "safety", name: "Сохранить меры безопасности", description: "Оставить показатели безопасности без изменений.", cost: 0, deltas: {} },
    { id: "street-lighting", direction: "safety", name: "Уличное освещение", description: "Осветить дворы и переходы, повысив безопасность передвижения.", cost: 15, deltas: { safety: 10, transport: 1 } },
    { id: "cameras", direction: "safety", name: "Камеры в общественных местах", description: "Улучшить наблюдение и обработку обращений о происшествиях.", cost: 20, deltas: { safety: 10, services: 2 } },
    { id: "keep-services", direction: "services", name: "Сохранить городские сервисы", description: "Оставить качество городских сервисов без изменений.", cost: 0, deltas: {} },
    { id: "digital-one-stop", direction: "services", name: "Цифровое единое окно", description: "Упростить обращения за городскими и социальными услугами.", cost: 10, deltas: { services: 10, social: 2 } },
    { id: "mobile-desk", direction: "services", name: "Выездной центр услуг", description: "Организовать очную помощь с городскими и социальными услугами.", cost: 16, deltas: { services: 8, social: 3 } },
  ],
  pairInteractions: [
    { initiativeIds: ["pocket-parks", "street-lighting"], deltas: { safety: 2 } },
  ],
};
