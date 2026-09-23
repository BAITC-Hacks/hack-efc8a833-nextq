import { cityV1 } from "../data/city-v1";
import { eventsV1 } from "../data/events-v1";
import { evaluateScenario } from "../domain/evaluate-scenario";
import {
  EventChallengeValidationError,
  type EventChallengeInput,
  type EventChallengeResult,
  type ExternalImpact,
} from "../domain/events";
import { directions, type IndicatorDelta } from "../domain/model";

export function runEventChallenge(input: EventChallengeInput): EventChallengeResult {
  if (input.eventPackVersion !== eventsV1.eventPackVersion) {
    throw new EventChallengeValidationError("EVENT_PACK_VERSION_MISMATCH", "Версия событий устарела. Обновите страницу.");
  }

  const event = eventsV1.events.find((candidate) => candidate.id === input.eventId);
  if (!event) {
    throw new EventChallengeValidationError("UNKNOWN_EVENT", "Выбрано неизвестное городское событие.");
  }

  const initialInput = {
    datasetVersion: input.datasetVersion,
    rulesVersion: input.rulesVersion,
    decisions: input.initialDecisions,
  };
  const externalImpacts: ExternalImpact[] = [{
    kind: "event",
    eventId: event.id,
    districtId: event.districtId,
    rawDeltas: event.rawDeltas,
  }];
  const initial = evaluateScenario(initialInput, cityV1);
  const disrupted = evaluateScenario(initialInput, cityV1, externalImpacts);
  const response = evaluateScenario({ ...initialInput, decisions: input.responseDecisions }, cityV1, externalImpacts);
  const initialDistrict = initial.districts.find((district) => district.districtId === event.districtId)!;
  const disruptedDistrict = disrupted.districts.find((district) => district.districtId === event.districtId)!;
  const observedDeltas: IndicatorDelta = {};

  for (const direction of directions) {
    if (event.rawDeltas[direction] !== undefined) {
      observedDeltas[direction] = disruptedDistrict.final[direction] - initialDistrict.final[direction];
    }
  }

  return {
    datasetVersion: cityV1.datasetVersion,
    rulesVersion: cityV1.rulesVersion,
    eventPackVersion: eventsV1.eventPackVersion,
    event: { ...event, rawDeltas: { ...event.rawDeltas }, observedDeltas },
    initial,
    disrupted,
    response,
    eventScoreDelta: disrupted.finalAqol - initial.finalAqol,
    recoveryDelta: response.finalAqol - disrupted.finalAqol,
    responseDeltaFromInitial: response.finalAqol - initial.finalAqol,
  };
}
