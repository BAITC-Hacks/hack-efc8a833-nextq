import type { Direction } from "./model";

export const metricCodes = ["T1", "T2", "E1", "E2", "S1", "S2", "B1", "B2", "C1", "C2"] as const;
export type MetricCode = (typeof metricCodes)[number];
export type MetricValues = Record<MetricCode, number>;
export type MetricEffects = Partial<MetricValues>;
export const caseThemes = ["baseline", "winter", "heat", "growth", "mobility"] as const;
export type CaseTheme = (typeof caseThemes)[number];
export type CaseDecision = { measureId: string; districtId?: string };
export type CaseDistrict = { id: string; name: string; populationShare: number; indicators: MetricValues };
export type CityMeasure = {
  id: string;
  direction: Direction;
  name: string;
  description: string;
  scope: "district" | "city";
  cost: number;
  lagQuarters: number;
  effects: MetricEffects;
};
export type CaseBlueprint = {
  title: string;
  summary: string;
  theme: CaseTheme;
  briefing: string[];
  districts: { id: string; populationShare: number; indicators: MetricValues }[];
};
export type CityCase = {
  id: string;
  version: "astana-1";
  source: "curated" | "ai";
  theme: CaseTheme;
  title: string;
  summary: string;
  briefing: string[];
  assumptions: string[];
  city: { budget: number; horizonQuarters: number; districts: CaseDistrict[]; measures: CityMeasure[] };
};
export type CaseEvaluationInput = { decisions: CaseDecision[] };
export type CaseDistrictResult = {
  districtId: string;
  districtName: string;
  populationShare: number;
  baseline: MetricValues;
  final: MetricValues;
  realizedDelta: MetricValues;
  baselineQuality: number;
  quality: number;
};
export type CaseContribution = {
  measureId: string;
  measureName: string;
  districtIds: string[];
  cost: number;
  lagQuarters: number;
  realizedFraction: number;
  effects: MetricEffects;
};
export type CaseSynergy = { measureIds: [string, string]; districtId: string; effects: MetricEffects };
export type CaseResult = {
  budget: number;
  spent: number;
  remaining: number;
  baselineAqol: number;
  finalAqol: number;
  baselineAverage: number;
  finalAverage: number;
  baselineWeakest: number;
  finalWeakest: number;
  baselineCriticalCount: number;
  criticalCount: number;
  districts: CaseDistrictResult[];
  contributions: CaseContribution[];
  synergies: CaseSynergy[];
};
export type CaseRecommendation = {
  replaceMeasureId: string;
  decision: CaseDecision;
  aqolGain: number;
  capitalChange: number;
  explanation: string;
};
export type CaseEvaluation = {
  caseId: string;
  caseVersion: "astana-1";
  result: CaseResult;
  equity: { gapBefore: number; gapAfter: number; weakestDistrictId: string };
  reach: { populationShare: number };
  recommendations: CaseRecommendation[];
  warnings: string[];
};
export class CaseValidationError extends Error {
  constructor(public readonly code: "INVALID_CASE" | "INVALID_DECISIONS" | "UNKNOWN_MEASURE" | "UNKNOWN_DISTRICT" | "INVALID_SCOPE" | "DUPLICATE_MEASURE" | "DIRECTION_LIMIT" | "INCOMPATIBLE_MEASURES" | "BUDGET_EXCEEDED", message: string) {
    super(message);
    this.name = "CaseValidationError";
  }
}
