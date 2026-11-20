import { MAX_EVENT_BATCH } from "../constants";
import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, EventParams, RequestOptions } from "../types";
import { compact } from "../utils";

export class Events {
  constructor(private readonly config: HttpConfig) {}

  track(event: EventParams, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/events", compact({ ...event }), options);
  }

  async trackBatch(events: EventParams[], options?: RequestOptions): Promise<ApiResult[]> {
    const results: ApiResult[] = [];
    for (let i = 0; i < events.length; i += MAX_EVENT_BATCH) {
      const chunk = events.slice(i, i + MAX_EVENT_BATCH).map((e) => compact({ ...e }));
      results.push(await send<ApiResult>(this.config, "POST", "/events", { events: chunk }, options));
    }
    return results;
  }
}
