import { ChallengeBuilder } from "@/components/simulation/challenge-builder";
import { cityV1 } from "@/data/city-v1";
import { eventsV1 } from "@/data/events-v1";

export default function ChallengePage() {
  return <ChallengeBuilder city={cityV1} catalog={eventsV1} />;
}
