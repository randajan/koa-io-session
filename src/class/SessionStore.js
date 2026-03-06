import { solid } from "@randajan/props";
import { EventEmitter } from "events";
import { is, valid, validInterval, validRange, validStore } from "../tools.js";
import { _errPrefix, _privs, ms } from "../const.js";

const formatState = (session, maxAge, prevTTL, maxAgeDefault)=>{
    const ttl = maxAge ?? prevTTL ?? maxAgeDefault;
    const expiresAt = Date.now() + ttl;
    return { session, expiresAt, ttl };
}

const requireList = (drv, method) => {
    if (!drv.list) {
        throw new TypeError(`${_errPrefix} SessionStore.${method}() requires backend method store.list().`);
    }
};

export class SessionStore extends EventEmitter {

    static is(any) { return any instanceof SessionStore; }

    constructor(driver, opt={}) {
        super();

        const _p = { drv:validStore(driver) }

        const maxAge = validRange(ms.m(), ms.y(), opt.maxAge, false, "maxAge") ?? ms.M();
        const autoCleanup = valid("boolean", opt.autoCleanup, false, "autoCleanup") ?? true;

        solid(this, "maxAge", maxAge);

        _privs.set(this, _p);

        if (autoCleanup) { this.startCleanup(validInterval(opt.autoCleanupMs, false, "autoCleanupMs")); }
    }

    async list() {
        const { drv } = _privs.get(this);
        requireList(drv, "list");
        return drv.list();
    }

    async get(sid) {
        const { drv } = _privs.get(this);
        const d = await drv.get(sid);
        if (!d) { return; }
        if (Date.now() < d.expiresAt) { return d.session; }
        await this.destroy(sid);
    }

    async set(sid, session, maxAge) {
        const { drv } = _privs.get(this);
        const d = await drv.get(sid);
        if (session == null) { return !d || this.destroy(sid); }
        const isOk = await drv.set(sid, formatState(session, maxAge, d?.ttl, this.maxAge));
        if (isOk === false) { return false; }
        this.emit("set", this, sid, !d);
        return true;
    }

    async destroy(sid) {
        const { drv } = _privs.get(this);
        const isOk = await drv.destroy(sid);
        if (isOk === false) { return false; }
        this.emit("destroy", this, sid);
        return true;
    }

    async cleanup() {
        const { drv } = _privs.get(this);
        requireList(drv, "cleanup");

        const list = await drv.list();
        const now = Date.now();
        let cleared = 0;

        await Promise.all([...list].map(async sid=>{
            const d = await drv.get(sid);
            if (!d) { return; }
            if (now < d.expiresAt) { return; }
            if (await this.destroy(sid)) { cleared++; }
        }));

        if (is("function", drv.optimize)) { await drv.optimize(cleared); }

        if (cleared) { this.emit("cleanup", this, cleared); }
        return cleared;
    }

    startCleanup(interval) {
        const { maxAge } = this;
        const _p = _privs.get(this);
        requireList(_p.drv, "startCleanup");
        const int = validInterval(interval, false, "interval") ?? Math.max(ms.m(), Math.min(ms.h(), maxAge/10));
        clearInterval(_p.cleanupIntervalId);
        _p.cleanupIntervalId = setInterval(_=>this.cleanup().catch(()=>{}), int);
        return true;
    }

    stopCleanup() {
        const _p = _privs.get(this);
        if (!_p.cleanupIntervalId) { return false; }
        clearInterval(_p.cleanupIntervalId);
        delete _p.cleanupIntervalId;
        return true;
    }

}
