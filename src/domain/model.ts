export const directions = ["transport", "green", "social", "safety", "services"] as const;

export type Direction = (typeof directions)[number];
export type IndicatorValues = Record<Direction, number>;
export type IndicatorDelta = Partial<IndicatorValues>;

export type Decision = {
  direction: Direction;
  initiativeId: string;
  districtId: string;
};

export type CityDistrict = {
  id: string;
  name: string;
  population: number;
  indicators: IndicatorValues;
};

export type CityInitiative = {
  id: string;
  direction: Direction;
  name: string;
  description: string;
  cost: number;
  deltas: IndicatorDelta;
};

export type PairInteraction = {
  initiativeIds: [string, string];
  deltas: IndicatorDelta;
};

export type CityDataset = {
  datasetVersion: string;
  rulesVersion: string;
  budget: number;
  districts: CityDistrict[];
  initiatives: CityInitiative[];
  pairInteractions: PairInteraction[];
};

export type ScenarioInput = {
  datasetVersion: string;
  rulesVersion: string;
  decisions: Decision[];
};

export type AppliedDecision = Decision & {
  initiativeName: string;
  districtName: string;
  cost: number;
  deltas: IndicatorDelta;
};

export type DistrictResult = {
  districtId: string;
  districtName: string;
  population: number;
  baseline: IndicatorValues;
  final: IndicatorValues;
  realizedDelta: IndicatorValues;
  quality: number;
};

export type AppliedImpact = {
  kind: "initiative" | "interaction";
  initiativeIds: string[];
  districtId: string;
  rawDeltas: IndicatorDelta;
};

export type ScenarioResult = {
  datasetVersion: string;
  rulesVersion: string;
  budget: number;
  spent: number;
  remaining: number;
  baselineAqol: number;
  finalAqol: number;
  decisions: AppliedDecision[];
  districts: DistrictResult[];
  impacts: AppliedImpact[];
};

export type ScenarioErrorCode =
  | "VERSION_MISMATCH"
  | "INVALID_DECISIONS"
  | "UNKNOWN_INITIATIVE"
  | "UNKNOWN_DISTRICT"
  | "DIRECTION_MISMATCH"
  | "BUDGET_EXCEEDED";

export class ScenarioValidationError extends Error {
  readonly code: ScenarioErrorCode;

  constructor(code: ScenarioErrorCode, message: string) {
    super(message);
    this.name = "ScenarioValidationError";
    this.code = code;
  }
}
