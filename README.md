# @randajan/koa-io-session

[![NPM](https://img.shields.io/npm/v/@randajan/koa-io-session.svg)](https://www.npmjs.com/package/@randajan/koa-io-session)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Bridge between `koa-session` and `socket.io` with one shared session store.

## Why this library

It keeps HTTP and WebSocket session handling in sync while staying close to native `koa-session` behavior.

You get:
- standard `ctx.session` in HTTP handlers
- `ctx.clientId` and `socket.clientId` for early client tracking
- `ctx.sessionId` and `socket.sessionId` resolved by bridge mapping
- `socket.withSession(handler, onMissing?)` for strict or optional WS session handling
- bridge-level events `sessionStart` and `sessionEnd`

## Install

```bash
npm i @randajan/koa-io-session
```

## Quick start

```js
import Koa from "koa";
import { createServer } from "http";
import { Server } from "socket.io";
import bridgeSession from "@randajan/koa-io-session";

const app = new Koa();
const http = createServer(app.callback());
const io = new Server(http, {
  cors: { origin: true, credentials: true }
});

const bridge = bridgeSession(app, io, {
  key: "app.sid",
  signed: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: "lax",
  httpOnly: true,
  secure: false
});

bridge.on("sessionStart", ({ clientId, sessionId }) => {
  console.log("sessionStart", clientId, sessionId);
});

bridge.on("sessionEnd", ({ clientId, sessionId }) => {
  console.log("sessionEnd", clientId, sessionId);
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
    from: "http",
    clientId: ctx.clientId,
    sessionId: ctx.sessionId,
    session: ctx.session
  };
});

io.on("connection", (socket) => {
  socket.on("session:get", async (ack) => {
    try {
      const payload = await socket.withSession(async (sessionCtx) => {
        return {
          ok: true,
          from: "ws:get",
          clientId: socket.clientId,
          sessionId: sessionCtx.sessionId,
          session: sessionCtx.session
        };
      });
      if (typeof ack === "function") { ack(payload); }
    } catch (error) {
      if (typeof ack === "function") {
        ack({ ok: false, error: error.message });
      }
    }
  });
});

http.listen(3000);
```

## API

### `bridgeSession(app, io, opt)`

Creates and returns `SessionBridge`.

Default export is `bridgeSession`.

### `SessionBridge`

`SessionBridge` extends Node.js `EventEmitter`.

Properties:
- `bridge.store` is the active store instance

Events:
- `sessionStart` payload: `{ clientId, sessionId }`
- `sessionEnd` payload: `{ clientId, sessionId }`

Runtime additions:
- HTTP context: `ctx.clientId`, `ctx.sessionId`
- Socket: `socket.clientId`, `socket.sessionId`, `socket.withSession(handler, onMissing?)`

### `socket.withSession(handler, onMissing?)`

`handler` receives one object:
- `sessionCtx.sessionId`
- `sessionCtx.session`
- `sessionCtx.socket`

Rules:
- default behavior (`onMissing` not provided): throws `Error("Session missing")`
- missing session means `socket.sessionId` is missing
- missing session means store does not have session for current sid
- if `sessionCtx.session = null`, session is destroyed
- if session changed, store `set` is called
- calls for same `sessionId` are serialized

`onMissing` behavior:
- if `onMissing` is an `Error`, it is thrown
- if `onMissing` is a function, its return value is used
- otherwise, `onMissing` value is returned as-is

Examples:
- strict (default): `await socket.withSession(handler)`
- silent undefined on missing: `await socket.withSession(handler, undefined)`
- custom fallback value: `await socket.withSession(handler, { ok: false })`
- custom fallback callback: `await socket.withSession(handler, () => ({ ok: false }))`

## Options

`opt` is mostly forwarded to `koa-session`, except internal bridge keys:

- `store`
- `autoCleanup`
- `autoCleanupMs`
- `clientKey`
- `clientMaxAge`
- `clientAlwaysRoll`

Defaults:
- `key`: random `generateUid(12)`
- `maxAge`: `30 days`
- `signed`: `true`
- `store`: `new SessionStore(opt)`
- `clientKey`: `${key}.cid`
- `clientMaxAge`: `1 year`
- `clientAlwaysRoll`: `true`
- `app.keys`: auto-generated if missing

Notes:
- set stable `app.keys` in production
- keep cookie settings consistent with your deployment (`sameSite`, `secure`, domain/path)

## `SessionStore`

Default in-memory store with TTL.

Constructor:
- `new SessionStore({ maxAge, autoCleanup, autoCleanupMs })`

Methods:
- `get(sid)`
- `set(sid, session, maxAge?)`
- `destroy(sid)` (also used by `delete`)
- `cleanup()`
- `on(eventName, callback)`

Events emitted by store:
- `set`
- `destroy`
- `cleanup`

## Custom store contract

Custom store is valid if it implements:
- `get(sid)`
- `set(sid, session, maxAge?)`
- `destroy(sid)`
- `on(eventName, callback)`

Sync and async implementations are both supported.

Important integration rule:
- your store must emit `destroy` whenever a session is removed, otherwise bridge mapping can get stale

## Behavior and limitations

1. Session creation is HTTP-first.
- WebSocket handler does not create missing sessions.

2. Bridge mapping is in-memory.
- After process restart, mapping is rebuilt from incoming cookies plus store state.

3. Signed cookies depend on stable keys.
- If `app.keys` change, previously signed cookies become invalid.

4. Change detection in WS uses `JSON.stringify`.
- Non-serializable or cyclic data are not recommended in session payloads.

## Exports

```js
import bridgeSession, {
  bridgeSession,
  SessionBridge,
  SessionStore,
  generateUid
} from "@randajan/koa-io-session";
```

## License

MIT (c) [randajan](https://github.com/randajan)
