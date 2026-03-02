import { SessionBridge } from "./class/SessionBridge.js";
import { SessionStore } from "./class/SessionStore.js";
import { generateUid } from "./tools.js";


const bridgeSession = (app, io, opt = {}) => new SessionBridge(app, io, opt);

export default bridgeSession;

export {
    bridgeSession,
    generateUid,
    SessionStore,
    SessionBridge
}
