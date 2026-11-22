import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, CampaignParams, RequestOptions } from "../types";
import { compact } from "../utils";

export class Campaigns {
  constructor(private readonly config: HttpConfig) {}

  async send(params: CampaignParams, options?: RequestOptions): Promise<ApiResult> {
    const scheduledAt = params.scheduledAt instanceof Date ? params.scheduledAt.toISOString() : params.scheduledAt;
    const payload = compact({
      ...params,
      content: compact(params.content),
      segment: params.segment ?? {},
      scheduledAt,
    });
    return send(this.config, "POST", "/campaigns/server", payload, options);
  }
}
