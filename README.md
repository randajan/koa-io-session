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

attachSession(app, io, {
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

## License

MIT © [randajan](https://github.com/randajan)