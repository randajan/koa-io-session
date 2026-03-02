import { _customOptKeys, _defaultOpt } from "./const.js";
import { generateUid, valid, validRange } from "./tools.js";
import { wrapExternalKey } from "./wrappers.js";

const pickKoaOpt = (rawOpt, onSessionSet) => {
    const koaOpt = {}
    for (const key in rawOpt) {
        if (_customOptKeys.includes(key)) { continue; }
        koaOpt[key] = rawOpt[key];
    }

    koaOpt.key = valid("string", koaOpt.key, false, "key") ?? generateUid(12);
    koaOpt.maxAge = validRange(0, "YEAR", koaOpt.maxAge, false) ?? 86_400_000;
    koaOpt.signed = valid("boolean", koaOpt.signed, false, "signed") ?? true;
    koaOpt.store = wrapStore(opt.store);
    koaOpt.externalKey = wrapExternalKey(koaOpt, onSessionSet);

    return koaOpt;
};

/**
 * Validate and normalize attachSession options.
 * Returns split options for internal parts and koa-session pass-through options.
 */
export const formatAttachSessionOpt = (opt = {}, onSessionSet) => {
    opt = validObject(opt, true, "options");

    const koa = pickKoaOpt(opt, onSessionSet);

    const cleanupInterval = validInterval(opt.cleanupInterval, false, "cleanupInterval") ?? Math.min("HOUR", koa.maxAge/10);
    const clientKey = valid("string", opt.clientKey) ?? `${koa.key}.cid`;
    
    const clientMaxAge = validInterval(opt.clientMaxAge, false, "clientMaxAge") ?? _defaultOpt.clientMaxAge;
    const clientAlwaysRoll = valid("boolean", opt.clientAlwaysRoll, "clientAlwaysRoll") ?? true;

    const socketTouch = valid("boolean", opt.socketTouch, "socketTouch") ?? true;
    const socketTouchSoftMs = validInterval(opt.socketTouchSoftMs, false, "socketTouchSoftMs") ?? _defaultOpt.socketTouchSoftMs;
    const socketTouchHardMs = validInterval(opt.socketTouchHardMs, false, "socketTouchHardMs") ?? _defaultOpt.socketTouchHardMs;

    return {
        koa,
        cleanupInterval,
        clientKey,
        clientMaxAge,
        clientAlwaysRoll,
        socketTouch,
        socketTouchSoftMs,
        socketTouchHardMs,
    };
};

