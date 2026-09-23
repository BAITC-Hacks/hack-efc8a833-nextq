import { CityLab } from "@/components/city-lab/city-lab";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "City Lab — Аким на 5 часов",
  description: "Пять районов Астаны, четырнадцать мер и бюджет 100. Проверьте последствия пяти решений для города за восемь кварталов.",
};

export default function Home() {
  return <CityLab />;
}
