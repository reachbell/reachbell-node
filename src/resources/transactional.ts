import type { HttpConfig } from "../helpers/http";
import { send } from "../helpers/http";
import type {
  ApiResult,
  RequestOptions,
  TransactionalEmailParams,
  TransactionalPushParams,
  TransactionalPushResult,
  TransactionalSmsParams,
  TransactionalWhatsAppParams,
} from "../types";
import { compact } from "../utils";
import { requireObject } from "../helpers/validate";

export class Transactional {
  constructor(private readonly config: HttpConfig) {}

  async send(params: TransactionalPushParams, options?: RequestOptions): Promise<TransactionalPushResult> {
    requireObject(params, "transactional.send");
    return send(this.config, "POST", "/transactional/send", compact(params), options);
  }

  async email(params: TransactionalEmailParams, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "transactional.email");
    return send(this.config, "POST", "/transactional/email", compact({ ...params }), options);
  }

  async sms(params: TransactionalSmsParams, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "transactional.sms");
    return send(this.config, "POST", "/transactional/sms", compact(params), options);
  }

  async whatsapp(params: TransactionalWhatsAppParams, options?: RequestOptions): Promise<ApiResult> {
    requireObject(params, "transactional.whatsapp");
    return send(this.config, "POST", "/transactional/whatsapp", compact(params), options);
  }
}
