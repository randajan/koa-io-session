import { SessionBridge } from "./class/SessionBridge.js";
import { SessionStore } from "./class/SessionStore.js";
import { LiveStore } from "./stores/LiveStore.js";
import { FileStore } from "./stores/FileStore.js";
import { generateUid } from "./tools.js";


const bridgeSession = (app, io, opt = {}) => new SessionBridge(app, io, opt);

export default bridgeSession;

export {
    bridgeSession,
    generateUid,
    LiveStore,
    FileStore,
    SessionStore,
    SessionBridge
}
