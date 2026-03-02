// attachSession.js  – verze s auto-persist proxy
import { ServerResponse } from "http";
import { solid, virtual } from "@randajan/props";
import { generateUid } from "./tools.js";
import { SessionStore } from "./class/SessionStore.js";
import { createKoaSession } from "./koaSession.js";
import { applySessionHandler, clearTouchQueue } from "./socketSession.js";
import { createClientCookie } from "./clientCookie.js";




export const attachSession = (app, io, opt = {}) => {
    opt.signed = "signed" in opt ? !!opt.signed : true;

    if (!app.keys) { app.keys = Array(6).fill().map(() => generateUid(12)); }

    
    if (!opt.key) { opt.key = generateUid(12); }
    if (!opt.maxAge) { opt.maxAge = 86_400_000; }
    if (!opt.store) { opt.store = new SessionStore(opt.maxAge); }

    const { store } = opt;

    const cc = createClientCookie(opt);

    const [koaSession, sc] = createKoaSession(opt, app, (ctx, sid)=>{
        const clientId = cc.get(ctx);
        if (!clientId) { return; }
        const room = io.in(`clientId:${clientId}`);
        room.emit("session:start");
    });
    
    app.use(koaSession);

    // pro HTTP jen sessionId, nic víc nepotřebujeme
    app.use(async (ctx, next) => {
        const clientId = cc.get(ctx) || generateUid(24);
        cc.set(ctx, clientId);
        solid(ctx, "clientId", clientId);
        virtual(ctx, "sessionId", _=>sc.get(ctx));
        await next();
    });

    /* ------------------  WebSocket  ------------------------------------- */
    io.use(async (socket, next) => {
        const req = socket.request;
        const res = req.res ?? socket.response ?? new ServerResponse(req);
        const ctx = app.createContext(req, res);

        await koaSession(ctx, async () => {});

        solid(socket, "clientId", cc.get(ctx));
        solid(socket, "sessionId", sc.get(ctx));
        solid(socket, "withSession", async (handler)=>{
            return applySessionHandler(socket, handler, opt);
        }, false);

        await next();
    });

    io.on("connection", socket=>{
        const { clientId, sessionId } = socket;
        if (clientId) { socket.join(`clientId:${clientId}`); }
        if (sessionId) { socket.join(`sessionId:${sessionId}`); }
    });

    store.on("destroy", (_store, sid)=>{
        if (!sid) { return; }
        clearTouchQueue(sid);
        const room = io.in(`sessionId:${sid}`);
        room.emit("session:destroy");
        setTimeout(_=>room.disconnectSockets(true), 200);
    });

    return store;
};
