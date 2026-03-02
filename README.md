# @randajan/koa-io-session

[![NPM](https://img.shields.io/npm/v/@randajan/koa-io-session.svg)](https://www.npmjs.com/package/@randajan/koa-io-session) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Bridge between `koa-session` and `socket.io` with one shared session store.

You get:
- standard `ctx.session` for HTTP
- `ctx.clientId` / `socket.clientId` even before session exists
- `socket.sessionId` and `socket.withSession(...)` for WebSocket
- a clear destroy flow for stale sockets

---

## Install

```bash
npm i @randajan/koa-io-session
```

---

## Use case

Typical scenario:
1. User signs in via HTTP (`ctx.session.userId = ...`).
2. Client opens Socket.IO connection.
3. Socket handlers read/update the same session as HTTP handlers.
4. Session reset/logout invalidates related sockets.

This is useful for realtime apps where HTTP and WS must stay consistent without duplicate auth/session logic.
It also helps during first visit when `sessionId` is still missing, because `clientId` already exists.

---

## Quick start

```js
import Koa from "koa";
import { createServer } from "http";
import { Server } from "socket.io";
import { attachSession } from "@randajan/koa-io-session";

const app = new Koa();
const http = createServer(app.callback());
const io = new Server(http, {
  cors: { origin: true, credentials: true }
});

const store = attachSession(app, io, {
  key: "koa.io.sid",
  signed: true,
  maxAge: 24 * 60 * 60 * 1000,
  sameSite: "lax",
  httpOnly: true
});

// Required: cleanup is manual
store.autoCleanup();

// HTTP route example
app.use(async (ctx, next) => {
  if (ctx.path !== "/api/session") { return next(); }

  const action = String(ctx.query.action || "read");
  if (action === "reset") {
    ctx.session = null;
    ctx.body = { ok: true, from: "http:reset" };
    return;
  }

  if (!ctx.session.createdAt) { ctx.session.createdAt = Date.now(); }
  if (!Number.isFinite(ctx.session.httpCount)) { ctx.session.httpCount = 0; }
  if (action === "inc") { ctx.session.httpCount += 1; }

  ctx.body = {
    ok: true,
    from: `http:${action}`,
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
        ack({ ok: false, from: "ws:get", error: error.message });
      }
    }
  });
});

http.listen(3000);
```

---

## Socket API

After `attachSession(app, io, opt)`:

1. `socket.sessionId`
- Session ID resolved from cookie/external key during socket middleware.

2. `socket.clientId`
- Client identifier from dedicated cookie.
- Available for HTTP (`ctx.clientId`) and WS (`socket.clientId`) even if session is not created yet.

3. `socket.withSession(handler)`
- Safe wrapper for session operations with per-session lock.
- `handler` receives `sessionCtx`:
  - `sessionCtx.sessionId` -> session ID
  - `sessionCtx.session` -> mutable session object
  - `sessionCtx.socket` -> socket instance
- Return value of `handler` is returned by `withSession`.

Example:

```js
const result = await socket.withSession(async (sessionCtx) => {
  sessionCtx.session.wsCount = (sessionCtx.session.wsCount || 0) + 1;
  return { ok: true, sid: sessionCtx.sessionId };
});
```

Destroy session from WS:

```js
await socket.withSession(async (sessionCtx) => {
  sessionCtx.session = null;
});
```

---

## Session model behavior

1. WS does not create missing sessions.
- If session is missing in store, `withSession` throws `Session not found`.
- New session must be created via HTTP/Koa flow.

2. Change detection:
- If session changed, store `set` is called.
- If session did not change, throttled `touch` is used to refresh TTL.

3. Concurrency:
- Operations for same `sessionId` are serialized to avoid race conditions.

---

## Destroy flow

When store emits `destroy` for a SID:
1. all sockets in room `sessionId:<sid>` receive `session:destroy`
2. after ~200 ms, these sockets are forcibly disconnected

Client should react to `session:destroy` by:
1. performing HTTP bootstrap request (to get new cookie/session)
2. reconnecting socket

---

## Reserved names and limitations

1. Room naming:
- library joins sockets into rooms:
- `sessionId:<sid>`
- `clientId:<cid>`

2. Reserved socket event:
- library emits `session:destroy`

3. Reserved socket properties:
- library defines `socket.clientId`, `socket.sessionId` and `socket.withSession`

4. WS cannot bootstrap missing session:
- when session is missing in store, `withSession` throws `Session not found`
- new session must be created via HTTP/Koa flow

5. Session ID is fixed for current connection:
- if cookie/session changes, existing socket must reconnect to use new SID

6. `clientId` is routing-only metadata:
- it is useful for grouping sockets before session bootstrap
- do not use it as authentication or authorization identifier

---

## Required integration details

1. Cleanup is manual:
- call `store.autoCleanup(interval)` yourself

2. Custom store API is required:
- `get(sid)`
- `set(sid, session, maxAge)`
- `destroy(sid)`
- `touch(sid, maxAge)`
- `on(eventName, callback)`

3. Store must emit destroy event:
- event name: `destroy`
- callback signature expected by this library: `(_store, sid) => {}`

4. Destroy socket behavior:
- library emits `session:destroy`
- library disconnects socket room ~200 ms later

---

## Options

`attachSession(app, io, opt)` forwards session options to `koa-session`.

Defaults set by this library when missing:
- `opt.signed = true`
- `opt.key = generateUid(12)`
- `opt.maxAge = 86_400_000`
- `app.keys` auto-generated if missing

Optional:
- `opt.store` custom store implementing required API above
- `opt.externalKey` works as in `koa-session`
- `opt.ioSession.clientIdKey` overrides client id cookie key (`${opt.key}.cid` by default)
- `opt.ioSession.clientIdMaxAge` overrides client id cookie maxAge (default 1 year)

---

## Exports

```js
import attachSession, { attachSession, SessionStore, generateUid } from "@randajan/koa-io-session";
```

---

## Production checklist

1. Set stable `app.keys` and fixed cookie `opt.key`.
2. Use persistent store (Redis/DB), not in-memory store.
3. Call `store.autoCleanup(...)`.
4. Handle `session:destroy` on client and reconnect via HTTP bootstrap.

---

## License

MIT (c) [randajan](https://github.com/randajan)
