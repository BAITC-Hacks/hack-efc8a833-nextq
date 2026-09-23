import { cityV1 } from "../data/city-v1";
import { evaluateScenario } from "../domain/evaluate-scenario";
import type { ScenarioInput, ScenarioResult } from "../domain/model";

export function runScenario(input: ScenarioInput): ScenarioResult {
  return evaluateScenario(input, cityV1);
}
