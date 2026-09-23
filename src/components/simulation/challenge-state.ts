import type { EventCatalog, EventChallengeInput } from "../../domain/events";
import { directions, type CityDataset, type Direction } from "../../domain/model";
import type { DraftDecision } from "./initiative-picker";

export type ChallengeDraft = Record<Direction, DraftDecision>;
export type ChallengeState = {
  stage: "initial" | "response";
  initial: ChallengeDraft;
  response: ChallengeDraft;
  eventId: string;
  error: string;
};
export type ChallengeAction =
  | { type: "decision"; direction: Direction; decision: DraftDecision }
  | { type: "event"; eventId: string }
  | { type: "continue" | "back" | "reset" };

function emptyDraft(): ChallengeDraft {
  return Object.fromEntries(directions.map((direction) => [direction, { districtId: "", initiativeId: "" }])) as ChallengeDraft;
}

export function createChallengeState(catalog: EventCatalog): ChallengeState {
  return { stage: "initial", initial: emptyDraft(), response: emptyDraft(), eventId: catalog.events[0]?.id ?? "", error: "" };
}

export function draftSummary(draft: ChallengeDraft, city: CityDataset) {
  const spent = directions.reduce((total, direction) => total + (city.initiatives.find((item) => item.id === draft[direction].initiativeId)?.cost ?? 0), 0);
  const completed = directions.filter((direction) => city.districts.some((district) => district.id === draft[direction].districtId) && city.initiatives.some((item) => item.id === draft[direction].initiativeId && item.direction === direction)).length;
  return { spent, completed, valid: completed === directions.length && spent <= city.budget };
}

export function transitionChallenge(state: ChallengeState, action: ChallengeAction, city: CityDataset, catalog: EventCatalog): ChallengeState {
  switch (action.type) {
    case "reset":
      return createChallengeState(catalog);
    case "back":
      return { ...state, stage: "initial", error: "" };
    case "continue":
      return draftSummary(state.initial, city).valid
        ? { ...state, stage: "response", response: structuredClone(state.initial), error: "" }
        : state;
    case "event":
      return catalog.events.some((event) => event.id === action.eventId) ? { ...state, eventId: action.eventId, error: "" } : state;
    case "decision": {
      const draft = { ...state[state.stage], [action.direction]: action.decision };
      if (draftSummary(draft, city).spent > city.budget) return { ...state, error: "Стоимость решения превышает бюджет. Сначала освободите средства в другом направлении." };
      return { ...state, [state.stage]: draft, error: "" };
    }
  }
}

export function challengeInput(state: ChallengeState, city: CityDataset, catalog: EventCatalog): EventChallengeInput | null {
  if (state.stage !== "response" || !draftSummary(state.initial, city).valid || !draftSummary(state.response, city).valid || !catalog.events.some((event) => event.id === state.eventId)) return null;
  return {
    datasetVersion: city.datasetVersion,
    rulesVersion: city.rulesVersion,
    eventPackVersion: catalog.eventPackVersion,
    eventId: state.eventId,
    initialDecisions: directions.map((direction) => ({ direction, ...state.initial[direction] })),
    responseDecisions: directions.map((direction) => ({ direction, ...state.response[direction] })),
  };
}
