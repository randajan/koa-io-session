import { EventEmitter } from "events";
import { ServerResponse } from "http";
import { solid, virtual } from "@randajan/props";

import { generateUid } from "../tools.js";
import { createKoaSession, createClientCookie } from "../httpSession.js";
import { applySessionHandler } from "../socketSession.js";

import { formatOptions } from "../formatOptions.js";
import { Bridge } from "./Bridge.js";


export class SessionBridge extends EventEmitter {

    constructor(app, io, opt = {}) {
        super();

        if (!app.keys) { app.keys = Array(6).fill().map(() => generateUid(12)); }

        const o = formatOptions(opt);
        const { store } = o.koaOpt;

        const brg = new Bridge({
            onSet:pair=>this.emit("sessionStart", pair),
            onDelete:pair=>this.emit("sessionEnd", pair)
        });

        const cc = createClientCookie(o.clientOpt);
        const [koaSession, sc] = createKoaSession(o.koaOpt, app, (ctx, sid)=>{
            const cid = cc.get(ctx);
            brg.set(cid, sid);
        });

        const regenerateSid = async (ctx, cid, reqSid)=>{
            if (cid == null || reqSid == null) { return; } //empty cid or sid

            const brgSid = brg.getByCid(cid);
            if (brgSid == reqSid) { return; } //correct sid for this client
            else if (brgSid) { sc.set(ctx, brgSid); return; } //this client have different sid

            if (brg.getBySid(reqSid)) { return; } //sid is occupied by different client
            if (!await store.get(reqSid)) { return; } //there is no sesssion with that sid
            brg.set(cid, reqSid); //attach session to this client
        }
        
        app.use(koaSession);

        // pro HTTP jen sessionId, nic víc nepotřebujeme
        app.use(async (ctx, next) => {
            let cid = cc.get(ctx);
            const sid = sc.get(ctx);

            if (!cid) { cc.set(ctx, cid = generateUid(24)); }
            else if (o.clientAlwaysRoll) { cc.set(ctx, cid); }
            
            await regenerateSid(ctx, cid, sid);
            
            solid(ctx, "clientId", cid);
            virtual(ctx, "sessionId", _=>brg.getByCid(cid));
            await next();
        });

        /* ------------------  WebSocket  ------------------------------------- */
        io.use(async (socket, next) => {
            const req = socket.request;
            const res = req.res ?? socket.response ?? new ServerResponse(req);
            const ctx = app.createContext(req, res);

            await koaSession(ctx, async () => {});
            const cid = cc.get(ctx);
            const sid = sc.get(ctx);

            await regenerateSid(ctx, cid, sid);

            solid(socket, "clientId", cid);
            virtual(socket, "sessionId", _=>brg.getByCid(cid));
            solid(socket, "withSession", async (handler)=>{
                return applySessionHandler(socket, handler, store);
            }, false);

            await next();
        });

        store.on("destroy", (_store, sid)=>{
            if (!sid) { return; }
            brg.deleteBySid(sid);
        });
        

        solid(this, "store", store);
    }


}

