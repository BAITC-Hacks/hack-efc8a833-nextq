export class CaseHttpError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "CaseHttpError";
  }
}

export async function readBoundedText(body: ReadableStream<Uint8Array> | null, maxBytes: number, timeoutMs: number): Promise<string> {
  if (!body) throw new CaseHttpError(400, "INVALID_JSON", "Требуется JSON-тело запроса.");
  const reader = body.getReader();
  let completed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const consume = async () => {
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) throw new CaseHttpError(413, "BODY_TOO_LARGE", "Превышен допустимый размер запроса.");
        chunks.push(value);
      }
      completed = true;
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    } finally {
      if (!completed) void reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  };
  try {
    return await Promise.race([
      consume(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void reader.cancel().catch(() => undefined);
          reject(new CaseHttpError(408, "BODY_TIMEOUT", "Время чтения запроса истекло."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readCaseRequest(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new CaseHttpError(415, "UNSUPPORTED_CONTENT_TYPE", "Передайте Content-Type: application/json.");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > 32768)) {
    throw new CaseHttpError(413, "BODY_TOO_LARGE", "Превышен допустимый размер запроса.");
  }
  try {
    return JSON.parse(await readBoundedText(request.body, 32768, 5000));
  } catch (error) {
    if (error instanceof CaseHttpError) throw error;
    throw new CaseHttpError(400, "INVALID_JSON", "Тело запроса должно содержать корректный JSON.");
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
