import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, EmailContactParams, RequestOptions } from "../types";
import { compact } from "../utils";

export class Contacts {
  constructor(private readonly config: HttpConfig) {}

  async upsertEmail(params: EmailContactParams, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/contacts/email", compact(params), options);
  }

  async unsubscribeEmail(email: string, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/contacts/email/unsubscribe", { email }, options);
  }
}
