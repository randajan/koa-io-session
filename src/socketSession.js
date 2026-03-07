import { solids } from "@randajan/props";
import { is, valid } from "./tools.js";
import { _errPrefix } from "./const.js";

const sidLocks = new Map();

const applyOnMissing = (onMissing)=>{
    if (onMissing instanceof Error) { throw onMissing; }
    if (is("function", onMissing)) { return onMissing(); }
    return onMissing;
}

const runSessionHandler = async (sid, socket, handler, gw, onMissing) => {
    const session = await gw.get(sid);
    if (!session) { return applyOnMissing(onMissing); }

    const sessionCtx = solids({ session }, { sessionId:sid, socket });
    const result = await handler(sessionCtx, socket);

    if (sid === socket.sessionId) { await gw.set(sid, sessionCtx.session); }

    return result;
};

const createLock = (sid)=>{
    let _release;
    const previous = sidLocks.get(sid);
    const current = new Promise((resolve) => { _release = resolve; });
    sidLocks.set(sid, current);
    const release = ()=>{
        _release();
        if (sidLocks.get(sid) === current) { sidLocks.delete(sid); }
    }
    return [ previous, release ];
}

export const applySessionHandler = async (socket, handler, gw, onMissing) => {

    valid("function", handler, true, "handler");

    for (let i=0; i<5; i++) {
        const sid = socket.sessionId;
        if (!sid) { return applyOnMissing(onMissing); }

        const [ previous, release ] = createLock(sid);

        if (previous) { await previous; }
        if (previous && sid !== socket.sessionId) { release(); continue; } 

        try { return await runSessionHandler(sid, socket, handler, gw, onMissing); }
        finally { release(); }
    }

    throw new Error(`${_errPrefix} socket.sessionId changed during withSession execution.`);

};
