import { info } from "@randajan/simple-lib/node";
import Koa from "koa";
import { createServer as createHttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { attachSession } from "../../../src/index.js";


const port = info.port + 1;

const app = new Koa();
const http = createHttpServer(app.callback());
const io = new SocketServer(http, {
    cors: {
        origin: (_origin, callback) => callback(null, true),
        credentials: true,
        methods: ["GET", "POST"]
    }
});

const store = attachSession(app, io, {
    key: "koa.io.demo.sid",
    signed: true,
    maxAge: 1000 * 10,
    sameSite: "lax",
    secure: false,
    httpOnly: true
});

store.autoCleanup();


const readSession = (session = {}) => ({
    user: session.user ?? "guest",
    createdAt: session.createdAt ?? null,
    httpCount: session.httpCount ?? 0,
    wsCount: session.wsCount ?? 0
});

const ensureSessionShape = (session) => {
    if (!session.createdAt) { session.createdAt = Date.now(); }
    if (!session.user) { session.user = "guest"; }
    if (!Number.isFinite(session.httpCount)) { session.httpCount = 0; }
    if (!Number.isFinite(session.wsCount)) { session.wsCount = 0; }
};

const formatWsError = (source, error) => ({
    ok: false,
    from: source,
    error: error?.message || String(error)
});

const withWsSession = async (socket, source, effect) => {
    try {
        return await socket.withSession(async (sessionCtx) => {
            if (effect) {
                return effect(sessionCtx);
            }

            ensureSessionShape(sessionCtx.session);
            return {
                ok: true,
                from: source,
                clientId: socket.clientId ?? null,
                sessionId: sessionCtx.sessionId,
                session: readSession(sessionCtx.session)
            };
        });
    } catch (error) {
        return formatWsError(source, error);
    }
};


app.use(async (ctx, next) => {
    const origin = ctx.get("Origin");
    if (origin) {
        ctx.set("Access-Control-Allow-Origin", origin);
        ctx.set("Vary", "Origin");
    }
    ctx.set("Access-Control-Allow-Credentials", "true");
    ctx.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    ctx.set("Access-Control-Allow-Headers", "Content-Type");

    if (ctx.method === "OPTIONS") {
        ctx.status = 204;
        return;
    }

    await next();
});

app.use(async (ctx, next) => {
    if (ctx.path !== "/api/session") { return next(); }

    const action = String(ctx.query.action || "read");
    const name = String(ctx.query.name || "guest").trim().slice(0, 32) || "guest";

    if (action === "reset") {
        ctx.session = null;
        ctx.body = { ok: true, from: "http:reset" };
        return;
    }

    ensureSessionShape(ctx.session);

    if (action === "http-inc") {
        ctx.session.httpCount += 1;
    } else if (action === "set-user") {
        ctx.session.user = name;
    }

    ctx.body = {
        ok: true,
        from: `http:${action}`,
        clientId: ctx.clientId ?? null,
        sessionId: ctx.sessionId,
        session: readSession(ctx.session)
    };
});

app.use((ctx) => {
    ctx.status = 404;
    ctx.body = { ok: false, error: "Not found" };
});


io.on("connection", (socket) => {
    withWsSession(socket, "ws:connect").then((payload) => {
        socket.emit("session:state", payload);
    });

    socket.on("session:get", async (ack) => {
        const payload = await withWsSession(socket, "ws:get");
        if (typeof ack === "function") { ack(payload); }
    });

    socket.on("session:inc", async (ack) => {
        const payload = await withWsSession(socket, "ws:inc", (sessionCtx) => {
            ensureSessionShape(sessionCtx.session);
            sessionCtx.session.wsCount += 1;
            return {
                ok: true,
                from: "ws:inc",
                clientId: socket.clientId ?? null,
                sessionId: sessionCtx.sessionId,
                session: readSession(sessionCtx.session)
            };
        });
        if (typeof ack === "function") { ack(payload); }
    });

    socket.on("session:set-user", async (nameValue, ack) => {
        const payload = await withWsSession(socket, "ws:set-user", (sessionCtx) => {
            ensureSessionShape(sessionCtx.session);
            sessionCtx.session.user = String(nameValue || "guest").trim().slice(0, 32) || "guest";
            return {
                ok: true,
                from: "ws:set-user",
                clientId: socket.clientId ?? null,
                sessionId: sessionCtx.sessionId,
                session: readSession(sessionCtx.session)
            };
        });
        if (typeof ack === "function") { ack(payload); }
    });

    socket.on("session:reset", async (ack) => {
        const payload = await withWsSession(socket, "ws:reset", (sessionCtx) => {
            sessionCtx.session = null;
            return {
                ok: true,
                from: "ws:reset",
                clientId: socket.clientId ?? null,
                sessionId: sessionCtx.sessionId
            };
        });
        if (typeof ack === "function") { ack(payload); }
    });
});

http.listen(port, () => {
    console.log(`demo server listening at http://localhost:${port}`);
    console.log("demo CORS mode: reflect request origin");
});
