import { EventEmitter } from "events";
import { ServerResponse } from "http";
import { solid, virtual } from "@randajan/props";

import { generateUid } from "../tools.js";
import { createKoaSession, createClientCookie, ensureAppKeys } from "../httpSession.js";
import { applySessionHandler } from "../socketSession.js";

import { formatOptions } from "../formatOptions.js";
import { Bridge } from "./Bridge.js";
import { _errPrefix, _privs } from "../const.js";
import { TempMap } from "./TempMap.js";
import { StoreGateway } from "./StoreGateway.js";


export class SessionBridge extends EventEmitter {

    constructor(app, io, opt = {}) {
        super();

        const { appKeys, allowRndAppKeys, koaOpt, clientOpt, clientAlwaysRoll } = formatOptions(opt);
        const _p = {};

        ensureAppKeys(app, appKeys, allowRndAppKeys);

        const tmp = new TempMap(5000);
        const brg = _p.brg = new Bridge({
            onSet:(clientId, sessionId)=>{
                const isNew = !!tmp.get(sessionId, true);
                this.emit("sessionSet", { clientId, sessionId, isNew, isInit:true });
            },
            onDelete:(clientId, sessionId)=>this.emit("sessionDestroy", { clientId, sessionId })
        });

        _p.notifySet = (sid, isNew)=>{
            if (!sid) { return; }
            const cid = brg.getBySid(sid);
            if (!cid) { tmp.set(sid, isNew, false); return; }
            this.emit("sessionSet", { clientId:cid, sessionId:sid, isNew:!!isNew, isInit:false });
        }
        _p.notifyDestroy = (sid)=>{ if (sid) { brg.deleteBySid(sid); } }
        _p.notifyCleanup = (cleared)=>{ this.emit("cleanup", cleared); }

        const gw = _p.gw = new StoreGateway(opt, _p);

        const cc = createClientCookie(clientOpt);
        const [koaSession, sc] = createKoaSession(app, gw, koaOpt, (ctx, sid)=>{
            const cid = cc.get(ctx);
            brg.set(cid, sid);
        });

        const reviveCid = (ctx, allowSet=false)=>{
            let cid = cc.get(ctx);
            if (!allowSet) { return cid; }
            if (!cid) { cc.set(ctx, cid = generateUid(24)); }
            else if (clientAlwaysRoll) { cc.set(ctx, cid); }
            return cid;
        }

        const reviveSid = async (ctx, cid, allowSet=false)=>{
            const reqSid = sc.get(ctx);
            if (cid == null || reqSid == null) { return; } //empty cid or sid

            const brgSid = brg.getByCid(cid);
            if (brgSid == reqSid) { return; } //correct sid for this client
            else if (brgSid && !allowSet) { return; } //reqSid is obsolete but we can't set new one
            else if (brgSid) { sc.set(ctx, brgSid); return; } //this client have different sid

            if (brg.getBySid(reqSid)) { return; } //sid is occupied by different client
            if (!await gw.get(reqSid)) { return; } //there is no sesssion with that sid
            brg.set(cid, reqSid); //attach session to this client
        }
        
        app.use(koaSession);

        // pro HTTP jen sessionId, nic víc nepotřebujeme
        app.use(async (ctx, next) => {
            const cid = reviveCid(ctx, true);
            await reviveSid(ctx, cid, true);
            
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
            
            const cid = reviveCid(ctx, false);
            await reviveSid(ctx, cid, false);

            solid(socket, "ctx", ctx);
            solid(socket, "clientId", cid);
            virtual(socket, "sessionId", _=>brg.getByCid(cid));
            solid(socket, "withSession", async function (handler, onMissing) {
                const onm = arguments.length > 1 ? onMissing : new Error(`${_errPrefix} Session is missing for this socket.`);
                return applySessionHandler(socket, handler, gw, onm);
            }, false);

            await next();
        });

        _privs.set(this, _p);
    }

    async getById(sessionId) {
        const { gw, brg } = _privs.get(this);
        const cid = brg.getBySid(sessionId);
        if (cid) { return gw.get(sessionId); }
    }

    async destroyById(sessionId) {
        const { gw, brg } = _privs.get(this);
        const cid = brg.getBySid(sessionId);
        if (cid) { return gw.destroy(sessionId); }
        return false;
    }

    async setById(sessionId, session, maxAge) {
        const { gw, brg } = _privs.get(this);
        const cid = brg.getBySid(sessionId);
        if (cid) { return gw.set(sessionId, session, maxAge); } 
        throw new Error(`${_errPrefix} Creating session via setById() is prohibited. sessionId='${sessionId}'.`);
    }
    

    async getByClientId(clientId) {
        const { gw, brg } = _privs.get(this);
        const sid = brg.getByCid(clientId);
        if (sid) { return gw.get(sid); }
    }

    async destroyByClientId(clientId) {
        const { gw, brg } = _privs.get(this);
        const sid = brg.getByCid(clientId);
        if (sid) { return gw.destroy(sid); }
        return false;
    }
    
    async setByClientId(clientId, session, maxAge) {
        const { gw, brg } = _privs.get(this);
        const sid = brg.getByCid(clientId);
        if (sid) { return gw.set(sid, session, maxAge); }
        throw new Error(`${_errPrefix} Creating session via setByClientId() is prohibited. clientId='${clientId}'.`);
    }

    getSessionId(clientId) { return _privs.get(this).brg.getByCid(clientId); }
    getClientId(sessionId) { return _privs.get(this).brg.getBySid(sessionId); }

    async cleanup() { return _privs.get(this).gw.cleanup(); }
    startAutoCleanup(interval) { return _privs.get(this).gw.startAutoCleanup(interval); }
    stopAutoCleanup() { return _privs.get(this).gw.stopAutoCleanup(); }

    notifyStoreSet(sessionId, isNew) { return _privs.get(this).notifySet(sessionId, isNew); }
    notifyStoreDestroy(sessionId) { return _privs.get(this).notifyDestroy(sessionId); }
    notifyStoreCleanup(clearedCount) { return _privs.get(this).notifyCleanup(clearedCount); }
}

