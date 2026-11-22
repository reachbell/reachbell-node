const SNIPPET_LENGTH = 200;

export function compact<T extends object>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out as T;
}

export function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Returns the trimmed value, or undefined when it is missing or blank. */
export function nonBlank(value: string | undefined | null): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

export function buildQuery(query?: Record<string, string | number | boolean | undefined>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.append(key, String(value));
  }
  return params.toString();
}

/** Appends query parameters, using `&` when the URL already has a query string. */
export function appendQuery(url: string, query?: Record<string, string | number | boolean | undefined>): string {
  const text = buildQuery(query);
  if (!text) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${text}`;
}

/** Merges header maps case-insensitively (names lower-cased); later maps win. */
export function mergeHeaders(...sources: Array<Record<string, string> | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [name, value] of Object.entries(source)) {
      if (value !== undefined) out[name.toLowerCase()] = value;
    }
  }
  return out;
}

export function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** A short single-line excerpt of a raw (non-JSON) body, e.g. an HTML error page. */
export function snippet(text: string): string {
  const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  return chars.length > SNIPPET_LENGTH ? `${chars.slice(0, SNIPPET_LENGTH).join("").trimEnd()}…` : clean;
}

export function messageFrom(body: unknown, fallback: string, status?: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.map((m) => (typeof m === "string" ? m : JSON.stringify(m))).join("; ");
    if (typeof message === "string") return message;
  }
  if (typeof body === "string" && body.trim()) {
    const excerpt = snippet(body);
    return status === undefined ? excerpt : `ReachBell returned ${status}: ${excerpt}`;
  }
  return fallback;
}

/**
 * Describes a fetch failure including its cause. undici rejects with
 * "fetch failed" and puts the real reason (ECONNREFUSED, ENOTFOUND, TLS…) in
 * `err.cause`.
 */
export function describeError(err: Error): string {
  const cause = (err as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object") return err.message;
  const code = typeof (cause as { code?: unknown }).code === "string" ? (cause as { code: string }).code : undefined;
  const raw = (cause as { message?: unknown }).message;
  const message = typeof raw === "string" ? raw : undefined;
  const detail = code && message && !message.includes(code) ? `${code}: ${message}` : message || code;
  return detail ? `${err.message} (${detail})` : err.message;
}
