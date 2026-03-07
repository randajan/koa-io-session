import { _customOptKeys, ms } from "./const.js";
import { generateUid, valid, validInterval, validObject } from "./tools.js";

const pickKoaOpt = (rawOpt) => {
    const koaOpt = {}
    for (const key in rawOpt) {
        if (_customOptKeys.has(key)) { continue; }
        koaOpt[key] = rawOpt[key];
    }

    koaOpt.key = valid("string", koaOpt.key, false, "key") ?? generateUid(12);
    koaOpt.signed = valid("boolean", koaOpt.signed, false, "signed") ?? true;

    return koaOpt;
};

/**
 * Validate and normalize attachSession options.
 * Returns split options for internal parts and koa-session pass-through options.
 */
export const formatOptions = (opt = {}) => {
    opt = validObject(opt, true, "options");

    const koaOpt = pickKoaOpt(opt);
    
    const clientKey = valid("string", opt.clientKey) ?? `${koaOpt.key}.cid`;
    const clientMaxAge = validInterval(opt.clientMaxAge, false, "clientMaxAge") ?? ms.y();
    const clientAlwaysRoll = valid("boolean", opt.clientAlwaysRoll, false, "clientAlwaysRoll") ?? true;

    const clientOpt = { ...koaOpt, key:clientKey, maxAge:clientMaxAge }

    return {
        koaOpt,
        clientOpt,
        clientAlwaysRoll,
    };
};

