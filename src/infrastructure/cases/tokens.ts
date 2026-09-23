import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CaseBlueprint } from "@/domain/city-case";
import { CaseHttpError } from "./http";
import { blueprintSchema, caseTokenLimit } from "./schemas";

export type CaseEnvironment = Record<string, string | undefined>;
const lifetimeMs = 7 * 24 * 60 * 60 * 1000;
const runtime = globalThis as typeof globalThis & { __akimCaseDevelopmentSecret?: string };
const payloadSchema = z.strictObject({
  version: z.literal("astana-1"),
  caseId: z.string().regex(/^ai-[a-f0-9-]{36}$/),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  blueprint: blueprintSchema,
});

export function signingAvailable(env: CaseEnvironment): boolean {
  return (env.CASE_SIGNING_SECRET?.trim().length ?? 0) >= 32 || env.NODE_ENV !== "production";
}

function signingSecret(env: CaseEnvironment): string {
  const configured = env.CASE_SIGNING_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (env.NODE_ENV === "production") {
    throw new CaseHttpError(503, "SIGNING_UNAVAILABLE", "AI-кейсы временно недоступны: сервер не настроен для их проверки.");
  }
  runtime.__akimCaseDevelopmentSecret ??= randomBytes(32).toString("hex");
  return runtime.__akimCaseDevelopmentSecret;
}

export function signCase(blueprint: CaseBlueprint, caseId: string, env: CaseEnvironment, now = Date.now()): string {
  const payload = payloadSchema.parse({ version: "astana-1", caseId, issuedAt: now, expiresAt: now + lifetimeMs, blueprint });
  const content = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", signingSecret(env)).update(`v1.${content}`).digest("base64url");
  const token = `v1.${content}.${signature}`;
  if (token.length > caseTokenLimit) throw new CaseHttpError(503, "CASE_TOO_LARGE", "Сгенерированный кейс превышает допустимый размер.");
  return token;
}

export function verifyCase(token: string, caseId: string, env: CaseEnvironment, now = Date.now()): CaseBlueprint {
  const secret = signingSecret(env);
  const invalid = () => new CaseHttpError(400, "INVALID_CASE_TOKEN", "Подпись кейса недействительна или истекла. Создайте кейс заново.");
  if (token.length > caseTokenLimit) throw invalid();
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) throw invalid();
  const expected = createHmac("sha256", secret).update(`v1.${parts[1]}`).digest();
  const received = Buffer.from(parts[2], "base64url");
  if (received.length !== expected.length || received.toString("base64url") !== parts[2] || !timingSafeEqual(received, expected)) throw invalid();
  try {
    const payload = payloadSchema.parse(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
    if (payload.caseId !== caseId || payload.expiresAt <= now || payload.issuedAt > now || payload.expiresAt - payload.issuedAt !== lifetimeMs) throw invalid();
    return payload.blueprint;
  } catch {
    throw invalid();
  }
}
