import { ScenarioBuilder } from "@/components/simulation/scenario-builder";
import { cityV1 } from "@/data/city-v1";

export default function Home() {
  return <ScenarioBuilder city={cityV1} />;
}
