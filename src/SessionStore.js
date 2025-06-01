import { solid } from "@randajan/props";

export class SessionStore {
    constructor(defaultTTL=86_400_000) {
        solid(this, "_data", new Map());
        solid(this, "_defaultTTL", defaultTTL);
    }

    get(sid) {
        const d = this._data.get(sid);
        if (!d) return;
        if (Date.now() < d.expiresAt) { return d.session; }
        this.destroy(sid);
        return {};
    }

    set(sid, session, maxAge) {
        const { _data, _defaultTTL } = this;
        const d = _data.get(sid);
        const ttl = maxAge ?? d?.ttl ?? _defaultTTL;
        const expiresAt = Date.now() + ttl;
        _data.set(sid, { session, expiresAt, ttl });
    }

    destroy(sid) { this._data.delete(sid); }

    cleanup() {
        const { _data } = this;

        const now = Date.now();
        let cleared = 0;

        for (const [sid, d] of _data) {
            if (now < d.expiresAt) { continue; }
            _data.delete(sid);
            cleared++;
        }

        return cleared;
    }

    autoCleanup(interval=3_600_000, onCleanup=()=>{}) {
        const tid = setInterval(() => {
            const cleared = this.cleanup();
            if (cleared) { onCleanup(cleared); }
        }, interval);
        return _ => clearInterval(tid);
    }
}