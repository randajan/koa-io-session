const validateStore = (store) => {
    const missing = [];
    if (typeof store?.get !== "function") { missing.push("get()"); }
    if (typeof store?.set !== "function") { missing.push("set()"); }
    if (typeof store?.destroy !== "function") { missing.push("destroy()"); }
    if (typeof store?.touch !== "function") { missing.push("touch()"); }
    if (typeof store?.on !== "function") { missing.push("on()"); }

    if (missing.length) {
        throw new TypeError(`attachSession options.store is missing required API: ${missing.join(", ")}`);
    }
};

export const wrapStore = (store)=>{
    validateStore(store);
    return {
        get:store.get.bind(store),
        set:store.set.bind(store),
        destroy:store.destroy.bind(store),
        touch:store.touch.bind(store)
    }
}

export const wrapExternalKey = (opt, onSet) => {
    const { externalKey: base, key, signed } = opt;

    const get = base?.get
        ? (ctx) => base.get(ctx)
        : (ctx) => ctx.cookies.get(key, { signed });

    const setRaw = base?.set
        ? (ctx, sid) => base.set(ctx, sid)
        : (ctx, sid) => ctx.cookies.set(key, sid, opt);

    const set = typeof onSet != "function"
        ? setRaw
        : (ctx, sid) => {
            setRaw(ctx, sid);     // reálný zápis SID
            onSet(ctx, sid);    // tvůj hook
        };

    return { get, set };
};
