

export const wrapStore = (store)=>{
    return {
        get:store.get.bind(store),
        set:store.set.bind(store),
        destroy:store.destroy.bind(store)
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
