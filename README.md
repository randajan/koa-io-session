# @randajan/koa-io-session

[![NPM](https://img.shields.io/npm/v/@randajan/koa-io-session.svg)](https://www.npmjs.com/package/@randajan/koa-io-session) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

Simple bridge between `koa-session` and `socket.io`. Shares a unified session across HTTP and WebSocket using a session store.

---

## Install

```bash
npm i @randajan/koa-io-session
```

---

## Quick use

```js
import Koa from "koa";
import http from "http";
import { Server } from "socket.io";
import { attachSession } from "@randajan/koa-io-session";

const app = new Koa();
const server = http.createServer(app.callback());
const io = new Server(server);

const store = attachSession(app, io, {
  key: "koa:sess",
  signed: true,
  maxAge: 86400000
});

io.on("connection", socket => {
  console.log("session ID:", socket.sessionId);
  console.log("session data:", socket.session);
});
```

---

## Socket helpers

- `socket.sessionId` → session ID from cookies
- `socket.session` → session object from store

---

## Production notes

- **Stable signing keys**: Provide your own `app.keys` and a fixed `opt.key` (cookie name).
  Using randomly generated values on every server restart will invalidate existing signed cookies and force users to log in again.
- **Persistent stores for production**: The bundled in‑memory store works only for local development because all sessions disappear when the process restarts.
  Configure a persistent store such as Redis, DynamoDB, or SQL for real deployments.
- **Proxy deep‑mutation limitation**: The session proxy tracks changes only on top‑level properties.
  If you mutate nested objects you must either replace the whole object or use immutable updates so that changes are picked up and persisted.
- **Middleware order matters**: Call `attachSession` *before* any middleware (Router, authentication, etc.) that expects `ctx.session` to exist.



## License

MIT © [randajan](https://github.com/randajan)