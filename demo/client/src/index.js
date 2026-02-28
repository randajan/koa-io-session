import { info } from "@randajan/simple-lib/web";
import { io } from "socket.io-client";


const serverOrigin = `${window.location.protocol}//${window.location.hostname}:${info.port + 1}`;

const state = {
    socketConnected: false,
    socketTransport: null,
    lastHttp: null,
    lastWs: null
};

const lines = [];

const root = document.getElementById("root");
root.innerHTML = `
<main class="demo">
  <h1>koa-io-session demo</h1>
  <p id="status"></p>
  <div class="controls">
    <button id="http-read">HTTP read</button>
    <button id="http-inc">HTTP +1</button>
    <button id="ws-read">WS read</button>
    <button id="ws-inc">WS +1</button>
  </div>
  <div class="controls">
    <input id="user-input" maxlength="32" placeholder="user name" value="guest" />
    <button id="http-user">Set user by HTTP</button>
    <button id="ws-user">Set user by WS</button>
    <button id="reset-all">Reset</button>
  </div>
  <pre id="snapshot"></pre>
  <pre id="log"></pre>
</main>
`;

const style = document.createElement("style");
style.textContent = `
body { margin: 0; font-family: "Segoe UI", sans-serif; background: #f2f4f8; color: #1b2430; }
.demo { max-width: 980px; margin: 0 auto; padding: 20px; }
h1 { margin: 0 0 12px; font-size: 24px; }
#status { margin: 0 0 12px; font-weight: 600; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
button { border: 0; border-radius: 8px; padding: 8px 12px; background: #0f62fe; color: #fff; cursor: pointer; }
button:hover { background: #0043ce; }
input { border: 1px solid #c7d2e1; border-radius: 8px; padding: 8px 10px; min-width: 180px; }
pre { background: #fff; border: 1px solid #d8e0eb; border-radius: 10px; padding: 12px; overflow: auto; }
#log { max-height: 220px; }
`;
document.head.appendChild(style);

const $status = document.getElementById("status");
const $snapshot = document.getElementById("snapshot");
const $log = document.getElementById("log");
const $userInput = document.getElementById("user-input");


const socket = io(serverOrigin, {
    autoConnect: false,
    withCredentials: true,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity
});
let isSessionDestroyRecovery = false;

const appendLog = (message, payload) => {
    const stamp = new Date().toISOString().slice(11, 19);
    const suffix = payload ? ` ${JSON.stringify(payload)}` : "";
    lines.unshift(`[${stamp}] ${message}${suffix}`);
    if (lines.length > 14) { lines.length = 14; }
    $log.textContent = lines.join("\n");
};

const render = () => {
    const httpId = state.lastHttp?.sessionId ?? null;
    const wsId = state.lastWs?.sessionId ?? null;
    const sameSession = Boolean(httpId && wsId && httpId === wsId);

    $status.textContent = `Server ${serverOrigin} | socket ${state.socketConnected ? "connected" : "disconnected"}${state.socketTransport ? ` (${state.socketTransport})` : ""}`;
    $snapshot.textContent = JSON.stringify({
        sessionId: { http: httpId, ws: wsId, match: sameSession },
        http: state.lastHttp,
        ws: state.lastWs
    }, null, 2);
};

const httpAction = async (action, params = {}) => {
    const url = new URL(`${serverOrigin}/api/session`);
    url.searchParams.set("action", action);
    for (const [k, v] of Object.entries(params)) {
        if (v != null) { url.searchParams.set(k, String(v)); }
    }

    const response = await fetch(url, { credentials: "include" });
    const payload = await response.json();
    state.lastHttp = payload;
    render();
    appendLog(`HTTP ${action}`, payload);
    return payload;
};

const wsAction = async (eventName, ...args) => {
    if (!socket.connected) {
        throw new Error("Socket is disconnected");
    }

    return new Promise((resolve, reject) => {
        socket.timeout(3000).emit(eventName, ...args, (err, payload) => {
            if (err) {
                reject(err);
                return;
            }
            state.lastWs = payload;
            render();
            appendLog(`WS ${eventName}`, payload);
            resolve(payload);
        });
    });
};

const recoverFromSessionDestroy = async () => {
    if (isSessionDestroyRecovery) { return; }
    isSessionDestroyRecovery = true;

    appendLog("WS session:destroy");
    try {
        await httpAction("read");
    } catch (err) {
        appendLog("Session bootstrap error", { error: String(err) });
    }

    if (socket.connected) { socket.disconnect(); }
    appendLog("WS reconnect attempt");
    socket.connect();
    isSessionDestroyRecovery = false;
};

socket.on("connect", () => {
    state.socketConnected = true;
    state.socketTransport = socket.io.engine.transport.name;
    render();
    appendLog("WS connected");
});

socket.on("disconnect", (reason) => {
    state.socketConnected = false;
    state.socketTransport = null;
    render();
    appendLog(`WS disconnected (${reason})`);
});

socket.on("connect_error", (err) => {
    appendLog("WS connect_error", { error: err?.message || String(err) });
});

socket.on("session:destroy", recoverFromSessionDestroy);

socket.on("session:state", (payload) => {
    state.lastWs = payload;
    render();
    appendLog("WS state push", payload);
});


document.getElementById("http-read").addEventListener("click", async () => {
    try { await httpAction("read"); } catch (err) { appendLog("HTTP read error", { error: String(err) }); }
});

document.getElementById("http-inc").addEventListener("click", async () => {
    try { await httpAction("http-inc"); } catch (err) { appendLog("HTTP inc error", { error: String(err) }); }
});

document.getElementById("http-user").addEventListener("click", async () => {
    try { await httpAction("set-user", { name: $userInput.value }); } catch (err) { appendLog("HTTP set-user error", { error: String(err) }); }
});

document.getElementById("ws-read").addEventListener("click", async () => {
    try { await wsAction("session:get"); } catch (err) { appendLog("WS read error", { error: String(err) }); }
});

document.getElementById("ws-inc").addEventListener("click", async () => {
    try { await wsAction("session:inc"); } catch (err) { appendLog("WS inc error", { error: String(err) }); }
});

document.getElementById("ws-user").addEventListener("click", async () => {
    try { await wsAction("session:set-user", $userInput.value); } catch (err) { appendLog("WS set-user error", { error: String(err) }); }
});

document.getElementById("reset-all").addEventListener("click", async () => {
    try {
        await httpAction("reset");
    } catch (err) {
        appendLog("Reset error", { error: String(err) });
    }
});


const init = async () => {
    render();
    try {
        await httpAction("read");
    } catch (err) {
        appendLog("Initial HTTP read error", { error: String(err) });
    }
    socket.connect();
};

init();
