# @randajan/koa-io-session

[![NPM](https://img.shields.io/npm/v/@randajan/koa-io-session.svg)](https://www.npmjs.com/package/@randajan/koa-io-session)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Bridge between `koa-session` and `socket.io` with one shared session flow.

## Why

This library keeps HTTP and WebSocket session work synchronized while preserving native `koa-session` behavior.

You get:
- standard `ctx.session` in HTTP
- `ctx.clientId` and `socket.clientId`
- `ctx.sessionId` and `socket.sessionId` resolved through bridge mapping
- `socket.ctx` (Koa context created from socket handshake request)
- `socket.withSession(handler, onMissing?)` helper
- bridge events: `sessionSet`, `sessionDestroy`, `cleanup`

## Architecture

Public API is `SessionBridge`.

Internally, bridge uses a private store layer for TTL/event consistency over your backend `store` (`LiveStore` / `FileStore` / custom).

## Install

```bash
npm i @randajan/koa-io-session
```

For persistent file store:

```bash
npm i @randajan/file-db
```

## Quick Start

```js
import Koa from "koa";
import { createServer } from "http";
import { Server } from "socket.io";
import bridgeSession from "@randajan/koa-io-session";

const app = new Koa();

// Keep keys stable in production (important for signed cookies after restart)
app.keys = ["your-stable-key-1", "your-stable-key-2"];

const http = createServer(app.callback());
const io = new Server(http, {
  cors: { origin: true, credentials: true }
});

const bridge = bridgeSession(app, io, {
  key: "app.sid",
  signed: true,
  maxAge: 1000 * 60 * 60 * 24,
  sameSite: "lax",
  httpOnly: true,
  secure: false
});

bridge.on("sessionSet", ({ clientId, sessionId, isNew, isInit }) => {
  console.log("sessionSet", { clientId, sessionId, isNew, isInit });
});

bridge.on("sessionDestroy", ({ clientId, sessionId }) => {
  console.log("sessionDestroy", { clientId, sessionId });
});

bridge.on("cleanup", (cleared) => {
  console.log("cleanup", cleared);
});

app.use(async (ctx, next) => {
  if (ctx.path !== "/api/session") { return next(); }

  if (ctx.query.reset === "1") {
    ctx.session = null;
    ctx.body = { ok: true, from: "http:reset" };
    return;
  }

  if (!ctx.session.createdAt) { ctx.session.createdAt = Date.now(); }
  if (!Number.isFinite(ctx.session.httpCount)) { ctx.session.httpCount = 0; }
  ctx.session.httpCount += 1;

  ctx.body = {
    ok: true,
    clientId: ctx.clientId,
    sessionId: ctx.sessionId,
    session: ctx.session
  };
});

io.on("connection", (socket) => {
  socket.on("session:get", async (ack) => {
    const payload = await socket.withSession((sessionCtx) => ({
      ok: true,
      sessionId: sessionCtx.sessionId,
      session: sessionCtx.session
    }), { ok: false, error: "missing-session" });

    if (typeof ack === "function") { ack(payload); }
  });
});

http.listen(3000);
```

## API

### `bridgeSession(app, io, opt)`

Creates and returns `SessionBridge`.

### `SessionBridge`

Extends Node.js `EventEmitter`.

Events:
- `sessionSet`: `{ clientId, sessionId, isNew, isInit }`
- `sessionDestroy`: `{ clientId, sessionId }`
- `cleanup`: `clearedCount` (number of expired sessions removed)

`sessionSet` flags:
- `isNew`: backend store reported creation of a new persisted session record (`sid` had no previous state)
- `isInit`: bridge just initialized/attached mapping in current process lifecycle (`clientId <-> sessionId`)
- typical combinations:
- `isNew: true`, `isInit: true` -> newly created session was attached now
- `isNew: false`, `isInit: true` -> existing session was attached now (for example after process restart)
- `isNew: false`, `isInit: false` -> already attached session was updated

Runtime additions:
- HTTP context: `ctx.clientId`, `ctx.sessionId`
- socket: `socket.ctx`, `socket.clientId`, `socket.sessionId`, `socket.withSession(handler, onMissing?)`
- `socket.ctx` is created during socket initialization from handshake request/response

Methods:
- `getSessionId(clientId): string | undefined`
- `getClientId(sessionId): string | undefined`
- `getById(sessionId): Promise<object | undefined>`
- `getByClientId(clientId): Promise<object | undefined>`
- `destroyById(sessionId): Promise<boolean>`
- `destroyByClientId(clientId): Promise<boolean>`
- `setById(sessionId, session, maxAge?): Promise<boolean>` (cannot create missing session)
- `setByClientId(clientId, session, maxAge?): Promise<boolean>` (cannot create missing session)
- `cleanup(): Promise<number>`
- `startAutoCleanup(interval?): boolean`
- `stopAutoCleanup(): boolean`
- `notifyStoreSet(sessionId, isNew?): void`
- `notifyStoreDestroy(sessionId): void`
- `notifyStoreCleanup(clearedCount): void`

Missing policy:
- `getBy*` on missing mapping: returns `undefined`
- `destroyBy*` on missing mapping: returns `false`
- `setBy*` on missing mapping: throws `Error` (creating via this path is prohibited)

### `socket.withSession(handler, onMissing?)`

`handler` receives:
- `sessionCtx.sessionId`
- `sessionCtx.session`
- `sessionCtx.socket`

Rules:
- default `onMissing` is error (`Session is missing for this socket`)
- if `sessionCtx.session = null`, session is destroyed
- if session changed, store `set` is called
- same-session calls are serialized by `sessionId`

`onMissing` behavior:
- `Error` -> throw
- `function` -> call and return its value
- any other value -> return as fallback

## Options

`opt` is mostly forwarded to `koa-session`, with bridge-specific keys:

- `appKeys` (optional array used to initialize `app.keys`)
- `allowRndAppKeys` (default `false`; suppress runtime warning when keys are generated)
- `store` (backend store implementation)
- `maxAge` (session TTL used by StoreGateway and koa cookie)
- `autoCleanup` (default `false`)
- `autoCleanupMs` (used only when `autoCleanup === true`)
- `clientKey` (default `"cid"`)
- `clientMaxAge` (default `1 year`)
- `clientAlwaysRoll` (default `true`)

Default behavior:
- `key`: `"sid"` when missing
- `signed`: `true`
- `store`: `new LiveStore()`
- `app.keys`: if missing, bridge generates 2 runtime keys (length 32) and logs warning
- `autoCleanupMs`: when omitted and `autoCleanup` is enabled, interval is computed as `maxAge / 4`, clamped to `<1 minute, 1 day>`

`app.keys` resolution:
- if `app.keys` already exists and `appKeys` is not provided: existing `app.keys` is used
- if `app.keys` already exists and `appKeys` is provided: throws error
- if `app.keys` is missing and `appKeys` is provided: `app.keys = appKeys`
- if both are missing: bridge generates runtime keys; warning is shown unless `allowRndAppKeys === true`

## Store Contract

Backend `store` must implement:
- `get(sid)` -> returns stored state or `undefined`
- `set(sid, state)` -> returns boolean (or truthy)
- `destroy(sid)` -> returns boolean

Optional:
- `list()` -> required for cleanup features
- `optimize(clearedCount)` -> called after cleanup if present

Stored state format expected by gateway:
- `{ session, expiresAt, ttl }` where `session` is JSON string (serialized session object)

Both sync and async store methods are supported.

## Consistency Rule (Important)

After bridge initialization, direct mutation of `opt.store` is unsupported by default.

Why:
- it bypasses gateway/bridge consistency flow
- it can break `clientId <-> sessionId` synchronization
- it can cause missing or misleading bridge events

Use `SessionBridge` methods (`setBy*`, `destroyBy*`, `cleanup`) for controlled mutations.

Advanced bypass (you take full responsibility):
- if you intentionally mutate backend store directly, call matching notify method right after each mutation:
- `notifyStoreSet(sessionId, isNew?)`
- `notifyStoreDestroy(sessionId)`
- `notifyStoreCleanup(clearedCount)`

## Built-in Stores

### `LiveStore`

In-memory backend store.

```js
import bridgeSession, { LiveStore } from "@randajan/koa-io-session";

const bridge = bridgeSession(app, io, {
  store: new LiveStore()
});
```

### `FileStore` (persistent, `@randajan/file-db`)

```js
import { FileStore } from "@randajan/koa-io-session/fdb";

const bridge = bridgeSession(app, io, {
  store: new FileStore({ fileName: "sessions" })
});
```

## Behavior and Limitations

1. Session creation is HTTP-first.
- WebSocket path does not create missing sessions by itself.

2. Mapping (`clientId <-> sessionId`) is in-memory.
- After process restart, mapping is rebuilt from incoming cookies and existing store state.

3. Signed cookies depend on stable `app.keys`.
- Changing keys invalidates previous signed cookies.

4. WS change detection uses `JSON.stringify`.
- Non-serializable/cyclic payloads are not recommended in session data.

## Exports

Main entry:

```js
import bridgeSession, {
  bridgeSession,
  SessionBridge,
  LiveStore,
  generateUid
} from "@randajan/koa-io-session";
```

Persistent file store entry:

```js
import { FileStore } from "@randajan/koa-io-session/fdb";
```

## License

MIT (c) [randajan](https://github.com/randajan)
