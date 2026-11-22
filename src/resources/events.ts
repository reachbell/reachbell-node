import { MAX_EVENT_BATCH } from "../constants";
import { ReachBellBatchError } from "../helpers/error";
import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, EventParams, RequestOptions } from "../types";
import { compact } from "../utils";
import { requireArray, requireObject } from "../helpers/validate";

export class Events {
  constructor(private readonly config: HttpConfig) {}

  async track(event: EventParams, options?: RequestOptions): Promise<ApiResult> {
    requireObject(event, "events.track", "event");
    return send(this.config, "POST", "/events", compact({ ...event }), options);
  }

  /**
   * Sends events in chunks of 25, one chunk at a time, and resolves with one
   * result per chunk. If a chunk fails, sending stops and the promise rejects
   * with a `ReachBellBatchError` whose `results` / `sentCount` describe the
   * chunks that were already accepted.
   */
  async trackBatch(events: EventParams[], options?: RequestOptions): Promise<ApiResult[]> {
    // Validate every event up front so a bad entry fails before any chunk is sent.
    requireArray(events, "events.trackBatch", "events");
    // A plain loop (not forEach) so holes in a sparse array are checked too.
    for (let i = 0; i < events.length; i++) requireObject(events[i], "events.trackBatch", `events[${i}]`);
    const results: ApiResult[] = [];
    let sent = 0;
    for (let i = 0; i < events.length; i += MAX_EVENT_BATCH) {
      try {
        const chunk = events.slice(i, i + MAX_EVENT_BATCH).map((e) => compact({ ...e }));
        results.push(await send<ApiResult>(this.config, "POST", "/events", { events: chunk }, options));
        sent += chunk.length;
      } catch (err) {
        throw new ReachBellBatchError(err, results, sent, i / MAX_EVENT_BATCH);
      }
    }
    return results;
  }
}
