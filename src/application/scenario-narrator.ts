import type { ScenarioResult } from "@/domain/model";

export type ScenarioNarration = {
  summary: string;
  strengths: string[];
  risks: string[];
  tradeoffs: string[];
};

export type NarrationState =
  | { status: "ready"; content: ScenarioNarration }
  | { status: "unavailable"; reason: string };

export interface ScenarioNarrator {
  explain(result: ScenarioResult): Promise<ScenarioNarration>;
}

export async function narrateScenario(result: ScenarioResult, narrator: ScenarioNarrator): Promise<NarrationState> {
  try {
    return { status: "ready", content: await narrator.explain(result) };
  } catch {
    return {
      status: "unavailable",
      reason: "AI-объяснение сейчас недоступно. Численный результат сценария рассчитан.",
    };
  }
}
