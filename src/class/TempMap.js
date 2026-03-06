import { validInterval } from "../tools.js";
import { _privs } from "../const.js";


export class TempMap extends Map {

    constructor(ttl) {
        super();

        const _p = {
            ttl:validInterval(ttl, true, "ttl"),
            ts: new Map()
        }

        _privs.set(this, _p);
    }

    set(key, value, overwrite=true) {
        const { ts, ttl } = _privs.get(this);
        if (!overwrite && this.has(key)) { return false; }
        this.delete(key);
        super.set(key, value);
        const t = setTimeout(_=>{ this.delete(key); }, ttl);
        ts.set(key, t);
        return true;
    }
    

    get(key, andDelete=false) {
        const v = super.get(key);
        if (andDelete) { this.delete(key); }
        return v;
    }

    delete(key) {
        if (!super.delete(key)) { return false; }
        const { ts } = _privs.get(this);
        const t = ts.get(key);
        clearTimeout(t);
        ts.delete(key);
        return true;
    }

}