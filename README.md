# @reachbell/node

Server SDK for [ReachBell](https://reachbell.com). Send transactional push, email, SMS and WhatsApp, track events, manage subscribers and email contacts, and send campaigns from your Node.js backend.

Requires Node 18 or later. No runtime dependencies.

```bash
npm install @reachbell/node
```

```ts
import { ReachBell } from "@reachbell/node";

const rb = new ReachBell({ apiKey: process.env.REACHBELL_SECRET_KEY! });

const result = await rb.transactional.send({
  externalId: "user_42",
  title: "Order shipped",
  body: "Your order arrives tomorrow.",
  url: "https://shop.example/orders/4821",
});

if (!result.delivered) console.log("user has no active push subscription");
```

Use the secret key (`rb_secret_…`) from **Settings → API keys** and keep it on your server.

| Method | Endpoint |
|---|---|
| `transactional.send(params)` | `POST /transactional/send` |
| `transactional.email(params)` | `POST /transactional/email` |
| `transactional.sms(params)` | `POST /transactional/sms` |
| `transactional.whatsapp(params)` | `POST /transactional/whatsapp` |
| `events.track(event)` | `POST /events` |
| `events.trackBatch(events)` | `POST /events` (sent in chunks of 25) |
| `subscribers.identify({ token, externalId })` | `POST /subscribers/identify` |
| `subscribers.tag({ token, tags })` | `POST /subscribers/tag` |
| `subscribers.untag({ token, tags })` | `POST /subscribers/untag` |
| `subscribers.delete(token)` | `DELETE /subscribers/:token` |
| `contacts.upsertEmail(contact)` | `POST /contacts/email` |
| `contacts.unsubscribeEmail(email)` | `POST /contacts/email/unsubscribe` |
| `campaigns.send(campaign)` | `POST /campaigns/server` |
| `request(method, path, body?, options?)` | any endpoint |

Failed requests throw `ReachBellError` with `status` (`0` for network errors and timeouts) and the parsed response `body`.

Options: `apiKey` (required), `baseUrl` (defaults to `REACHBELL_API_URL` or `https://api.reachbell.com`), `timeoutMs` (default 15000), `fetch`, `headers`.

Full documentation: https://docs.reachbell.com/server/node

## License

MIT
