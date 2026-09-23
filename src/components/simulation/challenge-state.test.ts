import assert from "node:assert/strict";
import test from "node:test";
import { cityV1 } from "../../data/city-v1";
import { eventsV1 } from "../../data/events-v1";
import { directions } from "../../domain/model";
import { createChallengeState, transitionChallenge, draftSummary, challengeInput } from "./challenge-state";

function completedState() {
  let state = createChallengeState(eventsV1);
  const ids = ["road-widening", "pocket-parks", "neighborhood-center", "street-lighting", "digital-one-stop"];
  directions.forEach((direction, index) => {
    state = transitionChallenge(state, { type: "decision", direction, decision: { districtId: "orken", initiativeId: ids[index] } }, cityV1, eventsV1);
  });
  return state;
}

test("incomplete initial plan cannot advance or create a request", () => {
  const state = createChallengeState(eventsV1);
  assert.equal(transitionChallenge(state, { type: "continue" }, cityV1, eventsV1).stage, "initial");
  assert.equal(challengeInput(state, cityV1, eventsV1), null);
});

test("response begins as a copy and spends its own budget without changing initial decisions", () => {
  const initial = completedState();
  let state = transitionChallenge(initial, { type: "continue" }, cityV1, eventsV1);
  assert.equal(state.stage, "response");
  assert.deepEqual(state.response, state.initial);
  state = transitionChallenge(state, { type: "decision", direction: "transport", decision: { initiativeId: "bus-priority", districtId: "bastau" } }, cityV1, eventsV1);
  assert.equal(draftSummary(state.initial, cityV1).spent, 100);
  assert.equal(draftSummary(state.response, cityV1).spent, 85);
  assert.equal(state.initial.transport.districtId, "orken");
  assert.equal(challengeInput(state, cityV1, eventsV1)?.responseDecisions[0].districtId, "bastau");
});

test("unaffordable response change is rejected while preserving the last valid plan", () => {
  let state = transitionChallenge(completedState(), { type: "continue" }, cityV1, eventsV1);
  const costly = cityV1.initiatives.find((item) => item.direction === "green" && item.cost > 15)!;
  state = transitionChallenge(state, { type: "decision", direction: "green", decision: { districtId: "orken", initiativeId: costly.id } }, cityV1, eventsV1);
  assert.equal(state.response.green.initiativeId, "pocket-parks");
  assert.match(state.error, /бюджет/);
});

test("reset clears both plans; returning to initial then continuing replaces the response copy", () => {
  let state = transitionChallenge(completedState(), { type: "continue" }, cityV1, eventsV1);
  state = transitionChallenge(state, { type: "decision", direction: "transport", decision: { initiativeId: "bus-priority", districtId: "bastau" } }, cityV1, eventsV1);
  state = transitionChallenge(state, { type: "back" }, cityV1, eventsV1);
  state = transitionChallenge(state, { type: "continue" }, cityV1, eventsV1);
  assert.deepEqual(state.response, state.initial);
  state = transitionChallenge(state, { type: "reset" }, cityV1, eventsV1);
  assert.equal(draftSummary(state.initial, cityV1).completed, 0);
  assert.equal(draftSummary(state.response, cityV1).spent, 0);
});

test("event selection uses the catalog and request includes all versions without client effects", () => {
  let state = transitionChallenge(completedState(), { type: "continue" }, cityV1, eventsV1);
  state = transitionChallenge(state, { type: "event", eventId: "heat-island" }, cityV1, eventsV1);
  const input = challengeInput(state, cityV1, eventsV1)!;
  assert.equal(input.eventId, "heat-island");
  assert.equal(input.eventPackVersion, eventsV1.eventPackVersion);
  assert.equal(input.datasetVersion, cityV1.datasetVersion);
  assert.equal(input.rulesVersion, cityV1.rulesVersion);
  assert.equal(input.initialDecisions.length, 5);
  assert.deepEqual(Object.keys(input.responseDecisions[0]).sort(), ["direction", "districtId", "initiativeId"]);
  assert.equal(transitionChallenge(state, { type: "event", eventId: "unknown" }, cityV1, eventsV1).eventId, "heat-island");
});
