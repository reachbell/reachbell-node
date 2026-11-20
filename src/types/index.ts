export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ReachBellOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
}

type Recipient = { externalId: string; token?: never } | { token: string; externalId?: never };

export type TransactionalPushParams = Recipient & {
  title?: string;
  body?: string;
  templateId?: string;
  variables?: Record<string, string>;
  url?: string;
  iconUrl?: string;
  imageUrl?: string;
  badge?: string;
};

export interface TransactionalPushResult {
  success?: boolean;
  delivered?: boolean;
  reason?: string;
  [key: string]: unknown;
}

export interface TransactionalEmailParams {
  to: string | string[];
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  preheaderText?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
  strict?: boolean;
  senderEmail?: string;
  senderName?: string;
  replyTo?: string;
}

type PhoneRecipient = { externalId: string; to?: never } | { to: string; externalId?: never };

export type TransactionalSmsParams = PhoneRecipient & {
  text?: string;
  templateId?: string;
  variables?: Record<string, unknown> | unknown[];
  dltTemplateId?: string;
};

export type TransactionalWhatsAppParams = PhoneRecipient & {
  template?: { name: string; params?: string[] };
  templateId?: string;
  variables?: Record<string, unknown> | unknown[];
  text?: string;
  language?: string;
};

export interface EventParams {
  name: string;
  externalId?: string;
  subscriberId?: string;
  properties?: Record<string, unknown>;
}

export interface EmailContactParams {
  email: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
  language?: string;
  country?: string;
  ip?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface CampaignContent {
  title: string;
  body: string;
  clickUrl?: string;
  iconUrl?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface CampaignSegment {
  tags?: string[];
  [key: string]: unknown;
}

export interface CampaignParams {
  name: string;
  content: CampaignContent;
  channel?: string;
  segment?: CampaignSegment;
  channelOverrides?: Record<string, unknown>;
  scheduledAt?: string | Date;
}

export type ApiResult = Record<string, unknown>;
