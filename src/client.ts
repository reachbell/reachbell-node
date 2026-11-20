import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS, PUBLIC_KEY_PREFIX } from "./constants";
import type { HttpConfig } from "./helpers/http";
import { send } from "./helpers/http";
import { Campaigns } from "./resources/campaigns";
import { Contacts } from "./resources/contacts";
import { Events } from "./resources/events";
import { Subscribers } from "./resources/subscribers";
import { Transactional } from "./resources/transactional";
import type { HttpMethod, ReachBellOptions, RequestOptions } from "./types";
import { trimSlash } from "./utils";

export class ReachBell {
  readonly transactional: Transactional;
  readonly events: Events;
  readonly subscribers: Subscribers;
  readonly contacts: Contacts;
  readonly campaigns: Campaigns;
  private readonly config: HttpConfig;

  constructor(options: ReachBellOptions) {
    const apiKey = options?.apiKey?.trim();
    if (!apiKey) throw new TypeError("ReachBell: apiKey is required");
    if (apiKey.startsWith(PUBLIC_KEY_PREFIX)) {
      process.emitWarning(
        "ReachBell: you passed a public key (rb_live_). Sending, events, contacts and campaigns need the secret key (rb_secret_).",
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") throw new TypeError("ReachBell: fetch is not available; use Node 18+ or pass options.fetch");

    this.config = {
      apiKey,
      baseUrl: trimSlash(options.baseUrl ?? process.env.REACHBELL_API_URL ?? DEFAULT_BASE_URL),
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetch: fetchImpl.bind(globalThis),
      headers: options.headers ?? {},
    };
    this.transactional = new Transactional(this.config);
    this.events = new Events(this.config);
    this.subscribers = new Subscribers(this.config);
    this.contacts = new Contacts(this.config);
    this.campaigns = new Campaigns(this.config);
  }

  request<T = unknown>(method: HttpMethod, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return send<T>(this.config, method, path, body, options);
  }
}
