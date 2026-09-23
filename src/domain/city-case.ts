import type { CityDataset, Decision, Direction, IndicatorValues, ScenarioResult } from "./model";

export const caseThemes = ["winter", "heat", "growth", "mobility"] as const;
export type CaseTheme = (typeof caseThemes)[number];
export const caseHorizons = [3, 12, 36] as const;
export type CaseHorizon = (typeof caseHorizons)[number];

export type CaseBlueprint = {
  title: string;
  summary: string;
  theme: CaseTheme;
  briefing: string[];
  districts: { id: string; population: number; indicators: IndicatorValues }[];
};

export type InitiativePolicy = {
  initiativeId: string;
  deliveryMonths: number;
  annualMaintenance: number;
};

export type CityCase = {
  id: string;
  version: "cases-1";
  source: "curated" | "ai";
  theme: CaseTheme;
  title: string;
  summary: string;
  briefing: string[];
  assumptions: string[];
  city: CityDataset;
  policies: InitiativePolicy[];
  maintenanceBudget: number;
};

export type CaseEvaluationInput = {
  decisions: Decision[];
  horizonMonths: CaseHorizon;
};

export type CaseRecommendation = {
  direction: Direction;
  initiativeId: string;
  districtId: string;
  aqolGain: number;
  capitalChange: number;
  maintenanceChange: number;
  explanation: string;
};

export type CaseEvaluation = {
  caseId: string;
  caseVersion: "cases-1";
  horizonMonths: CaseHorizon;
  result: ScenarioResult;
  maintenance: { annual: number; limit: number; remaining: number };
  lifecycleCost: number;
  trajectory: { month: CaseHorizon; aqol: number }[];
  sensitivity: { low: number; central: number; high: number };
  equity: { gapBefore: number; gapAfter: number; weakestDistrictId: string };
  reach: { population: number; share: number };
  recommendations: CaseRecommendation[];
  warnings: string[];
};

export class CaseValidationError extends Error {
  constructor(public readonly code: "INVALID_CASE" | "INVALID_HORIZON" | "MAINTENANCE_BUDGET_EXCEEDED", message: string) {
    super(message);
    this.name = "CaseValidationError";
  }
}
