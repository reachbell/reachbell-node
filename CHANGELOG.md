# Changelog

## 1.1.0

### Errors

- Every resource method is `async`, so a failure never throws synchronously: it always rejects the returned promise.
- Invalid arguments reject with a `ReachBellError` (`status` `0`, `body` `null`) before anything is sent, with a message naming the method and argument, e.g. `ReachBell: campaigns.send expects params to be an object, got null`, `ReachBell: events.trackBatch expects events to be an array, got undefined`, `ReachBell: subscribers.delete expects token to be a non-empty string, got undefined`. In 1.0.0 these surfaced as a raw `TypeError` (or, for `subscribers.delete(undefined)`, a request to `/subscribers/undefined`).
- A request body that cannot be serialised (`BigInt`, circular references) rejects with `Could not serialise request body for <path>: …` (`status` `0`, original error as `cause`) instead of being reported as a network failure.
- Network failures keep the original fetch error as `error.cause`, and the message includes the underlying reason and code: `Request to /x failed: fetch failed (connect ECONNREFUSED 127.0.0.1:443)` instead of just `fetch failed`.
- A timeout or stream error while reading the response body is reported as a `ReachBellError` with `status` `0` (`Request to <path> timed out` / `Request to <path> failed: …`) instead of a raw `DOMException` / `TypeError`.
- A non-JSON error response (e.g. an HTML 502 page) produces a one-line message like `ReachBell returned 502: Bad Gateway…` (at most 200 characters of text) instead of the whole page; the raw text stays in `error.body`.
- Validation messages that contain objects are JSON-encoded in the message instead of printing `[object Object]`.
- `ReachBellError` accepts `{ cause }` as a fourth constructor argument.

### Batches

- `events.trackBatch()` also validates holes in sparse arrays (`[a, , b]`), rejecting with `events.trackBatch expects events[1] to be an object, got undefined` before anything is sent.
- `events.trackBatch()` rejects with the new `ReachBellBatchError` (a subclass of `ReachBellError`, exported from the package) when a chunk fails. It carries `results` (responses of the chunks already accepted), `sentCount` (events in those chunks, so you can retry with `events.slice(err.sentCount)`), `failedChunk`, and the failing chunk's `status`, `body` and `cause`. In 1.0.0 the results of earlier chunks were lost.

### Campaigns

- `campaigns.send()` accepts the message as top-level `title` and `body` strings as well as a `content` object, matching the API's `POST /campaigns/server` body. In 1.0.0 `content` was always required. Passing neither rejects with `campaigns.send expects params.content to be an object, or params.title and params.body to be non-empty strings; …`. `CampaignParams` is now a union of the two shapes.

### Headers

- Header names are merged case-insensitively and sent in lower case, so a header is never sent twice. Your `headers` (client or per-request) can now override `content-type` as well as `accept` and `user-agent`; `x-api-key` always comes from the configured `apiKey`, whatever casing a custom header uses.

### Options

- `timeoutMs` (client option and per-request option) must be a finite number of milliseconds greater than `0` and at most `2147483647` (about 24.8 days; `AbortSignal.timeout()` cannot take a longer delay). The constructor throws a `RangeError` for `0`, negative, too large, `NaN`, `Infinity` or non-numbers; an invalid per-request `timeoutMs` rejects with a `ReachBellError`. Fractional values are rounded up.
- A blank or whitespace `baseUrl` option or `REACHBELL_API_URL` counts as unset, and the default URL is used.
- `request()` with a path that already has a query string appends `options.query` with `&` rather than a second `?`.
- The SDK loads on runtimes without Node globals (edge runtimes, workers): `process.env` and `process.emitWarning` are only used when present, falling back to `console.warn` for the public-key warning.

## 1.0.0

First release: transactional push, email, SMS and WhatsApp, events with automatic batching, subscribers, email contacts, server campaigns, and `request()` for any other endpoint.
