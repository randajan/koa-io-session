import { solids } from "@randajan/props";

export class Bridge {
    constructor(opt={}) {
        const { onSet, onDelete } = opt;

        solids(this, {
            onSet,
            onDelete,
            s2c:new Map(),
            c2s:new Map()
        });

    }

    set(cid, sid) {
        if (!cid || !sid) { return false; }

        const byCid = this.deleteByCid(cid, sid);
        const bySid = this.deleteBySid(sid, cid);
        if (!byCid && !bySid) { return false; }

        this.c2s.set(cid, sid);
        this.s2c.set(sid, cid);

        this.onSet(cid, sid);
        return true;
    }
   
    getByCid(cid) {return this.c2s.get(cid); }
    getBySid(sid) { return this.s2c.get(sid); }

    deleteBySid(sid, skipIf) {
        const cid = this.getBySid(sid);
        if (!cid) { return true; }
        if (skipIf && cid == skipIf) { return false; }
        this.s2c.delete(sid);
        this.c2s.delete(cid);
        this.onDelete(cid, sid);
        return true;
    }

    deleteByCid(cid, skipIf) {
        const sid = this.getByCid(cid);
        if (!sid) { return true; }
        if (skipIf && sid == skipIf) { return false; }
        this.c2s.delete(cid);
        this.s2c.delete(sid);
        this.onDelete(cid, sid);
        return true;
    }
}
