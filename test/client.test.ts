import { afterEach, describe, expect, it, vi } from "vitest";
import { ReachBell, ReachBellBatchError, ReachBellError } from "../src";

type Call = { url: string; init: RequestInit };

function mockFetch(status = 200, payload: unknown = { success: true }) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    const text = typeof payload === "string" ? payload : JSON.stringify(payload);
    return new Response(text, { status });
  });
  return { fn, calls };
}

function client(fetch: ReturnType<typeof mockFetch>["fn"]) {
  return new ReachBell({ apiKey: "rb_secret_test", baseUrl: "https://api.test/", fetch });
}

const json = (c: Call) => JSON.parse(String(c.init.body));
const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name];

describe("ReachBell", () => {
  it("requires an api key", () => {
    expect(() => new ReachBell({ apiKey: "" })).toThrow(TypeError);
  });

  it("sends transactional push with auth headers and drops empty fields", async () => {
    const m = mockFetch(200, { success: true, delivered: true });
    const r = await client(m.fn).transactional.send({ externalId: "u1", title: "Hi", body: "There", url: undefined });
    expect(r.delivered).toBe(true);
    const c = m.calls[0];
    expect(c.url).toBe("https://api.test/transactional/send");
    expect(c.init.method).toBe("POST");
    expect(header(c, "x-api-key")).toBe("rb_secret_test");
    expect(header(c, "content-type")).toBe("application/json");
    expect(header(c, "user-agent")).toMatch(/^reachbell-node\//);
    expect(json(c)).toEqual({ externalId: "u1", title: "Hi", body: "There" });
  });

  it("routes email, sms and whatsapp", async () => {
    const m = mockFetch();
    const rb = client(m.fn);
    await rb.transactional.email({ to: "a@b.co", subject: "S", htmlContent: "<p>x</p>" });
    await rb.transactional.sms({ externalId: "u1", text: "code 1" });
    await rb.transactional.whatsapp({ to: "+15550100", template: { name: "otp", params: ["1"] } });
    expect(m.calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/transactional/email",
      "/transactional/sms",
      "/transactional/whatsapp",
    ]);
    expect(json(m.calls[2])).toEqual({ to: "+15550100", template: { name: "otp", params: ["1"] } });
  });

  it("splits event batches into chunks of 25", async () => {
    const m = mockFetch(200, { accepted: 25 });
    const events = Array.from({ length: 60 }, (_, i) => ({ name: "e", externalId: `u${i}` }));
    const results = await client(m.fn).events.trackBatch(events);
    expect(results).toHaveLength(3);
    expect(m.calls.map((c) => json(c).events.length)).toEqual([25, 25, 10]);
  });

  it("tracks a single event", async () => {
    const m = mockFetch();
    await client(m.fn).events.track({ name: "order_paid", externalId: "u1", properties: { amount: 10 } });
    expect(json(m.calls[0])).toEqual({ name: "order_paid", externalId: "u1", properties: { amount: 10 } });
  });

  it("manages subscribers and contacts", async () => {
    const m = mockFetch();
    const rb = client(m.fn);
    await rb.subscribers.identify({ token: "t/1", externalId: "u1" });
    await rb.subscribers.tag({ token: "t/1", tags: ["vip"] });
    await rb.subscribers.untag({ token: "t/1", tags: ["vip"] });
    await rb.subscribers.delete("t/1");
    await rb.contacts.upsertEmail({ email: "a@b.co", tags: ["news"] });
    await rb.contacts.unsubscribeEmail("a@b.co");
    expect(m.calls.map((c) => `${c.init.method} ${new URL(c.url).pathname}`)).toEqual([
      "POST /subscribers/identify",
      "POST /subscribers/tag",
      "POST /subscribers/untag",
      "DELETE /subscribers/t%2F1",
      "POST /contacts/email",
      "POST /contacts/email/unsubscribe",
    ]);
    expect(m.calls[3].init.body).toBeUndefined();
  });

  it("sends a server campaign with a tag segment", async () => {
    const m = mockFetch();
    await client(m.fn).campaigns.send({
      name: "Restock",
      content: { title: "Back", body: "In stock", clickUrl: "https://x.co/p" },
      segment: { tags: ["waitlist_1"] },
      scheduledAt: new Date("2026-12-01T10:00:00Z"),
    });
    expect(json(m.calls[0])).toEqual({
      name: "Restock",
      content: { title: "Back", body: "In stock", clickUrl: "https://x.co/p" },
      segment: { tags: ["waitlist_1"] },
      scheduledAt: "2026-12-01T10:00:00.000Z",
    });
  });

  it("sends a server campaign with top-level title and body", async () => {
    const m = mockFetch();
    await client(m.fn).campaigns.send({ name: "Restock", title: "Back", body: "In stock", channel: "push" });
    expect(json(m.calls[0])).toEqual({ name: "Restock", title: "Back", body: "In stock", channel: "push", segment: {} });
  });

  it("throws ReachBellError with status and body on non-2xx", async () => {
    const m = mockFetch(403, { statusCode: 403, message: "Plan does not include transactionalApi" });
    const err = await client(m.fn)
      .transactional.send({ externalId: "u", title: "t", body: "b" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReachBellError);
    expect((err as ReachBellError).status).toBe(403);
    expect((err as ReachBellError).message).toBe("Plan does not include transactionalApi");
    expect((err as ReachBellError).body).toEqual({ statusCode: 403, message: "Plan does not include transactionalApi" });
  });

  it("joins validation message arrays", async () => {
    const m = mockFetch(400, { message: ["title must be a string", "body must be a string"] });
    const err = (await client(m.fn).request("POST", "/x", {}).catch((e: unknown) => e)) as ReachBellError;
    expect(err.message).toBe("title must be a string; body must be a string");
  });

  it("reports network failures as status 0", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const rb = new ReachBell({ apiKey: "rb_secret_x", fetch });
    const err = (await rb.events.track({ name: "x" }).catch((e: unknown) => e)) as ReachBellError;
    expect(err).toBeInstanceOf(ReachBellError);
    expect(err.status).toBe(0);
  });

  it("reports timeouts as status 0", async () => {
    const fetch = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const rb = new ReachBell({ apiKey: "rb_secret_x", fetch, timeoutMs: 20 });
    const err = (await rb.events.track({ name: "x" }).catch((e: unknown) => e)) as ReachBellError;
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/timed out/);
  });

  it("reports a timeout while reading the body as status 0", async () => {
    const fetch = vi.fn(async () => {
      const response = new Response("{}", { status: 200 });
      vi.spyOn(response, "text").mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
      return response;
    });
    const rb = new ReachBell({ apiKey: "rb_secret_x", fetch });
    const err = (await rb.events.track({ name: "x" }).catch((e: unknown) => e)) as ReachBellError;
    expect(err).toBeInstanceOf(ReachBellError);
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/timed out/);
  });

  it("passes query strings through request()", async () => {
    const m = mockFetch(200, "");
    const r = await client(m.fn).request("GET", "/billing/plans", undefined, { query: { currency: "USD", skip: undefined } });
    expect(r).toBeNull();
    expect(m.calls[0].url).toBe("https://api.test/billing/plans?currency=USD");
    expect(header(m.calls[0], "content-type")).toBeUndefined();
  });

  it("warns when given a public key", () => {
    const spy = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
    new ReachBell({ apiKey: "rb_live_x", fetch: mockFetch().fn });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  describe("review fixes", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it("keeps the fetch error as cause and names the underlying reason", async () => {
      const reason = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:1"), { code: "ECONNREFUSED" });
      const original = new TypeError("fetch failed", { cause: reason });
      const fetch = vi.fn(async () => {
        throw original;
      });
      const err = (await new ReachBell({ apiKey: "rb_secret_x", fetch }).events.track({ name: "x" }).catch((e: unknown) => e)) as ReachBellError;
      expect(err.status).toBe(0);
      expect(err.cause).toBe(original);
      expect(err.message).toBe("Request to /events failed: fetch failed (connect ECONNREFUSED 127.0.0.1:1)");
    });

    it("adds the cause code when the cause message lacks it", async () => {
      const fetch = vi.fn(async () => {
        throw new TypeError("fetch failed", { cause: Object.assign(new Error("getaddrinfo failed"), { code: "ENOTFOUND" }) });
      });
      const err = (await new ReachBell({ apiKey: "rb_secret_x", fetch }).request("GET", "/x").catch((e: unknown) => e)) as ReachBellError;
      expect(err.message).toBe("Request to /x failed: fetch failed (ENOTFOUND: getaddrinfo failed)");
    });

    it("treats a blank REACHBELL_API_URL as unset", async () => {
      vi.stubEnv("REACHBELL_API_URL", "   ");
      const m = mockFetch();
      await new ReachBell({ apiKey: "rb_secret_x", fetch: m.fn }).request("GET", "/x");
      expect(m.calls[0].url).toBe("https://api.reachbell.com/x");
    });

    it("rejects instead of throwing synchronously on bad input", async () => {
      const rb = client(mockFetch().fn);
      const calls = [() => rb.campaigns.send({ name: "x" } as never), () => rb.transactional.send(null as never)];
      for (const call of calls) {
        let pending: Promise<unknown> | undefined;
        expect(() => {
          pending = call();
        }).not.toThrow();
        await expect(pending).rejects.toBeInstanceOf(ReachBellError);
      }
    });

    it("rejects invalid arguments with ReachBellError before sending", async () => {
      const m = mockFetch();
      const rb = client(m.fn);
      const cases: Array<[() => Promise<unknown>, RegExp]> = [
        [() => rb.campaigns.send(null as never), /^ReachBell: campaigns\.send expects params to be an object, got null$/],
        [() => rb.transactional.send(undefined as never), /transactional\.send expects params to be an object, got undefined/],
        [() => rb.transactional.email([] as never), /transactional\.email expects params to be an object, got an array/],
        [() => rb.transactional.sms(null as never), /transactional\.sms/],
        [() => rb.transactional.whatsapp(null as never), /transactional\.whatsapp/],
        [() => rb.events.track(null as never), /events\.track expects event to be an object, got null/],
        [() => rb.events.trackBatch(undefined as never), /events\.trackBatch expects events to be an array, got undefined/],
        [() => rb.events.trackBatch([{ name: "e", externalId: "u" }, null] as never), /events\.trackBatch expects events\[1\] to be an object, got null/],
        // eslint-disable-next-line no-sparse-arrays
        [() => rb.events.trackBatch([{ name: "e", externalId: "u" }, , { name: "e", externalId: "u" }] as never), /events\.trackBatch expects events\[1\] to be an object, got undefined/],
        [() => rb.campaigns.send({ name: "c" } as never), /campaigns\.send expects params\.content to be an object, or params\.title and params\.body to be non-empty strings; got content undefined, title undefined, body undefined/],
        [() => rb.campaigns.send({ name: "c", title: "t" } as never), /got content undefined, title a string, body undefined/],
        [() => rb.campaigns.send({ name: "c", content: "x" } as never), /campaigns\.send expects params\.content to be an object, got a string/],
        [() => rb.subscribers.identify(null as never), /subscribers\.identify/],
        [() => rb.subscribers.tag(undefined as never), /subscribers\.tag/],
        [() => rb.subscribers.untag(undefined as never), /subscribers\.untag/],
        [() => rb.subscribers.delete(undefined as never), /subscribers\.delete expects token to be a non-empty string, got undefined/],
        [() => rb.subscribers.delete("  "), /got an empty string/],
        [() => rb.contacts.upsertEmail(null as never), /contacts\.upsertEmail/],
        [() => rb.contacts.unsubscribeEmail(42 as never), /contacts\.unsubscribeEmail expects email to be a non-empty string, got number/],
        [() => rb.request("GET", undefined as never), /request expects path to be a string/],
      ];
      for (const [call, message] of cases) {
        const err = (await call().catch((e: unknown) => e)) as ReachBellError;
        expect(err).toBeInstanceOf(ReachBellError);
        expect(err).not.toBeInstanceOf(ReachBellBatchError);
        expect(err.status).toBe(0);
        expect(err.body).toBeNull();
        expect(err.message).toMatch(message);
      }
      expect(m.fn).not.toHaveBeenCalled();
    });

    it("validates timeoutMs", async () => {
      for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "15000" as never]) {
        expect(() => new ReachBell({ apiKey: "rb_secret_x", timeoutMs })).toThrow(/timeoutMs must be a finite number of milliseconds greater than 0/);
      }
      expect(() => new ReachBell({ apiKey: "rb_secret_x", timeoutMs: 0 })).toThrow(RangeError);
      expect(() => new ReachBell({ apiKey: "rb_secret_x", timeoutMs: 1.5, fetch: mockFetch().fn })).not.toThrow();

      const m = mockFetch();
      const err = (await client(m.fn).request("GET", "/x", undefined, { timeoutMs: -5 }).catch((e: unknown) => e)) as ReachBellError;
      expect(err).toBeInstanceOf(ReachBellError);
      expect(err.message).toMatch(/timeoutMs to be a finite number of milliseconds greater than 0 and at most 2147483647, got -5/);
      expect(m.fn).not.toHaveBeenCalled();
      // AbortSignal.timeout() only takes 32-bit delays: reject anything larger.
      for (const timeoutMs of [2_147_483_648, 2_147_483_647.5, Number.MAX_SAFE_INTEGER]) {
        expect(() => new ReachBell({ apiKey: "rb_secret_x", timeoutMs })).toThrow(RangeError);
        expect(() => new ReachBell({ apiKey: "rb_secret_x", timeoutMs })).toThrow(/at most 2147483647, got /);
        const tooBig = (await client(m.fn).request("GET", "/x", undefined, { timeoutMs }).catch((e: unknown) => e)) as ReachBellError;
        expect(tooBig).toBeInstanceOf(ReachBellError);
        expect(tooBig.status).toBe(0);
        expect(tooBig.message).toMatch(/expects timeoutMs to be .* at most 2147483647, got /);
      }
      expect(m.fn).not.toHaveBeenCalled();
      expect(() => new ReachBell({ apiKey: "rb_secret_x", timeoutMs: 2_147_483_647, fetch: m.fn })).not.toThrow();
      await client(m.fn).request("GET", "/x", undefined, { timeoutMs: 2_147_483_647 });
      expect(m.fn).toHaveBeenCalledOnce();
      m.fn.mockClear();
      await client(m.fn).request("GET", "/x", undefined, { timeoutMs: 2500 });
      expect(m.fn).toHaveBeenCalledOnce();
    });

    it("reports an unserialisable body as a serialisation error, not a network failure", async () => {
      const m = mockFetch();
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      for (const body of [{ n: 1n }, circular]) {
        const err = (await client(m.fn).request("POST", "/x", body).catch((e: unknown) => e)) as ReachBellError;
        expect(err).toBeInstanceOf(ReachBellError);
        expect(err.status).toBe(0);
        expect(err.message).toMatch(/^Could not serialise request body for \/x:/);
        expect(err.cause).toBeInstanceOf(TypeError);
      }
      expect(m.fn).not.toHaveBeenCalled();
    });

    it("loads and warns without Node globals", async () => {
      vi.stubGlobal("process", undefined);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const m = mockFetch();
      const rb = new ReachBell({ apiKey: "rb_live_x", fetch: m.fn });
      vi.unstubAllGlobals();
      await rb.request("GET", "/x");
      expect(m.calls[0].url).toBe("https://api.reachbell.com/x");
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    it("appends query params with & when the path already has a query", async () => {
      const m = mockFetch();
      await client(m.fn).request("GET", "/x?a=1", undefined, { query: { b: 2 } });
      expect(m.calls[0].url).toBe("https://api.test/x?a=1&b=2");
    });

    it("returns completed chunk results when a later chunk fails", async () => {
      let n = 0;
      const fetch = vi.fn(async () => {
        n += 1;
        return n === 3 ? new Response('{"message":"rate limited"}', { status: 429 }) : new Response(`{"accepted":${n}}`, { status: 200 });
      });
      const events = Array.from({ length: 80 }, (_, i) => ({ name: "e", externalId: `u${i}` }));
      const err = (await new ReachBell({ apiKey: "rb_secret_x", fetch }).events.trackBatch(events).catch((e: unknown) => e)) as ReachBellBatchError;
      expect(err).toBeInstanceOf(ReachBellBatchError);
      expect(err).toBeInstanceOf(ReachBellError);
      expect(err.results).toEqual([{ accepted: 1 }, { accepted: 2 }]);
      expect(err.sentCount).toBe(50);
      expect(err.failedChunk).toBe(2);
      expect(err.status).toBe(429);
      expect(err.cause).toBeInstanceOf(ReachBellError);
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("merges header names case-insensitively, caller over SDK defaults", async () => {
      const m = mockFetch();
      const rb = new ReachBell({ apiKey: "rb_secret_x", baseUrl: "https://api.test", fetch: m.fn, headers: { Accept: "text/plain" } });
      await rb.request("POST", "/x", { a: 1 }, { headers: { "Content-Type": "application/merge-patch+json", "X-API-KEY": "nope" } });
      const h = m.calls[0].init.headers as Record<string, string>;
      expect(h["content-type"]).toBe("application/merge-patch+json");
      expect(h.accept).toBe("text/plain");
      expect(h["x-api-key"]).toBe("rb_secret_x");
      expect(Object.keys(h).filter((k) => k.toLowerCase() === "content-type")).toHaveLength(1);
      expect(Object.keys(h).every((k) => k === k.toLowerCase())).toBe(true);
    });

    it("shortens a raw non-JSON error body in the message", async () => {
      const html = `<html><body><h1>502 Bad Gateway</h1>${"<p>nginx padding</p>".repeat(100)}</body></html>`;
      const err = (await client(mockFetch(502, html).fn).request("GET", "/x").catch((e: unknown) => e)) as ReachBellError;
      expect(err.message.startsWith("ReachBell returned 502: 502 Bad Gateway")).toBe(true);
      expect(err.message.length).toBeLessThan(260);
      expect(err.message).not.toContain("<");
      expect(err.body).toBe(html);
    });
  });
});
