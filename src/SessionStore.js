import { solid } from "@randajan/props";


export class SessionStore {
    constructor() {
        solid(this, "_recs", new Map());
    }

    get(sid) {
        const rec = this._recs.get(sid);
        if (!rec) { return; }
        if (Date.now() < rec.expiresAt) { return rec.session; }
        this.destroy(sid);
    }

    set(sid, session, maxAge) {
        const expiresAt = Date.now() + maxAge;
        this._recs.set(sid, { session, expiresAt, maxAge });
    }

    destroy(sid) {
        this._recs.delete(sid);
    }
};