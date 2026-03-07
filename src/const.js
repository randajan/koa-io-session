export const _errPrefix = "[koa-io-session]";

export const ms = {
    s:(v=1)=>v*1000,
    m:(v=1)=>ms.s(v*60),
    h:(v=1)=>ms.m(v*60),
    d:(v=1)=>ms.h(v*24),
    w:(v=1)=>ms.d(v*7),
    M:(v=1)=>ms.d(v*30),
    y:(v=1)=>ms.d(v*365)
}

export const _customOptKeys = new Set([
    "store",
    "autoCleanup",
    "autoCleanupMs",
    "clientKey",
    "clientMaxAge",
    "clientAlwaysRoll"
]);

export const _privs = new WeakMap();