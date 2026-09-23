import type { Decision, IndicatorDelta, ScenarioResult } from "./model";

export type CityEvent = {
  id: string;
  name: string;
  description: string;
  districtId: string;
  rawDeltas: IndicatorDelta;
};

export type EventCatalog = {
  eventPackVersion: string;
  events: CityEvent[];
};

export type ExternalImpact = {
  kind: "event";
  eventId: string;
  districtId: string;
  rawDeltas: IndicatorDelta;
};

export type EventChallengeInput = {
  datasetVersion: string;
  rulesVersion: string;
  eventPackVersion: string;
  eventId: string;
  initialDecisions: Decision[];
  responseDecisions: Decision[];
};

export type EventChallengeResult = {
  datasetVersion: string;
  rulesVersion: string;
  eventPackVersion: string;
  event: CityEvent & { observedDeltas: IndicatorDelta };
  initial: ScenarioResult;
  disrupted: ScenarioResult;
  response: ScenarioResult;
  eventScoreDelta: number;
  recoveryDelta: number;
  responseDeltaFromInitial: number;
};

export type EventChallengeErrorCode = "EVENT_PACK_VERSION_MISMATCH" | "UNKNOWN_EVENT";

export class EventChallengeValidationError extends Error {
  readonly code: EventChallengeErrorCode;

  constructor(code: EventChallengeErrorCode, message: string) {
    super(message);
    this.name = "EventChallengeValidationError";
    this.code = code;
  }
}
