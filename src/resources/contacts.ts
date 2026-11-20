import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, EmailContactParams, RequestOptions } from "../types";
import { compact } from "../utils";

export class Contacts {
  constructor(private readonly config: HttpConfig) {}

  upsertEmail(params: EmailContactParams, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/contacts/email", compact(params), options);
  }

  unsubscribeEmail(email: string, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/contacts/email/unsubscribe", { email }, options);
  }
}
