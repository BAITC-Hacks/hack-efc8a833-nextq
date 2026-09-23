import { ScenarioBuilder } from "@/components/simulation/scenario-builder";
import { cityV1 } from "@/data/city-v1";
import Link from "next/link";

export default function SandboxPage() {
  return <><p style={{ maxWidth: 1320, margin: "18px auto", padding: "0 24px", fontSize: 12 }}>Дополнительная учебная модель city-1. Основной датасет Астаны — в <Link href="/">City Lab</Link>.</p><ScenarioBuilder city={cityV1} /></>;
}
