import { solid } from "@randajan/props";
import { EventEmitter } from "events";
import { valid, validInterval, validRange } from "../tools.js";
import { ms } from "../const.js";


const formatState = (session, maxAge, prevTTL, maxAgeDefault)=>{
    const ttl = maxAge ?? prevTTL ?? maxAgeDefault;
    const expiresAt = Date.now() + ttl;
    return { session, expiresAt, ttl };
}

export class SessionStore extends Map {

    constructor(opt={}) {
        super();

        const maxAge = validRange(ms.s(), ms.y(), opt.maxAge, false, "maxAge") ?? ms.M();
        const autoCleanup = valid("boolean", opt.autoCleanup, false, "autoCleanup") ?? true;
        const autoCleanupMs = validInterval(opt.autoCleanupMs, false, "autoCleanupMs") ?? Math.max(ms.s(), Math.min(ms.h(), maxAge/10));
            
        solid(this, "maxAge", maxAge);
        solid(this, "event", new EventEmitter());

        if (!autoCleanup) { return; }

        setInterval(_=>this.cleanup(), autoCleanupMs);
    }

    on(eventName, callback) {
        return this.event.on(eventName, callback);
    }

    get(sid) {
        const d = super.get(sid);
        if (!d) { return; }
        if (Date.now() < d.expiresAt) { return d.session; }
        this.delete(sid);
    }

    set(sid, session, maxAge) {
        const d = super.get(sid);
        if (session == null) { return !d || this.destroy(sid); }
        super.set(sid, formatState(session, maxAge, d?.ttl, this.maxAge));
        this.event.emit("set", this, sid, !d);
        return true;
    }

    delete(sid) {
        return this.destroy(sid);
    }

    destroy(sid) {
        if (this.has(sid)) {
            super.delete(sid);
            this.event.emit("destroy", this, sid);
        }
        return true;
    }

    cleanup() {
        const now = Date.now();
        let cleared = 0;

        for (const [sid, d] of this.entries()) {
            if (now < d.expiresAt) { continue; }
            if (this.destroy(sid)) { cleared++; }
        }

        if (cleared) { this.event.emit("cleanup", this, cleared); }

        return cleared;
    }

}
