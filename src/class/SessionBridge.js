import { EventEmitter } from "events";
import { ServerResponse } from "http";
import { solid, virtual } from "@randajan/props";

import { generateUid } from "../tools.js";
import { createKoaSession, createClientCookie } from "../httpSession.js";
import { applySessionHandler } from "../socketSession.js";

import { formatOptions } from "../formatOptions.js";
import { Bridge } from "./Bridge.js";
import { _errPrefix, _privs } from "../const.js";
import { TempMap } from "./TempMap.js";


export class SessionBridge extends EventEmitter {

    constructor(app, io, opt = {}) {
        super();

        if (!app.keys) { app.keys = Array(6).fill().map(() => generateUid(12)); }

        const o = formatOptions(opt);
        const { store } = o.koaOpt;

        const tmp = new TempMap(5000);
        const brg = new Bridge({
            onSet:(clientId, sessionId)=>{
                const isNew = !!tmp.get(sessionId, true);
                this.emit("sessionSet", { clientId, sessionId, isNew, isInit:true });
            },
            onDelete:(clientId, sessionId)=>this.emit("sessionDestroy", { clientId, sessionId })
        });

        const cc = createClientCookie(o.clientOpt);
        const [koaSession, sc] = createKoaSession(o.koaOpt, app, (ctx, sid)=>{
            const cid = cc.get(ctx);
            brg.set(cid, sid);
        });

        const reviveSid = async (ctx, cid, reqSid)=>{
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
            
            await reviveSid(ctx, cid, sid);
            
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

            await reviveSid(ctx, cid, sid);

            solid(socket, "clientId", cid);
            virtual(socket, "sessionId", _=>brg.getByCid(cid));
            solid(socket, "withSession", async function (handler, onMissing) {
                const onm = arguments.length > 1 ? onMissing : new Error(`${_errPrefix} Session is missing for this socket.`);
                return applySessionHandler(socket, handler, store, onm);
            }, false);

            await next();
        });

        store.on("destroy", (_store, sid)=>{
            if (!sid) { return; }
            brg.deleteBySid(sid);
        });

        store.on("set", (_store, sid, isNew)=>{
            if (!sid) { return; }
            const cid = brg.getBySid(sid);
            if (!cid) { tmp.set(sid, isNew, false); return; }
            if (isNew) { console.warn(`${_errPrefix} Invariant broken: store emitted set(isNew=true) for already bound sid=${sid}, cid=${cid}`); }
            this.emit("sessionSet", { clientId:cid, sessionId:sid, isNew:!!isNew, isInit:false });
        });

        solid(this, "store", store);

        _privs.set(this, brg);
    }

    getSessionId(clientId) {
        return _privs.get(this).getByCid(clientId);
    }

    getClientId(sessionId) {
        return _privs.get(this).getBySid(sessionId);
    }


}

