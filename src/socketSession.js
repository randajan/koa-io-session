import { solids } from "@randajan/props";
import { createQueue } from "@randajan/queue";
import { isObject } from "./tools";


const sidLocks = new Map();
const touchQueues = new Map();

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

const getTouchQueue = (sid, store) => {
    const existing = touchQueues.get(sid);
    if (existing) { return existing; }

    const queue = createQueue(async (touchMaxAge) => {
        try { await store.touch(sid, touchMaxAge); } catch {}
        if (!queue.isPending) { touchQueues.delete(sid); }
    }, { pass: "last", softMs:1_000, hardMs:5_000 });

    touchQueues.set(sid, queue);
    return queue;
};

const scheduleTouch = (sid, store, maxAge) => {
    if (typeof store?.touch !== "function") { return; }
    const queue = getTouchQueue(sid, store);
    queue(maxAge);
};

export const clearTouchQueue = (sid) => {
    const queue = touchQueues.get(sid);
    if (!queue) { return false; }
    queue.flush();
    touchQueues.delete(sid);
    return true;
};

const runSessionHandler = async (socket, handler, opt={}) => {
    const sid = socket.sessionId;
    const { store, maxAge } = opt;
    const current = await store.get(sid);

    if (!isObject(current)) { throw new Error("Session not found"); }
    const session = current;
    const sessionCtx = createSessionCtx(sid, session, socket);

    const originalHash = createSessionHash(sessionCtx.session);
    const result = await handler(sessionCtx, socket);

    if (sessionCtx.session == null) {
        clearTouchQueue(sid);
        await store.destroy(sid);
        return result;
    }

    if (!isObject(sessionCtx.session)) {
        throw new TypeError("sessionCtx.session must be an object or null");
    }

    if (isSessionHashChanged(originalHash, sessionCtx.session)) {
        clearTouchQueue(sid);
        await store.set(sid, sessionCtx.session, maxAge);
    } else {
        scheduleTouch(sid, store, maxAge);
    }

    return result;
};

export const applySessionHandler = async (socket, handler, opt={}) => {

    if (typeof handler !== "function") {
        throw new TypeError("socket.withSession(handler) requires a function");
    }
    if (!socket.sessionId) {
        throw new Error("Missing session id");
    }

    return withLock(runSessionHandler, socket, handler, opt);
};
