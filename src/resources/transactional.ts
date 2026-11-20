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

export class Transactional {
  constructor(private readonly config: HttpConfig) {}

  send(params: TransactionalPushParams, options?: RequestOptions): Promise<TransactionalPushResult> {
    return send(this.config, "POST", "/transactional/send", compact(params), options);
  }

  email(params: TransactionalEmailParams, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/transactional/email", compact({ ...params }), options);
  }

  sms(params: TransactionalSmsParams, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/transactional/sms", compact(params), options);
  }

  whatsapp(params: TransactionalWhatsAppParams, options?: RequestOptions): Promise<ApiResult> {
    return send(this.config, "POST", "/transactional/whatsapp", compact(params), options);
  }
}
