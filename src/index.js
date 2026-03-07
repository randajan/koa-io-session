import { SessionBridge } from "./class/SessionBridge.js";
import { ms } from "./const.js";
import { LiveStore } from "./stores/LiveStore.js";
import { generateUid } from "./tools.js";


const bridgeSession = (app, io, opt = {}) => new SessionBridge(app, io, opt);

export default bridgeSession;

export {
    ms,
    bridgeSession,
    generateUid,
    LiveStore,
    SessionBridge
}
