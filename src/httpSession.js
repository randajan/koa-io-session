import session from "koa-session";
import { wrapExternalKey, wrapStore } from "./wrappers.js";
import { _errPrefix } from "./const.js";
import { generateUid } from "./tools.js";

export const ensureAppKeys = (app, keys, allowRnd=false)=>{
    
    if (app.keys) {
        if (!keys) { return; }
        throw new Error(`${_errPrefix} Cannot set 'appKeys' because app.keys is already defined.`);
    }

    if (keys) {
        app.keys = keys;
        return;
    }

    app.keys = keys = Array(2).fill().map(() => generateUid(32));

    if (!allowRnd) {
        console.warn([
            `${_errPrefix} app.keys were generated at runtime.`,
            `${_errPrefix} Resolve this by adding one of these options to bridge constructor:`,
            `${_errPrefix} 1) "appKeys": ${JSON.stringify(app.keys)}`,
            `${_errPrefix} 2) "allowRndAppKeys": true`
        ].join("\n"));
    }
}

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
