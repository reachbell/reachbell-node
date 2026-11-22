import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, RequestOptions } from "../types";

export class Subscribers {
  constructor(private readonly config: HttpConfig) {}

  async identify(params: { token: string; externalId: string }, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/subscribers/identify", params, options);
  }

  async tag(params: { token: string; tags: string[] }, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/subscribers/tag", params, options);
  }

  async untag(params: { token: string; tags: string[] }, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/subscribers/untag", params, options);
  }

  async delete(token: string, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "DELETE", `/subscribers/${encodeURIComponent(token)}`, undefined, options);
  }
}
