import { SDK_VERSION } from "../constants";
import type { FetchLike, HttpMethod, RequestOptions } from "../types";
import { buildQuery, messageFrom, parseBody } from "../utils";
import { ReachBellError } from "./error";

export interface HttpConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetch: FetchLike;
  headers: Record<string, string>;
}

export async function send<T>(
  config: HttpConfig,
  method: HttpMethod,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}${buildQuery(options.query)}`;
  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": `reachbell-node/${SDK_VERSION}`,
    ...config.headers,
    ...options.headers,
    "x-api-key": config.apiKey,
  };
  if (body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await config.fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? config.timeoutMs),
    });
  } catch (err) {
    const reason = err instanceof Error ? err : new Error(String(err));
    const timedOut = reason.name === "TimeoutError" || reason.name === "AbortError";
    throw new ReachBellError(
      timedOut ? `Request to ${path} timed out` : `Request to ${path} failed: ${reason.message}`,
      0,
      null,
    );
  }

  const parsed = parseBody(await response.text());
  if (!response.ok) {
    throw new ReachBellError(messageFrom(parsed, `ReachBell returned ${response.status}`), response.status, parsed);
  }
  return parsed as T;
}
