import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, CampaignParams, RequestOptions } from "../types";
import { compact } from "../utils";
import { describe, invalidArgument, requireObject } from "../helpers/validate";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export class Campaigns {
  constructor(private readonly config: HttpConfig) {}

  async send(params: CampaignParams, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "campaigns.send");
    // Either a content object, or top-level title and body strings.
    if (params.content !== undefined && params.content !== null) {
      requireObject(params.content, "campaigns.send", "params.content");
    } else if (!isNonEmptyString(params.title) || !isNonEmptyString(params.body)) {
      throw invalidArgument(
        "campaigns.send",
        `expects params.content to be an object, or params.title and params.body to be non-empty strings; got content ${describe(params.content)}, title ${describe(params.title)}, body ${describe(params.body)}`,
      );
    }
    const scheduledAt = params.scheduledAt instanceof Date ? params.scheduledAt.toISOString() : params.scheduledAt;
    const payload = compact({
      ...params,
      content: params.content ? compact(params.content) : undefined,
      segment: params.segment ?? {},
      scheduledAt,
    });
    return send(this.config, "POST", "/campaigns/server", payload, options);
  }
}
