import { describe, expect, it, vi } from "vitest";
import { ReachBell, ReachBellError } from "../src";

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
});
