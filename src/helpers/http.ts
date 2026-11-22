import { SDK_VERSION } from "../constants";
import type { FetchLike, HttpMethod, RequestOptions } from "../types";
import { appendQuery, describeError, mergeHeaders, messageFrom, parseBody } from "../utils";
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
  const url = appendQuery(`${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, options.query);

  // Serialise before the network try so a bad body (BigInt, circular) is not
  // reported as a network failure.
  let encoded: string | undefined;
  if (body !== undefined) {
    try {
      encoded = JSON.stringify(body);
    } catch (err) {
      throw new ReachBellError(
        `Could not serialise request body for ${path}: ${err instanceof Error ? err.message : String(err)}`,
        0,
        null,
        { cause: err },
      );
    }
  }

  // Header names are case-insensitive: normalise to lower case so a caller's
  // "Content-Type" replaces the SDK default instead of being sent twice. The
  // caller wins over SDK defaults; the API key is always the configured one.
  const headers = mergeHeaders(
    {
      accept: "application/json",
      "user-agent": `reachbell-node/${SDK_VERSION}`,
      ...(encoded !== undefined ? { "content-type": "application/json" } : {}),
    },
    config.headers,
    options.headers,
    { "x-api-key": config.apiKey },
  );

  let response: Response;
  let text: string;
  try {
    response = await config.fetch(url, {
      method,
      headers,
      body: encoded,
      signal: AbortSignal.timeout(options.timeoutMs ?? config.timeoutMs),
    });
    // Reading the body is still covered by the timeout signal and can fail
    // mid-stream, so keep it inside the same try.
    text = await response.text();
  } catch (err) {
    const reason = err instanceof Error ? err : new Error(String(err));
    const timedOut = reason.name === "TimeoutError" || reason.name === "AbortError";
    throw new ReachBellError(
      timedOut ? `Request to ${path} timed out` : `Request to ${path} failed: ${describeError(reason)}`,
      0,
      null,
      { cause: err },
    );
  }

  const parsed = parseBody(text);
  if (!response.ok) {
    throw new ReachBellError(messageFrom(parsed, `ReachBell returned ${response.status}`, response.status), response.status, parsed);
  }
  return parsed as T;
}
