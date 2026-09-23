import type { Direction } from "@/domain/model";

export const directionNames: Record<Direction, string> = {
  transport: "Транспорт",
  green: "Зелёные зоны",
  social: "Социальная среда",
  safety: "Безопасность",
  services: "Городские сервисы",
};

export function formatScore(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
}

export function formatDelta(value: number): string {
  return `${value > 0 ? "+" : ""}${formatScore(value)}`;
}
