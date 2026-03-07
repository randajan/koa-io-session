import crypto from "crypto";
import { _errPrefix } from "./const.js";

export const generateUid = (len = 16) => crypto.randomBytes(len).toString("base64url").slice(0, len);

export const is = (type, any)=>typeof any === type;
const _typeOf = (any) => any === null ? "null" : Array.isArray(any) ? "array" : typeof any;
const _err = (msg) => `${_errPrefix} ${msg}`;

export const valid = (type, any, req=false, msg="argument")=>{
    if (any == null) {
        if (!req) { return; }
        throw new TypeError(_err(`Missing required '${msg}'. Expected type '${type}'.`));
    }
    if (is(type, any)) { return any; }
    throw new TypeError(_err(`Invalid '${msg}'. Expected type '${type}', received '${_typeOf(any)}'.`));
}

export const validRange = (any, min, max, req=false, msg="argument")=>{
    const num = valid("number", any, req, msg);
    if (num == null) { return; }
    if (num < min || num > max) {
        throw new RangeError(_err(`Invalid '${msg}'. Expected value in range <${min}, ${max}>, received '${num}'.`));
    }
    return num;
}

export const validInterval = (any, req=false, msg="argument")=>{
    return validRange(any, 10, 2_147_483_647, req, msg);
}

export const validObject = (any, req=false, msg="argument")=>{
    const obj = valid("object", any, req, msg);
    if (obj == null) { return; }
    if (!Array.isArray(obj)) { return obj; }
    throw new TypeError(_err(`Invalid '${msg}'. Expected plain object, received 'array'.`));
}


export const validStore = (store, req=false) => {
    store = validObject(store, req, "store");
    if (!store) { return; }

    const missing = [];
    if (!is("function", store.get)) { missing.push("get()"); }
    if (!is("function", store.set)) { missing.push("set()"); }
    if (!is("function", store.destroy)) { missing.push("destroy()"); }

    if (missing.length) {
        throw new TypeError(_err(`Invalid 'store'. Missing required API: ${missing.join(", ")}.`));
    }

    valid("function", store.list, false, "store.list()");
    
    return store;
};
