import crypto from "crypto";

export const generateUid = (len = 16) => crypto.randomBytes(len).toString("base64url").slice(0, len);

export const is = (type, any)=>typeof any === type;

export const valid = (type, any, req=false, msg="argument")=>{
    if (any == null) {
        if (!req) { return; }
        throw new Error(`${msg} require typeof '${type}'`);
    }
    if (is(type, any)) { return any; }
    throw new Error(`${msg} is not typeof '${type}'`);
}

export const validRange = (min, max, any, req=false, msg="argument")=>{
    const num = valid("number", any, req, msg);
    if (num == null) { return; }
    if (num < min) { throw new Error(`${msg} must be greater than ${min}`); }
    if (num > max) { throw new Error(`${msg} must be less than ${max}`); }
    return num;
}

export const validInterval = (any, req=false, msg="argument")=>{
    return validRange(10, 2_147_483_647, any, req, msg);
}

export const validObject = (any, req=false, msg="argument")=>{
    const obj = valid("object", any, req, msg);
    if (obj == null) { return; }
    if (!Array.isArray(obj)) { return obj; }
    throw new Error(`${msg} must be object, not array`);
}


export const validStore = (store) => {
    const missing = [];
    if (!is("function", store?.get)) { missing.push("get()"); }
    if (!is("function", store?.set)) { missing.push("set()"); }
    if (!is("function", store?.destroy)) { missing.push("destroy()"); }
    if (!is("function", store?.on)) { missing.push("on()"); }

    if (missing.length) {
        throw new TypeError(`store is missing required API: ${missing.join(", ")}`);
    }
    
    return store;
};
