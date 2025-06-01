import crypto from "crypto";

export const generateUid = (len = 16) => crypto.randomBytes(len).toString("base64url").slice(0, len);