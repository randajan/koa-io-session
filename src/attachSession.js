// attachSession.js  – verze s auto-persist proxy
import { ServerResponse } from "http";
import session from "koa-session";
import { solid } from "@randajan/props";
import { generateUid } from "./tools.js";
import { SessionStore, wrapStore } from "./SessionStore.js";
import { applySessionHandler, clearTouchQueue } from "./socketSession.js";


const validateStore = (store) => {
    const missing = [];
    if (typeof store?.get !== "function") { missing.push("get()"); }
    if (typeof store?.set !== "function") { missing.push("set()"); }
    if (typeof store?.destroy !== "function") { missing.push("destroy()"); }
    if (typeof store?.touch !== "function") { missing.push("touch()"); }
    if (typeof store?.on!== "function") { missing.push("on()"); }

    if (missing.length) {
        throw new TypeError(`attachSession options.store is missing required API: ${missing.join(", ")}`);
    }
};


export const attachSession = (app, io, opt = {}) => {
    opt.signed = "signed" in opt ? !!opt.signed : true;

    if (!app.keys) { app.keys = Array(6).fill().map(() => generateUid(12)); }
    if (!opt.key) { opt.key = generateUid(12); }
    if (!opt.maxAge) { opt.maxAge = 86_400_000; }

    const { key, signed, externalKey } = opt;
    const store = opt.store || new SessionStore(opt.maxAge);
    validateStore(store);
    opt.store = wrapStore(store);

    const getSID = externalKey ? ctx=>externalKey.get(ctx) : ctx=>ctx.cookies.get(key, { signed });

    const koaSession = session(opt, app);
    app.use(koaSession);

    // pro HTTP jen sessionId, nic víc nepotřebujeme
    app.use(async (ctx, next) => {
        solid(ctx, "sessionId", getSID(ctx));
        await next();
    });

    /* ------------------  WebSocket  ------------------------------------- */
    io.use(async (socket, next) => {
        const req = socket.request;
        const res = req.res ?? socket.response ?? new ServerResponse(req);
        const ctx = app.createContext(req, res);

        await koaSession(ctx, async () => {}); //aktivuje session
        
        solid(socket, "sessionId", getSID(ctx));
        solid(socket, "withSession", async (handler)=>{
            return applySessionHandler(socket, handler, opt);
        }, false);

        await next();
    });

    io.on("connection", socket=>{
        const sid = socket.sessionId;
        if (sid) { socket.join(`sessionId:${sid}`); }
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
