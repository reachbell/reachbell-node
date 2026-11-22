import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type { ApiResult, EmailContactParams, RequestOptions } from "../types";
import { compact } from "../utils";
import { requireObject, requireString } from "../helpers/validate";

export class Contacts {
  constructor(private readonly config: HttpConfig) {}

  async upsertEmail(params: EmailContactParams, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "contacts.upsertEmail");
    return send(this.config, "POST", "/contacts/email", compact(params), options);
  }

  async unsubscribeEmail(email: string, options?: RequestOptions): Promise<ApiResult> {
    requireString(email, "contacts.unsubscribeEmail", "email");
    return send(this.config, "POST", "/contacts/email/unsubscribe", { email }, options);
  }
}
