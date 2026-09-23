import { CaseHttpError } from "./http";

type LimiterState = { active: number; starts: number[] };

export class CaseAiLimiter {
  constructor(
    private readonly requestsPerMinute = 12,
    private readonly concurrency = 2,
    private readonly now: () => number = Date.now,
    private readonly state: LimiterState = { active: 0, starts: [] },
  ) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.now();
    while (this.state.starts.length && this.state.starts[0] <= current - 60000) this.state.starts.shift();
    if (this.state.active >= this.concurrency || this.state.starts.length >= this.requestsPerMinute) {
      throw new CaseHttpError(429, "AI_RATE_LIMIT", "Слишком много AI-запросов. Повторите попытку через минуту.");
    }
    this.state.starts.push(current);
    this.state.active += 1;
    try {
      return await operation();
    } finally {
      this.state.active -= 1;
    }
  }
}

const runtime = globalThis as typeof globalThis & { __akimCaseAiLimiterState?: LimiterState };
export const caseAiLimiter = new CaseAiLimiter(12, 2, Date.now, runtime.__akimCaseAiLimiterState ??= { active: 0, starts: [] });
