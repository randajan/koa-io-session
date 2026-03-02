import { _customOptKeys, ms } from "./const.js";
import { generateUid, valid, validRange } from "./tools.js";
import { wrapExternalKey } from "./wrappers.js";

const pickKoaOpt = (rawOpt, onSessionSet) => {
    const koaOpt = {}
    for (const key in rawOpt) {
        if (_customOptKeys.includes(key)) { continue; }
        koaOpt[key] = rawOpt[key];
    }

    koaOpt.key = valid("string", koaOpt.key, false, "key") ?? generateUid(12);
    koaOpt.maxAge = validRange(ms.m(), ms.y(), koaOpt.maxAge, false) ?? ms.M();
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

    const autoCleanup = valid("boolean", opt.autoCleanup, false, "autoCleanup") ?? true;
    const autoCleanupMs = validInterval(opt.autoCleanupMs, false, "autoCleanupMs") ?? Math.max(ms.m(), Math.min(ms.h(), koa.maxAge/10));
    const clientKey = valid("string", opt.clientKey) ?? `${koa.key}.cid`;
    
    const clientMaxAge = validInterval(opt.clientMaxAge, false, "clientMaxAge") ?? ms.y();
    const clientAlwaysRoll = valid("boolean", opt.clientAlwaysRoll, "clientAlwaysRoll") ?? true;

    const socketTouch = valid("boolean", opt.socketTouch, "socketTouch") ?? true;
    const socketTouchSoftMs = validInterval(opt.socketTouchSoftMs, false, "socketTouchSoftMs") ?? ms.s(5);
    const socketTouchHardMs = validInterval(opt.socketTouchHardMs, false, "socketTouchHardMs") ?? ms.m();

    return {
        koa,
        autoCleanup,
        autoCleanupMs,
        clientKey,
        clientMaxAge,
        clientAlwaysRoll,
        socketTouch,
        socketTouchSoftMs,
        socketTouchHardMs,
    };
};

