import session from "koa-session";
import { wrapExternalKey, wrapStore } from "./wrappers.js";

export const createKoaSession = (opt, app, onSet)=>{
    const store = wrapStore(opt.store);
    const externalKey = wrapExternalKey(opt, onSet);
    const koaSession = session({...opt, store, externalKey}, app);
    return [koaSession, externalKey];
}