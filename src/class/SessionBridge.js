import { EventEmitter } from "events";
import { solid } from "@randajan/props";

const defaultOpt = {
    rooms: {
        clientId: "clientId",
        sessionId: "sessionId"
    },
    socketEvents: {
        sessionStart: "session:start",
        sessionEnd: "session:destroy"
    },
    disconnectDelayMs: 200
};

const mergeOpt = (opt = {}) => ({
    ...defaultOpt,
    ...opt,
    rooms: {
        ...defaultOpt.rooms,
        ...opt.rooms
    },
    socketEvents: {
        ...defaultOpt.socketEvents,
        ...opt.socketEvents
    }
});

const toRoom = (prefix, id) => `${prefix}:${id}`;

const toDelay = (value, fallback) => {
    if (!Number.isFinite(value)) { return fallback; }
    if (value < 0) { return fallback; }
    return value;
};

export class SessionBridge extends EventEmitter {

    constructor(store, io, opt = {}) {
        super(opt.eventEmitterOpt);

        const cfg = mergeOpt(opt);

        solid(this, "store", store);
        solid(this, "io", io || null);
        solid(this, "rooms", cfg.rooms);
        solid(this, "socketEvents", cfg.socketEvents);
        solid(this, "disconnectDelayMs", toDelay(cfg.disconnectDelayMs, defaultOpt.disconnectDelayMs));
    }

    roomByClientId(clientId) {
        return toRoom(this.rooms.clientId, clientId);
    }

    roomBySessionId(sessionId) {
        return toRoom(this.rooms.sessionId, sessionId);
    }

    emitSessionStart(payload = {}) {
        const { clientId, sessionId } = payload;
        this.emit("sessionStart", payload);

        if (!this.io || !clientId) { return false; }
        this.io.to(this.roomByClientId(clientId)).emit(this.socketEvents.sessionStart, {
            sessionId
        });
        return true;
    }

    emitSessionEnd(payload = {}) {
        const { sessionId } = payload;
        this.emit("sessionEnd", payload);

        if (!this.io || !sessionId) { return false; }

        const room = this.io.in(this.roomBySessionId(sessionId));
        room.emit(this.socketEvents.sessionEnd, payload);

        setTimeout(() => {
            room.disconnectSockets(true);
        }, this.disconnectDelayMs);

        return true;
    }

    autoCleanup(interval) {
        if (typeof this.store?.autoCleanup !== "function") { return undefined; }
        return this.store.autoCleanup(interval);
    }
}

