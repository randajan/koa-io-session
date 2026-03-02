import { wrapExternalKey } from "./wrappers.js";



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