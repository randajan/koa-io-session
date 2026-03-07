import { solid } from "@randajan/props";
import { is, valid, validInterval, validObject, validRange, validStore } from "../tools.js";
import { _errPrefix, _privs, ms } from "../const.js";
import { LiveStore } from "../stores/LiveStore.js";

const formatState = (session, maxAge, maxAgeDefault)=>{
    const ttl = maxAge ?? maxAgeDefault;
    const expiresAt = Date.now() + ttl;
    return { session, expiresAt, ttl };
}

const requireList = (store) => {
    if (!store.list) { throw new TypeError(`${_errPrefix} store.list() is required`); }
};

export class StoreGateway {

    static is(any) { return any instanceof StoreGateway; }

    constructor(opt={}, emit={}) {
        const maxAge = validRange(opt.maxAge, ms.m(), ms.y(), false, "maxAge") ?? ms.M();
        const autoCleanup = valid("boolean", opt.autoCleanup, false, "autoCleanup") ?? false;

        solid(this, "emit", emit);
        solid(this, "maxAge", maxAge);
        solid(this, "store", validStore(opt.store, false) ?? new LiveStore());

        if (autoCleanup) { this.startAutoCleanup(validInterval(opt.autoCleanupMs, false, "autoCleanupMs")); }
    }

    async list() {
        const { store } = this
        requireList(store);
        return store.list();
    }

    async get(sid) {
        const { store } = this
        const c = await store.get(sid);
        if (!c) { return; }
        
        if (Date.now() >= c.expiresAt) {
            await this.destroy(sid); return;
        }

        try { return JSON.parse(c.session); }
        catch {
            await this.destroy(sid); // rozbitý záznam pryč
            throw new Error(`${_errPrefix} Invalid session JSON for sid='${sid}'.`);
        };

    }

    async set(sid, session, maxAge) {
        const { store } = this
        const ses = validObject(session, false, "session");
        if (ses == null) { return this.destroy(sid); }

        const to = JSON.stringify(ses);
        const from = await store.get(sid, false);
        if (to === from?.session) { return true; }

        const isOk = await store.set(sid, formatState(to, maxAge, this.maxAge));
        if (isOk === false) { return false; }
        this.emit.notifySet(sid, !from);
        return true;
    }

    async destroy(sid) {
        const { store } = this
        const isOk = await store.destroy(sid);
        if (isOk === false) { return false; }
        this.emit.notifyDestroy(sid);
        return true;
    }

    async cleanup() {
        const { store } = this
        requireList(store);

        const list = await store.list();
        const now = Date.now();
        let cleared = 0;

        await Promise.all([...list].map(async sid=>{
            const d = await store.get(sid);
            if (!d) { return; }
            if (now < d.expiresAt) { return; }
            if (await this.destroy(sid)) { cleared++; }
        }));

        if (is("function", store.optimize)) { await store.optimize(cleared); }

        this.emit.notifyCleanup(cleared);
        return cleared;
    }

    startAutoCleanup(interval) {
        const { store, maxAge, _intId } = this;
        requireList(store);
        const int = validRange(interval, ms.m(), ms.d(), false, "interval") ?? Math.max(ms.m(), Math.min(ms.d(), maxAge/4));
        clearInterval(_intId);
        this._intId = setInterval(_=>this.cleanup().catch(()=>{}), int);
        return true;
    }

    stopAutoCleanup() {
        const { _intId } = this;
        if (!_intId) { return false; }
        clearInterval(_intId);
        delete this._intId;
        return true;
    }

}
