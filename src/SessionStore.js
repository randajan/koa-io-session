import { solid } from "@randajan/props";
import { EventEmitter } from "events";



export const wrapStore = (store)=>{
    return {
        get:store.get.bind(store),
        set:store.set.bind(store),
        destroy:store.destroy.bind(store),
        touch:store.touch.bind(store)
    }
}

const formatState = (session, maxAge, prevTTL, defaultTTL)=>{
    const ttl = maxAge ?? prevTTL ?? defaultTTL;
    const expiresAt = Date.now() + ttl;
    return { session, expiresAt, ttl };
}

export class SessionStore extends Map {

    constructor(defaultTTL=86_400_000, eventEmitterOpt={}) {
        super();
        solid(this, "defaultTTL", defaultTTL);
        solid(this, "event", new EventEmitter(eventEmitterOpt));
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

    touch(sid, maxAge) {
        const { defaultTTL } = this;
        const d = super.get(sid);
        if (!d) { return false; }
        super.set(sid, formatState(d.session, maxAge, d.ttl, defaultTTL));
        this.event.emit("touch", this, sid);
        return true;
    }

    set(sid, session, maxAge) {
        const { defaultTTL } = this;
        const d = super.get(sid);
        if (session == null) { return !d || this.destroy(sid); }
        super.set(sid, formatState(session, maxAge, d?.ttl, defaultTTL));
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

    autoCleanup(interval) {
        const { defaultTTL } = this;
        if (!interval) { interval = defaultTTL/10; }

        const tid = setInterval(() => {
            this.cleanup();
        }, interval);
        return _ => clearInterval(tid);
    }
}
