import crypto from "crypto";
import session from "koa-session";
import { SessionStore } from "./SessionStore";
import { virtual } from "@randajan/props";

const uid = (len = 12) => crypto.randomBytes(len).toString("base64url").slice(0, len);

export const attachSession = (app, io, opt = {}) => {
    if (!app.keys) { app.keys = Array(6).fill().map(() => uid(12)); }

    if (!opt.key) { opt.key = uid(12); }
    if (!opt.store) { opt.store = new SessionStore(); }

    const { key, store } = opt;

    const signed = ("signed" in opt) ? !!opt.signed : true;
    delete opt.signed;

    app.use(session(opt, app));
    app.use(async (ctx, next) => {
        ctx.session.active = true; //idk why but without this it doesnt work :)
        await next();
    });
    
    io.use(async (socket, next) => {
    
        if (!socket.handshake.headers.cookie) { return next(new Error('no cookie')); }
        
        const ctx = app.createContext(socket.request, socket.response);
        const sid = ctx.cookies.get(key, { signed });
        
        virtual(socket, "sessionId", _=>sid);
        virtual(socket, "session", _=>store.get(sid));
    
        await next();
    });
};



export default attachSession;