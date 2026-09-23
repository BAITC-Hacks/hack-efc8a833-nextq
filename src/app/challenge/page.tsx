import { ChallengeBuilder } from "@/components/simulation/challenge-builder";
import { cityV1 } from "@/data/city-v1";
import { eventsV1 } from "@/data/events-v1";
import Link from "next/link";

export default function ChallengePage() {
  return <><aside style={{ padding: "12px 24px", background: "#eaf2ec", color: "#294b3d", fontSize: 14 }}>Дополнительная учебная модель city-1. Основной датасет Астаны — в <Link href="/" style={{ textDecoration: "underline" }}>Qala Lab</Link>.</aside><ChallengeBuilder city={cityV1} catalog={eventsV1} /></>;
}
