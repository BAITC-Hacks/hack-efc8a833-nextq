import { z } from "zod";
import { caseThemes } from "@/domain/city-case";

export const caseTokenLimit = 20000;
export const districtIds = ["yesil", "almaty", "saryarka", "baikonur", "nura"] as const;

const indicator = z.number().min(0).max(100);
const identifier = z.string().min(1).max(100);

export const blueprintSchema = z.strictObject({
  title: z.string().trim().min(8).max(100),
  summary: z.string().trim().min(20).max(400),
  theme: z.enum(caseThemes),
  briefing: z.array(z.string().trim().min(20).max(500)).min(2).max(5),
  districts: z.array(z.strictObject({
    id: z.enum(districtIds),
    populationShare: z.number().positive().max(1),
    indicators: z.strictObject({ T1: indicator, T2: indicator, E1: indicator, E2: indicator, S1: indicator, S2: indicator, B1: indicator, B2: indicator, C1: indicator, C2: indicator }),
  })).length(5)
    .refine((districts) => new Set(districts.map(({ id }) => id)).size === 5)
    .refine((districts) => Math.abs(districts.reduce((sum, district) => sum + district.populationShare, 0) - 1) <= 1e-6),
});

export const generateSchema = z.strictObject({
  brief: z.string().trim().min(20).max(2000),
  theme: z.enum(caseThemes).optional(),
});

export const evaluationSchema = z.strictObject({
  caseId: identifier,
  caseToken: z.string().min(1).max(caseTokenLimit).optional(),
  decisions: z.array(z.strictObject({
    measureId: identifier,
    districtId: identifier.optional(),
  })).length(5),
});

export const narrationSchema = z.strictObject({
  summary: z.string().trim().min(20).max(2000),
  strengths: z.array(z.string().trim().min(1).max(700)).max(8),
  risks: z.array(z.string().trim().min(1).max(700)).max(8),
  tradeoffs: z.array(z.string().trim().min(1).max(700)).max(8),
});

export type EvaluationRequest = z.infer<typeof evaluationSchema>;
