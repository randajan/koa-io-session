// attachSession.js  – verze s auto-persist proxy
import session from "koa-session";
import { solid } from "@randajan/props";
import { generateUid } from "./uid";
import { SessionStore } from "./SessionStore";


export const attachSession = (app, io, opt = {}) => {
    const signed = "signed" in opt ? !!opt.signed : true;
    delete opt.signed;


    if (!app.keys) app.keys = Array(6).fill().map(() => generateUid(12));
    if (!opt.key) opt.key = generateUid(12);
    if (!opt.maxAge) { opt.maxAge = 86_400_000; }
    if (!opt.store) { opt.store = new SessionStore(opt.maxAge); }

    const { key, store } = opt;

    const koaSession = session(opt, app);
    app.use(koaSession);

    // pro HTTP jen sessionId, nic víc nepotřebujeme
    app.use(async (ctx, next) => {
        solid(ctx, "sessionId", ctx.cookies.get(key, { signed }));
        await next();
    });

    /* ------------------  WebSocket  ------------------------------------- */
    io.use(async (socket, next) => {

        if (!socket.request.headers.cookie) { return next(new Error("No cookie")); }

        const ctx = app.createContext(socket.request, socket.response);
        await koaSession(ctx, async () => { });            // aktivuj koa-session

        const sid = ctx.cookies.get(key, { signed });
        const ttl = () => ctx.session?.cookie?.maxAge ?? opt.maxAge ?? 86_400_000;    // helper pro TTL

        const persist = () => store.set(sid, ctx.session, ttl());

        /* AUTO-SAVE PROXY  */
        const liveSession = new Proxy(ctx.session, {
            set(target, prop, value, receiver) {
                const ok = Reflect.set(target, prop, value, receiver);
                persist();           // hned uložíme
                return ok;
            },
            deleteProperty(target, prop) {
                const ok = Reflect.deleteProperty(target, prop);
                persist();
                return ok;
            }
        });

        socket.once("disconnect", persist);

        solid(socket, "sessionId", sid);
        solid(socket, "session", liveSession);     // <-- už se ukládá samo

        await next();
    });

    return koaSession.store;   // kdyby ses k němu chtěl dostat jinde
};