import session from "koa-session";
import { wrapExternalKey, wrapStore } from "./wrappers.js";

export const createKoaSession = (app, gw, opt, onSet)=>{
    const maxAge = gw.maxAge;
    const store = wrapStore(gw);
    const externalKey = wrapExternalKey(opt, onSet);
    const koaSession = session({...opt, maxAge, store, externalKey}, app);
    return [koaSession, externalKey];
}

export const createClientCookie = opt => {
    const { key, maxAge, signed, path, secure, sameSite, httpOnly } = opt;
    return wrapExternalKey({
        key,
        signed,
        maxAge,
        path: path ?? "/",
        secure,
        sameSite,
        httpOnly: httpOnly ?? true,
        overwrite: true
    });
}