import type { ApiResult } from "../types";

export class ReachBellError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown, options?: { cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ReachBellError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Thrown by `events.trackBatch()` when a chunk fails. Chunks are sent in order
 * and sending stops at the first failure; `results` holds the responses of the
 * chunks that were accepted before it, so those events need not be re-sent.
 * `status`, `body` and `cause` come from the failing chunk's error.
 */
export class ReachBellBatchError extends ReachBellError {
  /** Responses of the chunks that succeeded, in order. */
  readonly results: ApiResult[];
  /** Number of events in the chunks that succeeded. */
  readonly sentCount: number;
  /** Zero-based index of the chunk that failed. */
  readonly failedChunk: number;

  constructor(cause: unknown, results: ApiResult[], sentCount: number, failedChunk: number) {
    const inner = cause instanceof ReachBellError ? cause : undefined;
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(
      `Event batch failed at chunk ${failedChunk} after ${sentCount} events were sent: ${reason}`,
      inner?.status ?? 0,
      inner?.body ?? null,
      { cause },
    );
    this.name = "ReachBellBatchError";
    this.results = results;
    this.sentCount = sentCount;
    this.failedChunk = failedChunk;
  }
}
