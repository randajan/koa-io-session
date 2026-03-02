export const ms = {
    s:v=>v*1000,
    m:v=>ms.s(v*60),
    h:v=>ms.m(v*60),
    d:v=>ms.h(v*24),
    w:v=>ms.d(v*7),
    M:v=>ms.d(v*30),
    y:v=>ms.d(v*365)
}

export const _defaultOpt = {
    cleanupInterval: undefined,
    clientMaxAge: 365 * 24 * 60 * 60 * 1000,
    socketTouchSoftMs: 1_000,
    socketTouchHardMs: 5_000
};

export const _customOptKeys = new Set([
    "store",
    "cleanupInterval",
    "clientKey",
    "clientMaxAge",
    "clientAlwaysRoll",
    "socketTouch",
    "socketTouchSoftMs",
    "socketTouchHardMs"
]);