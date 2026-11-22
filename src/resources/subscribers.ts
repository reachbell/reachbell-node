import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, RequestOptions } from "../types";
import { requireObject, requireString } from "../helpers/validate";

export class Subscribers {
  constructor(private readonly config: HttpConfig) {}

  async identify(params: { token: string; externalId: string }, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "subscribers.identify");
    return send(this.config, "POST", "/subscribers/identify", params, options);
  }

  async tag(params: { token: string; tags: string[] }, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "subscribers.tag");
    return send(this.config, "POST", "/subscribers/tag", params, options);
  }

  async untag(params: { token: string; tags: string[] }, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "subscribers.untag");
    return send(this.config, "POST", "/subscribers/untag", params, options);
  }

  async delete(token: string, options?: RequestOptions): Promise<ApiResult> {
    requireString(token, "subscribers.delete", "token");
    return send(this.config, "DELETE", `/subscribers/${encodeURIComponent(token)}`, undefined, options);
  }
}
