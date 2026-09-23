import type { EventCatalog } from "../domain/events";

export const eventsV1: EventCatalog = {
  eventPackVersion: "event-pack-1",
  events: [
    {
      id: "crossing-closure",
      name: "Закрытие переправы в Бастау",
      description: "Переправа временно закрыта, транспортная доступность района снижается.",
      districtId: "bastau",
      rawDeltas: { transport: -10 },
    },
    {
      id: "heat-island",
      name: "Волна городской жары в Оркене",
      description: "Жара ухудшает состояние зелёных зон и безопасность городской среды.",
      districtId: "orken",
      rawDeltas: { green: -8, safety: -2 },
    },
    {
      id: "service-outage",
      name: "Сбой районных сервисов в Керуене",
      description: "Сбой затрудняет получение городских услуг и доступ к социальной инфраструктуре.",
      districtId: "keruen",
      rawDeltas: { services: -10, social: -2 },
    },
  ],
};
