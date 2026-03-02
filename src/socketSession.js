import { solids } from "@randajan/props";
import { validObject } from "./tools.js";


const sidLocks = new Map();

const createSessionCtx = (sessionId, session, socket) =>solids({ session }, { sessionId, socket });

const createSessionHash = (session) => {
    try { return JSON.stringify(session ?? null); }
    catch { return null; }
};

const isSessionHashChanged = (originalHash, session) => {
    const nextHash = createSessionHash(session);
    if (originalHash == null || nextHash == null) { return true; }
    return originalHash !== nextHash;
};

const withLock = async (task, socket, ...args) => {
    const sid = socket.sessionId;
    const previous = sidLocks.get(sid);
    let releaseCurrent;
    const current = new Promise((resolve) => { releaseCurrent = resolve; });
    sidLocks.set(sid, current);

    if (previous) { await previous; }

    try {
        return await task(socket, ...args);
    } finally {
        releaseCurrent();
        if (sidLocks.get(sid) === current) { sidLocks.delete(sid); }
    }
};

const runSessionHandler = async (socket, handler, store) => {
    const sid = socket.sessionId;

    const current = await store.get(sid);

    if (!current) { throw new Error("Session not found"); }

    const session = current;
    const sessionCtx = createSessionCtx(sid, session, socket);

    const originalHash = createSessionHash(sessionCtx.session);
    const result = await handler(sessionCtx, socket);

    if (sessionCtx.session == null) {
        await store.destroy(sid);
        return result;
    }

    sessionCtx.session = validObject(sessionCtx.session, false, "session");

    if (isSessionHashChanged(originalHash, sessionCtx.session)) {
        await store.set(sid, sessionCtx.session);
    }

    return result;
};

export const applySessionHandler = async (socket, handler, store) => {

    if (typeof handler !== "function") {
        throw new TypeError("socket.withSession(handler) requires a function");
    }
    if (!socket.sessionId) {
        throw new Error("Missing session id");
    }

    return withLock(runSessionHandler, socket, handler, store);
};
