import { wrapExternalKey } from "./wrappers.js";



export const createClientCookie = opt => {
    const { key, signed, path, secure, sameSite, httpOnly } = opt;
    return wrapExternalKey({
        key: `${key}.cid`,
        signed,
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: path ?? "/",
        secure,
        sameSite,
        httpOnly: httpOnly ?? true,
        overwrite: true
    });
}