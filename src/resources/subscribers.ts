import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, RequestOptions } from "../types";

export class Subscribers {
  constructor(private readonly config: HttpConfig) {}

  identify(params: { token: string; externalId: string }, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/subscribers/identify", params, options);
  }

  tag(params: { token: string; tags: string[] }, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/subscribers/tag", params, options);
  }

  untag(params: { token: string; tags: string[] }, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/subscribers/untag", params, options);
  }

  delete(token: string, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "DELETE", `/subscribers/${encodeURIComponent(token)}`, undefined, options);
  }
}
