import createFileDB from "@randajan/file-db";
import { valid } from "../tools.js";
import { _privs } from "../const.js";


const ensureReady = async (self) => {
    const _p = _privs.get(self);
    if (_p.ready) { return _p.ready; }

    _p.ready = (async () => {
        await _p.file.verify();
        _p.cache = await _p.file.index();
    })();

    return _p.ready;
};

export class FileStore {

    constructor(opt = {}) {
        const fileName = valid("string", opt.fileName, false, "fileName") || "sessions";
        const fdb = opt.fdb ?? createFileDB(opt.fdbOpt ?? {});
        const file = fdb.get(fileName, false) ?? fdb.link(fileName);

        const _p = {
            fdb,
            file,
            cache:{},
            ready:null
        };

        _privs.set(this, _p);
    }

    async get(sid) {
        await ensureReady(this);
        const { cache } = _privs.get(this);
        return cache[sid];
    }

    async set(sid, state) {
        await ensureReady(this);
        const _p = _privs.get(this);
        _p.cache[sid] = state;
        await _p.file.write(sid, state);
        return true;
    }

    async destroy(sid) {
        await ensureReady(this);
        const _p = _privs.get(this);
        if (!Object.prototype.hasOwnProperty.call(_p.cache, sid)) { return false; }
        delete _p.cache[sid];
        await _p.file.write(sid);
        return true;
    }

    async list() {
        await ensureReady(this);
        return Object.keys(_privs.get(this).cache);
    }

    async optimize() {
        const _p = _privs.get(this);
        await _p.file.optimize();
    }
}
