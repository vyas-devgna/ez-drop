// --- APP CONSTANTS & ALGORITHMS ---
const APP_VERSION = "1.3.0";
const DEBUG_LOGS = false;
// Files above this size are streamed straight to disk via the File System
// Access API (when available) instead of being buffered in RAM.
const STREAM_SAVE_THRESHOLD = 128 * 1024 * 1024;
const CHUNK_SIZE = 64 * 1024; // Robust 64KB Packets
const LAN_CHUNK_SIZE = 256 * 1024;
const MAX_BUFFERED_AMOUNT = 1024 * 1024;
const LOW_BUFFERED_AMOUNT = 256 * 1024;
const LAN_MAX_BUFFERED_AMOUNT = 16 * 1024 * 1024;
const LAN_LOW_BUFFERED_AMOUNT = 4 * 1024 * 1024;
const DB_NAME = "ezdrop-db";
const DB_VERSION = 1;
const SHARE_STORE = "shared_items";
const HISTORY_STORE = "history";
const PEERS_STORE = "known_peers";
const MAX_HISTORY_ITEMS = 80;
const MAX_EAGER_CHECKSUM_SIZE = 512 * 1024 * 1024;
const PEER_PREFIX = "ezdrop-";
const ROOM_PREFIX = "ezdrop-room-";

const ANIMAL_NAMES = [
  "Blue Fox", "Paper Tiger", "Neon Panda", "Quiet Falcon", "Golden Otter",
  "Copper Owl", "Silver Lynx", "Velvet Sloth", "Iron Badger", "Bronze Beaver",
  "Cobalt Koala", "Onyx Panther", "Amber Squirrel", "Vivid Peacock", "Prism Rabbit"
];

// --- APPLICATION CENTRALIZED STATE ---
const state = {
  identity: { name: "", id: "" },
  roomCode: "",
  shareUrl: "",
  peer: null,               // PeerJS Instance
  conn: null,               // Current active PeerJS DataConnection
  connectedPeer: null,      // Name / Metadata details of active Peer
  connectionState: "DISCONNECTED", // DISCONNECTED, CREATING, WAITING, CONNECTING, INVITING, PASSWORD_CHECK, CONNECTED, ERROR
  passwordEnabled: false,
  passphrase: "",
  soundEnabled: false,
  installPrompt: null,      // PWA deferred prompt
  outgoingTransfers: new Map(), // transferId -> State Obj
  incomingTransfers: new Map(), // transferId -> State Obj
  textHistory: [],
  fileHistory: [],
  queuedShare: null,
  nearbyDevices: new Map(),
  latency: 0,
  pingIntervalId: null,
  networkPath: { mode: "unknown", detail: "Route: detecting", monitorId: null, remoteMode: "unknown" },
  wakeLock: null,
  scannerInstance: null,
  debugActive: false,
  debugNodes: {
    A: { name: "Copper Fox", incoming: new Map(), outgoing: new Map() },
    B: { name: "Neon Owl", incoming: new Map(), outgoing: new Map() }
  }
};

function getAppBasePath() {
  const pathname = window.location.pathname;
  return pathname.endsWith('/') ? pathname : pathname.slice(0, pathname.lastIndexOf('/') + 1);
}

function refreshIcons() {
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function debugLog(...args) {
  if (DEBUG_LOGS) console.log(...args);
}

// --- SERVICE WORKER & DYNAMIC MANIFEST REGISTRATION ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Build base path dynamically to avoid breaking under custom GitHub Pages subfolders
    const basePath = getAppBasePath();
    const swUrl = basePath + 'sw.js';
    
    navigator.serviceWorker.register(swUrl, { scope: basePath })
      .then(reg => {
        debugLog('ez-drop Service Worker successfully registered with scope:', reg.scope);
        const statusTag = document.getElementById("pwa-status-tag");
        if (statusTag) {
          statusTag.textContent = "Offline Ready";
          statusTag.className = "bg-[#1F8A4C] text-white px-2 py-0.5 rounded-sm uppercase text-[9px] font-bold";
        }
      })
      .catch(err => {
        console.warn('Service Worker registration skipped or failed:', err);
      });
  });
}

// Dynamic Manifest Injection (Fixed start_url and scope warning)
const absoluteStartUrl = window.location.origin + window.location.pathname;
const basePath = getAppBasePath();
const appScopeUrl = window.location.origin + basePath;
const logoUrl = window.location.origin + basePath + 'assets/logo.png';

const manifest = {
  name: "ez-drop P2P Sharing Tool",
  short_name: "ez-drop",
  start_url: absoluteStartUrl,
  scope: appScopeUrl,
  display: "standalone",
  background_color: "#F9F8F6",
  theme_color: "#F9F8F6",
  icons: [
    {
      src: logoUrl,
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: logoUrl,
      sizes: "512x512",
      type: "image/png"
    }
  ],
  share_target: {
    action: basePath + "share-target",
    method: "POST",
    enctype: "multipart/form-data",
    params: {
      title: "title",
      text: "text",
      url: "url",
      files: [
        {
          name: "files",
          accept: ["*/*"]
        }
      ]
    }
  }
};
const blobManifest = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = URL.createObjectURL(blobManifest);
document.head.appendChild(manifestLink);

// --- WEB AUDIO SYNTHESIZER SOUND ENGINE ---
let audioCtx = null;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!state.soundEnabled) return;
  try {
    initAudioContext();
    const now = audioCtx.currentTime;

    if (type === "connect") {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "complete") {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "error") {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220.00, now); // A3
      osc.frequency.linearRampToValueAtTime(110.00, now + 0.25);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    console.error("Audio synthesizer exception captured:", err);
  }
}

// --- LIFE CYCLE & IDENTITY MANAGEMENT ---
window.addEventListener("DOMContentLoaded", async () => {
  // 1. Initialize user device name details
  restoreDeviceIdentity();
  initLocalDiscovery();
  await hydrateShareTargetQueue();
  await restoreHistoryRecords();

  // 2. Render Lucide Icons
  refreshIcons();

  // 3. Listen to PWA hooks
  setupPwaHooks();

  // 4. Parse search params in URL automatically
  const params = new URLSearchParams(window.location.search);
  const incomingRoom = params.get("r");

  if (incomingRoom && incomingRoom.match(/^\d{5}$/)) {
    // Target incoming auto room setup
    state.roomCode = generateRandomRoomCode();
    initPeerSession(incomingRoom);
  } else {
    // Normal host init
    state.roomCode = generateRandomRoomCode();
    initPeerSession();
  }

  // 5. Bind Drag and Drop listeners
  setupDragAndDrop();

  // 6. Test for native share
  if (navigator.share) {
    const shareBtn = document.getElementById("native-share-btn");
    shareBtn.removeAttribute("disabled");
    shareBtn.classList.remove("opacity-50", "cursor-not-allowed");
  }

  // 7. Accessibility setup: keyboard trap/escape listeners
  setupAccessibilityEscListeners();
  setupMobileLifecycleHooks();

  // 8. Bind menu device name change handler
  const menuDeviceNameInput = document.getElementById("menu-device-name");
  if (menuDeviceNameInput) {
    menuDeviceNameInput.addEventListener("change", (e) => {
      updateDeviceName(e.target.value);
    });
  }
});

function generateRandomRoomCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function restoreDeviceIdentity() {
  let savedName = safeStorageGet("ezdrop_name");
  if (!savedName || savedName.trim() === "") {
    const idx = Math.floor(Math.random() * ANIMAL_NAMES.length);
    savedName = ANIMAL_NAMES[idx];
    safeStorageSet("ezdrop_name", savedName);
  }
  state.identity.name = savedName;

  const mainInput = document.getElementById("device-name-input");
  if (mainInput) {
    mainInput.value = savedName;
  }

  const menuInput = document.getElementById("menu-device-name");
  if (menuInput) {
    menuInput.value = savedName;
  }

  const heroText = document.getElementById("hero-device-name-text");
  if (heroText) heroText.textContent = savedName;

  // Pick a hero glyph matching the device class before Lucide hydrates.
  const heroIcon = document.getElementById("hero-device-icon");
  if (heroIcon) heroIcon.setAttribute("data-lucide", isMobileDevice() ? "smartphone" : "laptop");
}

function updateDeviceName(newName) {
  if (!newName || newName.trim() === "") return;
  const sanitized = escapeHtml(newName.trim());
  state.identity.name = sanitized;
  safeStorageSet("ezdrop_name", sanitized);
  
  const mainInput = document.getElementById("device-name-input");
  if (mainInput) {
    mainInput.value = sanitized;
  }
  
  const menuInput = document.getElementById("menu-device-name");
  if (menuInput) {
    menuInput.value = sanitized;
  }

  const heroText = document.getElementById("hero-device-name-text");
  if (heroText) heroText.textContent = sanitized;

  if (state.conn && state.connectionState === "CONNECTED") {
    state.conn.send({
      type: "peer-status",
      payload: { name: sanitized }
    });
  }
}

// --- HOME SCREEN: inline rename + internet share toggle ---
function startHeroNameEdit() {
  const wrap = document.getElementById("hero-name-wrap");
  if (!wrap || wrap.querySelector("input")) return;

  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 24;
  input.value = state.identity.name;
  input.className = "hero-name-input";
  input.setAttribute("aria-label", "Device name");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = state.identity.name;
      input.blur();
    }
  });
  input.addEventListener("blur", () => {
    updateDeviceName(input.value.trim() || state.identity.name);
    rebuildHeroNameButton();
  });

  wrap.innerHTML = "";
  wrap.appendChild(input);
  input.focus();
  input.select();
}

function rebuildHeroNameButton() {
  const wrap = document.getElementById("hero-name-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<button id="hero-device-name" onclick="startHeroNameEdit()" class="hero-name-btn serif-display text-2xl font-bold tracking-tight" title="Rename this device"><span id="hero-device-name-text">${escapeHtml(state.identity.name)}</span><i data-lucide="pencil-line" class="w-4 h-4 opacity-60"></i></button>`;
  refreshIcons();
}

function toggleInternetShare(force) {
  const panel = document.getElementById("internet-share-panel");
  const btn = document.getElementById("internet-share-toggle");
  if (!panel || !btn) return;
  const open = typeof force === "boolean" ? force : !panel.classList.contains("open");
  panel.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", String(open));
  btn.classList.toggle("bg-[var(--yellow)]", open);
  btn.classList.toggle("bg-[var(--surface-warm)]", !open);
}

async function initLocalDiscovery() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    const publicIp = data.ip;
    
    // Hash IP to create a topic
    const encoder = new TextEncoder();
    const rawData = encoder.encode(publicIp + "ezdrop-discovery");
    const hashBuffer = await crypto.subtle.digest('SHA-256', rawData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const topic = "ezdrop/local/" + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    
    if (typeof mqtt === "undefined") {
      console.warn("MQTT library not loaded.");
      return;
    }
    
    const client = mqtt.connect("wss://test.mosquitto.org:8081/mqtt");
    state.mqttClient = client;
    state.discoveryTopic = topic;

    client.on("connect", () => {
      client.subscribe(topic);
      // Announce immediately so peers see us without waiting a full beacon cycle.
      publishPresence();
      setInterval(publishPresence, 5000);
    });

    state.nearbyDevices = new Map();
    client.on("message", (t, message) => {
      if (t === topic) {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.peerId && payload.peerId !== state.peer?.id) {
            state.nearbyDevices.set(payload.peerId, payload);
            renderNearbyDevices();
          }
        } catch (e) {}
      }
    });
    
    // Cleanup old devices
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, dev] of state.nearbyDevices.entries()) {
        if (now - dev.timestamp > 15000) {
          state.nearbyDevices.delete(id);
          changed = true;
        }
      }
      if (changed) renderNearbyDevices();
    }, 5000);
    
  } catch (err) {
    console.warn("Local discovery failed:", err);
    document.querySelectorAll(".nearby-devices-container").forEach(c => {
      c.innerHTML = `<div class="nearby-empty"><span class="text-[var(--red)]">Auto-discovery is unavailable right now.</span><span class="text-[10px] opacity-75">Use the code or QR under the Internet button instead.</span></div>`;
    });
  }
}

function publishPresence() {
  const client = state.mqttClient;
  if (!client || !client.connected || !state.discoveryTopic) return;
  if (!state.peer || state.peer.disconnected || state.connectionState === "CONNECTED") return;
  client.publish(state.discoveryTopic, JSON.stringify({
    peerId: state.peer.id,
    name: state.identity.name,
    timestamp: Date.now()
  }));
}

function renderNearbyDevices() {
  const containers = document.querySelectorAll(".nearby-devices-container");
  if (!containers.length) return;

  if (!state.nearbyDevices || state.nearbyDevices.size === 0) {
    containers.forEach(container => {
      container.innerHTML = `<div class="nearby-empty">
        <div class="nearby-sweep" aria-hidden="true"></div>
        <span>Scanning your network…</span>
        <span class="text-[10px] opacity-75">Open ez-drop on another device on this Wi-Fi and it will appear here.</span>
      </div>`;
    });
    return;
  }

  containers.forEach(container => {
    container.innerHTML = "";
    state.nearbyDevices.forEach(peer => {
      const item = document.createElement("button");
      item.className = "nearby-item brutal-btn-sm bg-[var(--surface-warm)] p-3 text-left font-mono-custom text-xs flex items-center gap-3 w-full";
      item.onclick = () => connectToNearbyPeer(peer.peerId);
      item.innerHTML = `<span class="file-kind-icon"><i data-lucide="monitor-smartphone" class="w-4 h-4"></i></span>
        <span class="min-w-0 flex-grow"><strong class="truncate" style="display:block">${escapeHtml(peer.name)}</strong><span class="text-[9px] text-[var(--muted)]">On your network • tap to connect</span></span>
        <span class="text-[9px] uppercase bg-[var(--ink)] text-white px-2 py-1 shrink-0">Connect</span>`;
      container.appendChild(item);
    });
  });
  refreshIcons();
}

function connectToNearbyPeer(peerId) {
  if (!peerId || !state.peer) {
    showGlobalAlert("Peer is not available yet. Please wait.", "error");
    return;
  }
  renderAppByState("CONNECTING", "Calling nearby device...");
  initiateDirectHandshake(peerId);
}

function regenerateIdentityName() {
  const idx = Math.floor(Math.random() * ANIMAL_NAMES.length);
  updateDeviceName(ANIMAL_NAMES[idx]);
}

// --- UTILITIES ---
function sanitizeFileName(name) {
  const base = String(name || "download").split(/[\\/]/).pop();
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 180) || "download";
}

function getFileKindIcon(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (/^(png|jpe?g|gif|webp|avif|svg|heic|bmp|ico)$/.test(ext)) return "image";
  if (/^(mp4|mov|webm|mkv|avi|m4v)$/.test(ext)) return "video";
  if (/^(mp3|wav|flac|ogg|m4a|aac|opus)$/.test(ext)) return "music";
  if (/^(zip|rar|7z|tar|gz|bz2|xz)$/.test(ext)) return "archive";
  if (/^(pdf|docx?|txt|md|rtf|pptx?|xlsx?|csv|epub)$/.test(ext)) return "file-text";
  if (/^(js|ts|jsx|tsx|html|css|json|py|java|c|cpp|h|sh|go|rs|rb|php)$/.test(ext)) return "file-code";
  return "file";
}

function formatEta(seconds) {
  if (!isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function hapticTap(pattern = 15) {
  try {
    navigator.vibrate?.(pattern);
  } catch (err) {
    // Vibration is best-effort feedback only.
  }
}

function countActiveTransfers() {
  const isActive = t => ["WAITING_ACCEPT", "QUEUED", "SENDING", "RECEIVING"].includes(t.status);
  return Array.from(state.outgoingTransfers.values()).filter(isActive).length
    + Array.from(state.incomingTransfers.values()).filter(isActive).length;
}

function updateAppBadge() {
  if (!("setAppBadge" in navigator)) return;
  const activeCount = countActiveTransfers();
  const op = activeCount ? navigator.setAppBadge(activeCount) : navigator.clearAppBadge();
  op?.catch?.(() => {});
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (m) {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
    }
  });
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn("Local storage unavailable:", err);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn("Local storage write skipped:", err);
  }
}

async function hydrateShareTargetQueue() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("share-error") === "1") {
    showGlobalAlert("The OS share payload could not be imported. Try selecting fewer or smaller files.", "error");
    history.replaceState(null, "", window.location.pathname);
    return;
  }
  const shareId = params.get("shared");
  if (!shareId) {
    renderQueuedShare();
    return;
  }

  try {
    const record = await getRecord(SHARE_STORE, shareId);
    if (record) {
      state.queuedShare = record;
      renderQueuedShare();
      showGlobalAlert("Shared items are queued. Choose or connect to a device to send them.", "info");
      history.replaceState(null, "", window.location.pathname);
    }
  } catch (err) {
    console.error("Unable to restore shared items:", err);
    showGlobalAlert("Could not load the shared items from the OS share sheet.", "error");
  }
}

async function restoreHistoryRecords() {
  try {
    const records = (await getAllRecords(HISTORY_STORE)).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_HISTORY_ITEMS);
    const histContainer = document.getElementById("history-container");
    if (!histContainer || records.length === 0) return;
    histContainer.innerHTML = "";
    records.reverse().forEach(record => renderHistoryRecord(record, { prepend: true, persist: false }));
  } catch (err) {
    debugLog("History restore skipped:", err);
  }
}

function renderQueuedShare() {
  const panel = document.getElementById("share-target-panel");
  const summary = document.getElementById("share-target-summary");
  const fileList = document.getElementById("share-target-files");
  if (!panel || !summary || !fileList) return;

  if (!state.queuedShare) {
    panel.classList.add("hidden");
    fileList.innerHTML = "";
    return;
  }

  const files = state.queuedShare.files || [];
  const textParts = [state.queuedShare.title, state.queuedShare.text, state.queuedShare.url].filter(Boolean);
  const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
  summary.textContent = `${files.length} file${files.length === 1 ? "" : "s"}${totalBytes ? ` (${formatBytes(totalBytes)})` : ""}${textParts.length ? " plus text/link" : ""}`;
  fileList.innerHTML = "";
  files.slice(0, 5).forEach(file => {
    const row = document.createElement("div");
    row.className = "flex justify-between gap-2";
    row.innerHTML = `<span class="truncate">${escapeHtml(file.name)}</span><span>${formatBytes(file.size || 0)}</span>`;
    fileList.appendChild(row);
  });
  if (files.length > 5) {
    const more = document.createElement("div");
    more.textContent = `+${files.length - 5} more file(s)`;
    fileList.appendChild(more);
  }
  panel.classList.remove("hidden");
}

async function clearQueuedShare() {
  const id = state.queuedShare?.id;
  state.queuedShare = null;
  renderQueuedShare();
  if (id) {
    try {
      await deleteRecord(SHARE_STORE, id);
    } catch (err) {
      debugLog("Queued share delete skipped:", err);
    }
  }
}

async function sendQueuedShareToCurrentPeer() {
  if (!state.queuedShare || !state.conn || state.connectionState !== "CONNECTED") return;
  const queued = state.queuedShare;
  const textParts = [queued.title, queued.text, queued.url].filter(Boolean);

  if (textParts.length) {
    const text = textParts.join("\n");
    state.conn.send({
      type: "text",
      from: state.identity.name,
      payload: { text }
    });
    appendChatBubble(state.identity.name, text, true);
    addHistoryRecord("shared-text", `Shared text/link (${text.substring(0, 30)}...)`, true);
  }

  for (const file of queued.files || []) {
    await initiateOutgoingFileTransfer(file);
  }

  await clearQueuedShare();
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia("(pointer: coarse)").matches;
}

function openEzDropDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SHARE_STORE)) {
        db.createObjectStore(SHARE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbRequest(storeName, mode, operation) {
  const db = await openEzDropDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function putRecord(storeName, value) {
  return dbRequest(storeName, "readwrite", store => store.put(value));
}

function getRecord(storeName, id) {
  return dbRequest(storeName, "readonly", store => store.get(id));
}

function deleteRecord(storeName, id) {
  return dbRequest(storeName, "readwrite", store => store.delete(id));
}

async function getAllRecords(storeName) {
  return dbRequest(storeName, "readonly", store => store.getAll());
}

function getPreferredChunkSize() {
  return state.networkPath.mode === "lan" ? LAN_CHUNK_SIZE : CHUNK_SIZE;
}

async function computeBlobSha256(blob) {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function getMaxBufferedAmount() {
  return state.networkPath.mode === "lan" ? LAN_MAX_BUFFERED_AMOUNT : MAX_BUFFERED_AMOUNT;
}

function getLowBufferedAmount() {
  return state.networkPath.mode === "lan" ? LAN_LOW_BUFFERED_AMOUNT : LOW_BUFFERED_AMOUNT;
}

function showGlobalAlert(msg, type = "error") {
  const bar = document.getElementById("global-alert");
  const txt = document.getElementById("global-alert-text");
  txt.textContent = msg;
  bar.classList.remove("hidden");
  if (type === "error") {
    bar.className = "brutal-border bg-[var(--correction)] text-black p-3 text-center font-mono-custom text-xs relative z-50 font-bold";
  } else {
    bar.className = "brutal-border bg-[var(--ok)] text-white p-3 text-center font-mono-custom text-xs relative z-50 font-bold";
  }
}

// Helper functions for alerts and platform parameters
function hideGlobalAlert() {
  document.getElementById("global-alert").classList.add("hidden");
}

function copyShareLink() {
  const textToCopy = state.shareUrl;
  const copyBtn = document.getElementById("copy-btn-text");

  const markCopied = () => {
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy Link";
    }, 1500);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then(markCopied).catch(() => fallbackCopyText(textToCopy, markCopied));
    return;
  }

  fallbackCopyText(textToCopy, markCopied);
}

function fallbackCopyText(textToCopy, onSuccess) {
  const el = document.createElement('textarea');
  el.value = textToCopy;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  onSuccess();
}

function triggerNativeShare() {
  if (navigator.share) {
    navigator.share({
      title: 'ez-drop P2P Transfer',
      text: `Connect directly to my ez-drop workspace to exchange data.`,
      url: state.shareUrl
        }).catch(err => {
          debugLog("Native share cancelled.", err);
        });
  }
}

// --- PWA INSTANT PROMPT CAPABILITIES ---
function setupPwaHooks() {
  window.addEventListener('beforeinstallprompt', (e) => {
    state.installPrompt = e;
    const installBtn = document.getElementById("pwa-install-btn");
    if (installBtn) {
      installBtn.removeAttribute("disabled");
      installBtn.classList.remove("opacity-50", "cursor-not-allowed");
    }
  });

  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    debugLog("PWA application installed successfully");
  });
}

function triggerPwaInstall() {
  if (state.installPrompt) {
    const promptEvent = state.installPrompt;
    state.installPrompt = null;
    promptEvent.prompt();
    promptEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        debugLog('User completed PWA installation prompt');
      }
      const installBtn = document.getElementById("pwa-install-btn");
      if (installBtn) {
        installBtn.setAttribute("disabled", "");
        installBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
    }).catch(() => {
      showGlobalAlert("Install prompt is no longer available. Use your browser menu to install ez-drop.", "info");
    });
  } else {
    // Fallback for unsupported devices (progressive manual instructions)
    let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      showGlobalAlert("Install Guide (iOS): Tap the Share icon, then select 'Add to Home Screen'.", "info");
    } else {
      showGlobalAlert("Install Guide (Desktop/Android): Open the browser Menu > Install ez-drop / Add to Home screen.", "info");
    }
  }
}

// --- ACCESSIBILITY FOCUS / INTERACT MECHANICS ---
function setupAccessibilityEscListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Close all modals or sheets
      document.getElementById("side-menu").classList.add("hidden");
      closeQRScanner();
      document.getElementById("invite-modal").classList.add("hidden");
      toggleDebugMode(false);
    }
  });
}

function setupMobileLifecycleHooks() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && hasActiveTransfers()) {
      requestTransferWakeLock();
    }
  });

  window.addEventListener("pagehide", () => {
    releaseTransferWakeLock();
  });

  // Guard against accidentally killing live transfers with a tab close.
  window.addEventListener("beforeunload", (e) => {
    if (hasActiveTransfers()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

async function requestNotificationAccess() {
  if (!("Notification" in window)) {
    showGlobalAlert("Notifications are not available in this browser.", "error");
    return;
  }

  const result = await Notification.requestPermission();
  showGlobalAlert(result === "granted" ? "Transfer notifications enabled." : "Notifications were not enabled.", result === "granted" ? "info" : "error");
}

async function notifyUser(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: "assets/logo.png",
        badge: "assets/logo.png",
        tag: "ez-drop-transfer"
      });
    } else {
      new Notification(title, { body, icon: "assets/logo.png" });
    }
  } catch (err) {
    debugLog("Notification skipped:", err);
  }
}

// --- SLIDEOVER SIDE MENU CONTROLS ---
function toggleMenu() {
  const menu = document.getElementById("side-menu");
  if (menu.classList.contains("hidden")) {
    menu.classList.remove("hidden");
    document.getElementById("close-menu-btn").focus();
  } else {
    menu.classList.add("hidden");
  }
}

function closeMenuOnOutsideClick(event) {
  toggleMenu();
}

function showMenuSection(id) {
  const element = document.getElementById(`menu-${id}`);
  if (element) {
    element.setAttribute("open", "true");
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function toggleSoundPreference() {
  state.soundEnabled = !state.soundEnabled;
  const btn = document.getElementById("sound-toggle");
  if (state.soundEnabled) {
    btn.textContent = "ENABLED";
    btn.className = "brutal-btn-sm bg-[var(--yellow)] px-3 py-1 text-xs font-mono-custom font-bold uppercase audio-pulse";
    initAudioContext();
    playSound("connect");
  } else {
    btn.textContent = "MUTED";
    btn.className = "brutal-btn-sm bg-[var(--surface-warm)] px-3 py-1 text-xs font-mono-custom font-bold uppercase";
  }
}

function copyHelpToClipboard() {
  const text = "To exchange files, open ez-drop on both devices. On the connector client, enter the 5-digit code or scan the host's QR code. Agree to connect on the host's popup prompt.";
  navigator.clipboard.writeText(text).then(() => {
    showGlobalAlert("Help guide copied to clipboard!", "info");
  });
}

function factoryResetApp() {
  try {
    localStorage.clear();
  } catch (err) {
    console.warn("Local storage reset skipped:", err);
  }
  window.location.reload();
}

// --- SECURE CRYPTOGRAPHIC HANDSHAKE ---
async function hashChallenge(challenge, phrase) {
  const encoder = new TextEncoder();
  const rawData = encoder.encode(challenge + phrase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', rawData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function handlePassphraseChange(val) {
  state.passphrase = val;
  state.passwordEnabled = val.trim().length > 0;
  // Reflect the lock state on the menu trigger so users get clear feedback.
  const bar = document.getElementById("password-status-bar");
  if (bar) bar.classList.toggle("hidden", !state.passwordEnabled);
}

function disablePasswordMode() {
  document.getElementById("passphrase-input").value = "";
  handlePassphraseChange("");
}

// --- DYNAMIC APPLICATION STATE STATE-RENDER ---
function renderAppByState(targetState, diagnosticMsg = "") {
  const isStateChange = state.connectionState !== targetState;
  // Keep logical state synchronous even when the visual swap is deferred
  // into a view transition frame.
  state.connectionState = targetState;

  const apply = () => renderAppByStateImmediate(targetState, diagnosticMsg);
  if (
    isStateChange &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

function renderAppByStateImmediate(targetState, diagnosticMsg = "") {
  state.connectionState = targetState;

  // DOM target elements mapping
  const panels = {
    ready: document.getElementById("state-ready"),
    connecting: document.getElementById("state-connecting"),
    connected: document.getElementById("state-connected"),
    error: document.getElementById("state-error")
  };

  // Hide all panels initially
  Object.keys(panels).forEach(key => {
    if (panels[key]) panels[key].classList.add("hidden");
  });

  // Update header indicators
  const headerStatus = document.getElementById("header-status-lbl");
  const dot = document.getElementById("status-dot");
  const dotPulse = document.getElementById("status-dot-pulse");
  const ariaStatus = document.getElementById("aria-status");

  // Set class defaults
  dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--gold)]";
  dotPulse.className = "pulse-indicator absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-75";

  switch (targetState) {
    case "DISCONNECTED":
    case "READY":
      panels.ready.classList.remove("hidden");
      headerStatus.textContent = "Signaling Ready";
      dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-[#1F8A4C]";
      dotPulse.className = "pulse-indicator absolute inline-flex h-full w-full rounded-full bg-[#1F8A4C] opacity-75";
      ariaStatus.textContent = "Signaling ready to connect.";
      document.getElementById("ready-status-desc").textContent = "Online • visible to nearby devices";
      break;

    case "CONNECTING":
      panels.connecting.classList.remove("hidden");
      headerStatus.textContent = "Connecting";
      dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--yellow)]";
      dotPulse.className = "pulse-indicator absolute inline-flex h-full w-full rounded-full bg-[var(--yellow)] opacity-75";
      document.getElementById("connecting-state-desc").textContent = diagnosticMsg || "Connecting to target namespace...";
      ariaStatus.textContent = "Establishing client WebRTC session.";
      break;

    case "CONNECTED":
      panels.connected.classList.remove("hidden");
      headerStatus.textContent = "CONNECTED";
      dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-[#1F8A4C]";
      dotPulse.className = "pulse-indicator absolute inline-flex h-full w-full rounded-full bg-[#1F8A4C] opacity-75";
      ariaStatus.textContent = `Direct connection streaming active with peer.`;
      break;

    case "ERROR":
      panels.error.classList.remove("hidden");
      headerStatus.textContent = "OFFLINE/ERROR";
      dot.className = "relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--red)]";
      dotPulse.className = "pulse-indicator absolute inline-flex h-full w-full rounded-full bg-[var(--red)] opacity-75";
      document.getElementById("error-state-desc").textContent = diagnosticMsg || "WebRTC port connection failed.";
      ariaStatus.textContent = "Connection dropped. Try again.";
      break;
  }
}

// --- PEERJS ENGINE (WebRTC Coordination) ---
function initPeerSession(targetConnectCode = null) {
  // Robust guard if Brave Shields fully block the library CDN
  if (typeof Peer === "undefined") {
    renderAppByState("ERROR", "Dynamic WebRTC components (PeerJS) were blocked from loading. Please disable Brave Shields / Strict Adblocking on this domain to connect.");
    return;
  }

  if (state.peer) {
    state.peer.destroy();
  }

  // Explicitly determine host or joiner PeerJS ID structure
  const peerId = targetConnectCode ? `${PEER_PREFIX}peer-${Math.random().toString(36).substr(2, 6)}` : `${ROOM_PREFIX}${state.roomCode}`;

  state.peer = new Peer(peerId, {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    },
    debug: DEBUG_LOGS ? 1 : 0
  });

  state.peer.on("open", (id) => {
    debugLog("My PeerJS dynamic ID registered:", id);
    
    if (targetConnectCode) {
      renderAppByState("CONNECTING", `Directly calling Room Code ${targetConnectCode}...`);
      initiateDirectHandshake(`${ROOM_PREFIX}${targetConnectCode}`);
    } else {
      updateRoomTicket(state.roomCode);
      renderAppByState("READY");
    }
    publishPresence();
  });

  state.peer.on("connection", (incomingConn) => {
    // Multi-peer protection: Clean dead sessions if active connection exists
    if (state.conn) {
      incomingConn.close();
      return;
    }
    setupConnectionCallbacks(incomingConn, true);
  });

  state.peer.on("error", (err) => {
    console.error("PeerJS native error caught:", err.type, err);
    
    if (err.type === "unavailable-id") {
      // If the room code was taken, regenerate code *once* and retry
      state.roomCode = generateRandomRoomCode();
      initPeerSession();
    } else if (err.type === "peer-unavailable") {
      renderAppByState("ERROR", "Target room key not found. Verify the code on the host device.");
    } else {
      renderAppByState("ERROR", `Socket connection error: ${err.message}`);
    }
  });

  state.peer.on("disconnected", () => {
    console.warn("Peer service server disconnected. Retrying connection...");
    state.peer.reconnect();
  });
}

function initiateDirectHandshake(targetPeerId) {
  const options = { reliable: true };
  const activeConn = state.peer.connect(targetPeerId, options);
  setupConnectionCallbacks(activeConn, false);
}

function handleTargetInput(input) {
  // Clean target non-digits
  input.value = input.value.replace(/\D/g, '');
  if (input.value.length === 5) {
    connectToRoomBtn();
  }
}

function connectToRoomBtn() {
  const targetInput = document.getElementById("target-room-input").value.trim();
  if (!targetInput.match(/^\d{5}$/)) {
    showGlobalAlert("Verify Room Code: must consist of precisely 5 digits.", "error");
    return;
  }
  if (targetInput === state.roomCode) {
    showGlobalAlert("You cannot establish a WebRTC loopback with your own room code.", "error");
    return;
  }
  renderAppByState("CONNECTING", `Establishing encrypted channel with room ${targetInput}...`);
  initiateDirectHandshake(`${ROOM_PREFIX}${targetInput}`);
}

// --- RECONNECT & SESSION RECOVERY ---
function tryConnectionRecovery() {
  const targetInput = document.getElementById("target-room-input").value.trim();
  if (targetInput.match(/^\d{5}$/)) {
    connectToRoomBtn();
  } else {
    initPeerSession();
  }
}

function generateNewRoomSession() {
  state.roomCode = generateRandomRoomCode();
  initPeerSession();
}

// --- WEBRTC CONNECTION HANDLING PROTOCOL ---
let pendingInviteConnection = null;

function setupConnectionCallbacks(connInstance, isHost) {
  const handleOpen = () => {
    state.conn = connInstance;

    // Challenge-Proof Password Handshake Negotiation
    if (state.passwordEnabled) {
      const secretChallenge = Math.random().toString(36).substring(2, 10);
      connInstance.send({
        type: "password-challenge",
        from: state.identity.name,
        payload: { challenge: secretChallenge }
      });
      state.connectionState = "PASSWORD_CHECK";
      return;
    }

    if (isHost) {
      // Waiting for invite handshake info
      renderAppByState("CONNECTING", "Negotiating incoming verification handshake...");
    } else {
      // Client triggers connection handshake packet
      connInstance.send({
        type: "hello",
        from: state.identity.name,
        payload: { version: APP_VERSION }
      });
    }
  };

  // Fix PeerJS Race Condition where connInstance is already open when event handler binds
  if (connInstance.open) {
    handleOpen();
  } else {
    connInstance.on("open", handleOpen);
  }

  connInstance.on("data", (data) => {
    processIncomingMessage(data, connInstance);
  });

  connInstance.on("close", () => {
    handleDisconnectTransition();
  });

  connInstance.on("error", (err) => {
    console.error("Data channel err:", err);
    handleDisconnectTransition();
  });
}

function getPeerConnection(connInstance = state.conn) {
  if (!connInstance) return null;
  return connInstance.peerConnection || connInstance._pc || connInstance.pc || null;
}

function startNetworkPathMonitoring(connInstance = state.conn) {
  stopNetworkPathMonitoring();
  state.networkPath = {
    mode: "unknown",
    detail: "Checking selected WebRTC route...",
    monitorId: null,
    remoteMode: state.networkPath.remoteMode || "unknown"
  };
  renderNetworkPath();

  const pc = getPeerConnection(connInstance);
  if (!pc || typeof pc.getStats !== "function") {
    updateNetworkPath("unknown", "Route details unavailable in this browser.");
    return;
  }

  let attempts = 0;
  const inspect = async () => {
    attempts++;
    try {
      const result = await inspectSelectedCandidatePair(pc);
      if (result.mode !== "unknown" || attempts >= 12) {
        updateNetworkPath(result.mode, result.detail, { notifyPeer: true });
        stopNetworkPathMonitoring();
      }
    } catch (err) {
      debugLog("Route inspection skipped:", err);
      if (attempts >= 4) {
        updateNetworkPath("unknown", "Could not inspect the selected browser route.", { notifyPeer: true });
        stopNetworkPathMonitoring();
      }
    }
  };

  inspect();
  state.networkPath.monitorId = setInterval(inspect, 1500);
}

function stopNetworkPathMonitoring() {
  if (state.networkPath.monitorId) {
    clearInterval(state.networkPath.monitorId);
  }
  state.networkPath.monitorId = null;
}

async function inspectSelectedCandidatePair(pc) {
  const stats = await pc.getStats();
  let selectedPair = null;

  stats.forEach(report => {
    if (
      report.type === "candidate-pair" &&
      (report.selected || (report.nominated && report.state === "succeeded"))
    ) {
      selectedPair = report;
    }
  });

  if (!selectedPair) {
    stats.forEach(report => {
      if (!selectedPair && report.type === "transport" && report.selectedCandidatePairId) {
        selectedPair = stats.get(report.selectedCandidatePairId);
      }
    });
  }

  if (!selectedPair) {
    return { mode: "unknown", detail: "Waiting for ICE to select a route..." };
  }

  const local = stats.get(selectedPair.localCandidateId);
  const remote = stats.get(selectedPair.remoteCandidateId);
  const localType = local?.candidateType || "unknown";
  const remoteType = remote?.candidateType || "unknown";
  const localAddress = getCandidateAddress(local);
  const remoteAddress = getCandidateAddress(remote);

  if (localType === "host" && remoteType === "host") {
    return {
      mode: "lan",
      detail: `Local network route selected (${formatCandidateAddress(localAddress)} -> ${formatCandidateAddress(remoteAddress)}).`
    };
  }

  if (localType === "relay" || remoteType === "relay") {
    return {
      mode: "relay",
      detail: "TURN relay route selected. File data is relayed because direct peer traffic was blocked."
    };
  }

  return {
    mode: "direct",
    detail: `Direct internet/NAT route selected (${localType} -> ${remoteType}).`
  };
}

function getCandidateAddress(candidate) {
  return candidate?.address || candidate?.ip || candidate?.url || "";
}

function formatCandidateAddress(address) {
  if (!address) return "browser-private address";
  if (address.endsWith(".local")) return "browser-private LAN address";
  return address;
}

function updateNetworkPath(mode, detail, options = {}) {
  const effectiveMode = chooseEffectiveNetworkMode(mode, state.networkPath.remoteMode);
  state.networkPath.mode = effectiveMode;
  state.networkPath.detail = effectiveMode === "lan" && mode !== "lan"
    ? "Local network route confirmed by the other device. LAN transfer profile enabled."
    : detail;
  renderNetworkPath();

  if (options.notifyPeer && state.conn && state.connectionState === "CONNECTED") {
    state.conn.send({
      type: "route-info",
      payload: {
        mode,
        effectiveMode,
        detail
      }
    });
  }
}

function handleRemoteRouteInfo(payload) {
  state.networkPath.remoteMode = payload?.effectiveMode || payload?.mode || "unknown";

  if (state.networkPath.remoteMode === "lan" && state.networkPath.mode !== "lan") {
    updateNetworkPath("lan", "Local network route confirmed by the other device. LAN transfer profile enabled.");
    return;
  }

  renderNetworkPath();
}

function chooseEffectiveNetworkMode(localMode, remoteMode) {
  if (localMode === "lan" || remoteMode === "lan") return "lan";
  if (localMode === "relay" || remoteMode === "relay") return "relay";
  if (localMode === "direct" || remoteMode === "direct") return "direct";
  return "unknown";
}

function renderNetworkPath() {
  const badge = document.getElementById("network-path-badge");
  const detail = document.getElementById("network-path-detail");
  if (!badge || !detail) return;

  const labels = {
    lan: "Route: LAN fast path",
    direct: "Route: direct P2P",
    relay: "Route: relay fallback",
    unknown: "Route: detecting"
  };
  const classes = {
    lan: "font-mono-custom text-[9px] uppercase bg-[var(--ok)] text-white brutal-border px-2 py-0.5",
    direct: "font-mono-custom text-[9px] uppercase bg-[var(--yellow)] text-black brutal-border px-2 py-0.5",
    relay: "font-mono-custom text-[9px] uppercase bg-[var(--correction)] text-black brutal-border px-2 py-0.5",
    unknown: "font-mono-custom text-[9px] uppercase bg-[var(--muted-paper)] text-[var(--ink)] brutal-border px-2 py-0.5"
  };

  badge.textContent = labels[state.networkPath.mode] || labels.unknown;
  badge.className = classes[state.networkPath.mode] || classes.unknown;
  const profile = state.networkPath.mode === "lan"
    ? ` Fast profile: ${formatBytes(LAN_CHUNK_SIZE)} chunks, ${formatBytes(LAN_MAX_BUFFERED_AMOUNT)} send buffer.`
    : "";
  detail.textContent = `${state.networkPath.detail}${profile}`;
}

function markConnectionReady(connInstance, peerName) {
  state.connectedPeer = { id: connInstance.peer, name: peerName };
  renderAppByState("CONNECTED");
  document.getElementById("peer-name-display").textContent = escapeHtml(peerName);
  renderNetworkPath();
  playSound("connect");
  hapticTap(20);
  initiatePingLoop();
  startNetworkPathMonitoring(connInstance);
  setTimeout(() => {
    sendQueuedShareToCurrentPeer();
  }, 250);
}

function waitForRouteClassification(timeoutMs = 2500) {
  if (state.networkPath.mode !== "unknown") {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const startedAt = Date.now();
    const check = () => {
      if (state.networkPath.mode !== "unknown" || Date.now() - startedAt >= timeoutMs) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

function processIncomingMessage(msg, connInstance) {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "password-challenge":
      if (!state.passwordEnabled) {
        connInstance.send({ type: "file-error", payload: { error: "Security mode mismatch: host requires matching passwords." } });
        connInstance.close();
        return;
      }
      hashChallenge(msg.payload.challenge, state.passphrase).then(hashedProof => {
        connInstance.send({
          type: "password-proof",
          from: state.identity.name,
          payload: { proof: hashedProof, challenge: msg.payload.challenge }
        });
      });
      break;

    case "password-proof":
      hashChallenge(msg.payload.challenge, state.passphrase).then(localProof => {
        if (localProof === msg.payload.proof) {
          connInstance.send({
            type: "hello",
            from: msg.from,
            payload: { version: APP_VERSION }
          });
        } else {
          connInstance.send({ type: "file-error", payload: { error: "Security verification failed. Mismatched passphrase." } });
          setTimeout(() => connInstance.close(), 500);
        }
      });
      break;

    case "hello":
      // Open Connection Invitation Popup Modal
      pendingInviteConnection = connInstance;
      document.getElementById("invite-peer-name").textContent = escapeHtml(msg.from);
      document.getElementById("invite-peer-meta").textContent = `ID: ${connInstance.peer}`;
      document.getElementById("invite-modal").classList.remove("hidden");
      document.getElementById("accept-invite-btn").focus();
      playSound("connect");
      notifyUser("ez-drop connection request", `${msg.from || "A peer"} wants to connect.`);
      break;

    case "accept":
      markConnectionReady(connInstance, msg.from);
      break;

    case "decline":
      showGlobalAlert("WebRTC handshake was declined by the remote device.", "error");
      terminateSession();
      break;

    case "text":
      appendChatBubble(msg.from, msg.payload.text, false);
      break;

    case "ping":
      connInstance.send({ type: "pong", timestamp: Date.now() });
      break;

    case "pong":
      const now = Date.now();
      state.latency = now - msg.timestamp;
      updatePingIndicator(state.latency);
      break;

    case "peer-status":
      if (state.connectedPeer) {
        state.connectedPeer.name = msg.payload.name;
        document.getElementById("peer-name-display").textContent = escapeHtml(msg.payload.name);
      }
      break;

    case "route-info":
      handleRemoteRouteInfo(msg.payload);
      break;

    case "file-meta":
      handleFileMetadata(msg.payload);
      break;

    case "file-offer":
      handleFileOffer(msg.payload, connInstance);
      break;

    case "file-accept":
      handleFileOfferAccepted(msg.payload.transferId);
      break;

    case "file-chunk":
      handleIncomingChunk(msg.payload);
      break;

    case "file-complete":
      finalizeIncomingFile(msg.payload.transferId);
      break;

    case "file-cancel":
      handleTransferCancellation(msg.payload.transferId, false);
      break;

    case "file-error":
      showGlobalAlert(`Transmission Error: ${msg.payload.error}`, "error");
      playSound("error");
      break;
  }
}

// Defensive error-guarded implementation to prevent UI freezes on clicking modals
function respondToInvitation(accepted) {
  document.getElementById("invite-modal").classList.add("hidden");
  if (!pendingInviteConnection) {
    showGlobalAlert("No pending invitation found or connection already timed out.", "error");
    return;
  }

  try {
    if (accepted) {
      state.conn = pendingInviteConnection;
      const peerName = document.getElementById("invite-peer-name").textContent;

      state.conn.send({
        type: "accept",
        from: state.identity.name,
        payload: {}
      });

      markConnectionReady(state.conn, peerName);
    } else {
      state.conn = null;
      state.connectedPeer = null;
      pendingInviteConnection.send({ type: "decline", from: state.identity.name });
      const connToClose = pendingInviteConnection;
      setTimeout(() => {
        try {
          connToClose.close();
        } catch (e) {
          console.warn("Error closing rejected connection:", e);
        }
      }, 200);
      pendingInviteConnection = null;
      renderAppByState("READY");
    }
  } catch (err) {
    console.error("Error inside respondToInvitation flow:", err);
    showGlobalAlert("Failed to respond to connection request: " + err.message, "error");
    terminateSession();
  }
}

// Terminate Session cleanup routines
function terminateSession() {
  if (state.conn) {
    state.conn.close();
  }
  handleDisconnectTransition();
}

function handleDisconnectTransition() {
  const wasConnected = state.connectionState === "CONNECTED";
  stopNetworkPathMonitoring();
  failActiveTransfers("Connection lost");
  state.conn = null;
  state.connectedPeer = null;
  state.networkPath = { mode: "unknown", detail: "Route: detecting", monitorId: null, remoteMode: "unknown" };
  clearInterval(state.pingIntervalId);

  const latencyChip = document.getElementById("latency-display");
  if (latencyChip) latencyChip.classList.add("hidden");

  renderAppByState("READY");
  if (wasConnected) {
    showGlobalAlert("Peer disconnected. You're back on the radar — reconnect any time.", "info");
    publishPresence();
  }
}

function failActiveTransfers(reason) {
  const isActive = t => ["WAITING_ACCEPT", "QUEUED", "SENDING", "RECEIVING"].includes(t.status);
  for (const [id, transfer] of state.outgoingTransfers.entries()) {
    if (!isActive(transfer)) continue;
    transfer.status = "ERROR";
    transfer.acceptReject?.(new Error(reason));
    handleTransferError(id, reason, true);
  }
  for (const [id, transfer] of state.incomingTransfers.entries()) {
    if (!isActive(transfer)) continue;
    transfer.status = "ERROR";
    try {
      transfer.writer?.abort()?.catch?.(() => {});
    } catch (err) {
      debugLog("Writer abort skipped:", err);
    }
    handleTransferError(id, reason, false);
  }
}

// --- LATENCY MONITORING PINGS ---
function initiatePingLoop() {
  clearInterval(state.pingIntervalId);
  state.pingIntervalId = setInterval(() => {
    if (state.conn && state.connectionState === "CONNECTED") {
      state.conn.send({
        type: "ping",
        timestamp: Date.now()
      });
    }
  }, 3000);
}

function updatePingIndicator(latency) {
  const chip = document.getElementById("latency-display");
  if (!chip) return;
  chip.textContent = `${Math.max(0, latency)} ms`;
  chip.classList.remove("hidden");
  chip.style.color = latency < 80 ? "var(--ok)" : latency < 250 ? "var(--warn)" : "var(--bad)";
}

function updateRoomTicket(roomCode) {
  document.getElementById("room-code-display").textContent = roomCode;
  const loc = window.location;
  state.shareUrl = `${loc.protocol}//${loc.host}${loc.pathname}?r=${roomCode}`;
  generateQrLayout(state.shareUrl);
}

function generateQrLayout(url) {
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";
  try {
    new QRCode(qrContainer, {
      text: url,
      width: 140,
      height: 140,
      colorDark: "#111111",
      colorLight: "#FFFFFF",
      correctLevel: QRCode.CorrectLevel.M
    });
    document.getElementById("qr-fallback-msg").classList.add("hidden");
  } catch (err) {
    console.error("QR construction crashed", err);
    document.getElementById("qr-fallback-msg").classList.remove("hidden");
  }
}

// --- QR SCANNER LAZY LOAD CONTROL ---
function openQRScanner() {
  const modal = document.getElementById("scanner-modal");
  modal.classList.remove("hidden");
  document.getElementById("close-scanner-btn").focus();

  state.scannerInstance = new Html5Qrcode("interactive-reader");
  const config = { fps: 10, qrbox: { width: 220, height: 220 } };

  state.scannerInstance.start(
    { facingMode: "environment" },
    config,
    onQrScanSuccess,
    onQrScanFailure
  ).catch(err => {
    console.error("Camera fail:", err);
    showGlobalAlert("Failed to initialize system camera hardware.", "error");
    closeQRScanner();
  });
}

function closeQRScanner() {
  const modal = document.getElementById("scanner-modal");
  modal.classList.add("hidden");
  if (state.scannerInstance) {
    state.scannerInstance.stop().then(() => {
      state.scannerInstance = null;
    }).catch(err => {
      console.error("Scanner stream exit failure:", err);
    });
  }
}

function onQrScanSuccess(decodedText) {
  try {
    const url = new URL(decodedText);
    const code = url.searchParams.get("r");
    if (code && code.match(/^\d{5}$/)) {
      closeQRScanner();
      document.getElementById("target-room-input").value = code;
      connectToRoomBtn();
    } else {
      showGlobalAlert("Invalid ez-drop ticket decoded.", "error");
    }
  } catch (err) {
    showGlobalAlert("QR format not supported.", "error");
  }
}

function onQrScanFailure(error) {
  // Ignored for scan stream fluency
}

// --- CHAT MESSAGE & TEXT PIPELINE ---
function sendTextMessage() {
  const txtInput = document.getElementById("text-input");
  const msgText = txtInput.value.trim();
  if (!msgText) return;

  if (!state.conn || state.connectionState !== "CONNECTED") {
    showGlobalAlert("Establishing connection required before sending text snippets.", "error");
    return;
  }

  state.conn.send({
    type: "text",
    from: state.identity.name,
    payload: { text: msgText }
  });

  appendChatBubble(state.identity.name, msgText, true);
  addHistoryRecord("text", `Text: ${msgText.substring(0, 30)}...`, true);
  txtInput.value = "";
}

function pasteFromClipboard() {
  navigator.clipboard.readText().then(clipText => {
    document.getElementById("text-input").value = clipText;
  }).catch(err => {
    showGlobalAlert("Clipboard permissions denied.", "error");
  });
}

function appendChatBubble(sender, text, isMe) {
  document.getElementById("queue-empty-state").classList.add("hidden");
  const streamContainer = document.getElementById("transfers-container");
  
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wrap = document.createElement("div");
  wrap.className = `flex flex-col gap-1 w-full max-w-lg mb-2 ${isMe ? 'self-end ml-auto' : 'self-start mr-auto'}`;

  const card = document.createElement("div");
  card.className = `brutal-border p-3 brutal-shadow-sm ${isMe ? 'bg-[var(--surface-warm)]' : 'bg-[var(--muted-paper)]'}`;
  
  const header = document.createElement("div");
  header.className = "flex justify-between items-center text-[10px] font-mono-custom font-bold border-b border-dashed border-[var(--ink)] pb-1 mb-1.5 opacity-80";
  header.innerHTML = `<span>${escapeHtml(sender)}</span> <span>${timeStr}</span>`;
  
  const body = document.createElement("div");
  body.className = "text-xs font-mono-custom whitespace-pre-wrap break-words";
  body.textContent = text;

  const footer = document.createElement("div");
  footer.className = "flex justify-end gap-2 mt-2 pt-1 border-t border-dashed border-[var(--ink)]";
  
  const copyBtn = document.createElement("button");
  copyBtn.className = "text-[9px] font-mono-custom uppercase tracking-wider underline font-bold";
  copyBtn.textContent = "Copy";
  copyBtn.onclick = () => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1000);
  };

  footer.appendChild(copyBtn);
  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  wrap.appendChild(card);
  streamContainer.appendChild(wrap);

  streamContainer.scrollTop = streamContainer.scrollHeight;
}

// --- FILE DRAG & DROP PIPELINE ---
function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  dropZone.addEventListener("click", () => {
    document.getElementById("file-picker").click();
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-active");
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-active");
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFilesArray(files);
  });
}

function handleFileSelection(event) {
  const files = event.target.files;
  handleFilesArray(files);
  event.target.value = "";
}

function openFolderPicker(event) {
  event?.stopPropagation();
  const picker = document.getElementById("folder-picker");
  if (picker) picker.click();
}

function handleFilesArray(files) {
  if (!files || files.length === 0) return;
  if (!state.conn || state.connectionState !== "CONNECTED") {
    showGlobalAlert("No active WebRTC peer connection.", "error");
    return;
  }
  for (let i = 0; i < files.length; i++) {
    initiateOutgoingFileTransfer(files[i]);
  }
}

function hasActiveTransfers() {
  const isActive = transfer => transfer.status === "QUEUED" || transfer.status === "SENDING" || transfer.status === "RECEIVING";
  return Array.from(state.outgoingTransfers.values()).some(isActive) || Array.from(state.incomingTransfers.values()).some(isActive);
}

async function requestTransferWakeLock() {
  if (!("wakeLock" in navigator) || state.wakeLock || document.visibilityState !== "visible") return;

  try {
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = null;
    });
  } catch (err) {
    debugLog("Wake lock unavailable:", err);
  }
}

function releaseTransferWakeLock() {
  if (!state.wakeLock || hasActiveTransfers()) return;
  state.wakeLock.release().catch(() => {});
  state.wakeLock = null;
}

// --- RELIABLE ADAPTIVE CHUNK STREAMING ---
// Streams are serialized: each file gets the full channel bandwidth in turn,
// so progress/speed/ETA are accurate and chunks never interleave between files.
let outgoingStreamChain = Promise.resolve();

function queueOutgoingStream(transferId) {
  const task = outgoingStreamChain.then(() => runAdaptiveBackpressureStream(transferId));
  outgoingStreamChain = task.catch(() => {});
  return task;
}

async function initiateOutgoingFileTransfer(file) {
  requestTransferWakeLock();
  await waitForRouteClassification();
  const transferId = `tx-${Math.random().toString(36).substr(2, 9)}`;
  const chunkSize = getPreferredChunkSize();
  let checksum = "";
  if (file.size <= MAX_EAGER_CHECKSUM_SIZE && crypto?.subtle) {
    try {
      checksum = await computeBlobSha256(file);
    } catch (err) {
      debugLog("Checksum skipped:", err);
    }
  }
  
  const fileMeta = {
    transferId: transferId,
    name: file.name,
    path: file.webkitRelativePath || file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    totalChunks: Math.ceil(file.size / chunkSize),
    chunkSize: chunkSize,
    sha256: checksum
  };

  state.outgoingTransfers.set(transferId, {
    file: file,
    meta: fileMeta,
    sentBytes: 0,
    status: "WAITING_ACCEPT",
    startTime: Date.now()
  });

  renderTransferCard(transferId, "SENDING", fileMeta);
  updateAppBadge();

  state.conn.send({
    type: "file-offer",
    from: state.identity.name,
    payload: fileMeta
  });

  try {
    await waitForFileOfferAccepted(transferId);
    state.conn.send({
      type: "file-meta",
      from: state.identity.name,
      payload: fileMeta
    });
    await queueOutgoingStream(transferId);
  } catch (err) {
    console.error("Transmitter crashed:", err);
    handleTransferError(transferId, "Streaming connection interrupted", true);
  }
}

function waitForFileOfferAccepted(transferId) {
  const transferObj = state.outgoingTransfers.get(transferId);
  if (!transferObj) return Promise.reject(new Error("Missing transfer"));

  const speedEl = document.getElementById(`speed-${transferId}`);
  if (speedEl) speedEl.textContent = "Waiting for accept";

  return new Promise((resolve, reject) => {
    transferObj.acceptResolve = resolve;
    transferObj.acceptReject = reject;
  });
}

function handleFileOfferAccepted(transferId) {
  const transferObj = state.outgoingTransfers.get(transferId);
  if (!transferObj || transferObj.status === "CANCELLED") return;
  transferObj.status = "QUEUED";
  if (transferObj.acceptResolve) transferObj.acceptResolve();
}

async function runAdaptiveBackpressureStream(transferId) {
  const transferObj = state.outgoingTransfers.get(transferId);
  if (!transferObj) return;

  transferObj.status = "SENDING";
  transferObj.startTime = Date.now();

  const file = transferObj.file;
  const meta = transferObj.meta;
  const chunkSize = meta.chunkSize || CHUNK_SIZE;
  const dc = state.conn.dataChannel;

  let offset = 0;
  let chunkIdx = 0;

  while (offset < file.size) {
    const currentObj = state.outgoingTransfers.get(transferId);
    if (!currentObj || currentObj.status === "CANCELLED") {
      return;
    }

    // Adaptive Backpressure throttling calculation
    if (dc && dc.bufferedAmount > getMaxBufferedAmount()) {
      await waitForDataChannelDrain(dc);
    }

    const nextSlice = file.slice(offset, offset + chunkSize);
    let arrayBuffer;
    try {
      arrayBuffer = await nextSlice.arrayBuffer();
    } catch (err) {
      handleTransferError(transferId, "Disk read failed", true);
      return;
    }

    state.conn.send({
      type: "file-chunk",
      payload: {
        transferId: transferId,
        chunkIndex: chunkIdx,
        data: arrayBuffer
      }
    });

    offset += chunkSize;
    chunkIdx++;
    
    currentObj.sentBytes = Math.min(offset, file.size);
    updateTransferProgress(transferId, "SENDING", currentObj.sentBytes, file.size);

    if (chunkIdx % 16 === 0) {
      await nextFrame();
    }
  }

  state.conn.send({
    type: "file-complete",
    payload: { transferId: transferId }
  });

  transferObj.status = "COMPLETE";
  updateTransferProgress(transferId, "COMPLETE", file.size, file.size);
  addHistoryRecord("file-sent", `${file.name} (${formatBytes(file.size)})`, true);
  playSound("complete");
  hapticTap([15, 40, 20]);
  updateAppBadge();
  releaseTransferWakeLock();
}

function waitForDataChannelDrain(dc) {
  const lowWatermark = getLowBufferedAmount();
  if (!dc || dc.readyState !== "open" || dc.bufferedAmount <= lowWatermark) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      dc.removeEventListener?.("bufferedamountlow", onLow);
      resolve();
    };
    const onLow = () => cleanup();

    try {
      dc.bufferedAmountLowThreshold = lowWatermark;
      dc.addEventListener?.("bufferedamountlow", onLow, { once: true });
    } catch (err) {
      // Some WebRTC shims expose partial DataChannel APIs; polling keeps them working.
    }

    const poll = () => {
      if (settled) return;
      if (dc.readyState !== "open" || dc.bufferedAmount <= lowWatermark) {
        cleanup();
      } else {
        setTimeout(poll, 30);
      }
    };
    poll();
  });
}

// --- RECIPIENT FILE HANDLING ---
function handleFileOffer(meta, connInstance) {
  document.getElementById("queue-empty-state").classList.add("hidden");
  const container = document.getElementById("transfers-container");
  const card = document.createElement("div");
  card.id = `card-${meta.transferId}`;
  card.className = "brutal-border p-3 bg-[var(--yellow)] brutal-shadow-sm flex flex-col gap-2 relative";

  const safeName = sanitizeFileName(meta.name);
  const pathText = meta.path && meta.path !== meta.name ? escapeHtml(meta.path) : "";
  card.innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="file-kind-icon"><i data-lucide="${getFileKindIcon(safeName)}" class="w-4 h-4"></i></span>
      <div class="min-w-0 flex-grow">
        <h4 class="font-bold text-xs truncate uppercase font-mono-custom">${escapeHtml(safeName)}</h4>
        <div class="text-[9px] font-mono-custom text-[var(--ink)] opacity-75">${formatBytes(meta.size)}${pathText ? ` • ${pathText}` : ""} • wants to send you this file</div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <button id="decline-btn-${meta.transferId}" class="brutal-btn-sm bg-[var(--paper)] p-2 text-[10px] font-mono-custom font-bold uppercase">Decline</button>
      <button id="accept-file-btn-${meta.transferId}" class="brutal-btn-sm bg-[var(--ink)] text-[var(--paper)] p-2 text-[10px] font-mono-custom font-bold uppercase">Accept</button>
    </div>
  `;
  container.prepend(card);
  refreshIcons();

  document.getElementById(`accept-file-btn-${meta.transferId}`).onclick = async () => {
    // Large files stream straight to disk via the File System Access API so
    // they never have to fit in RAM. The accept tap is the required user gesture.
    let writable = null;
    if (window.showSaveFilePicker && meta.size > STREAM_SAVE_THRESHOLD) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: safeName });
        writable = await handle.createWritable();
      } catch (err) {
        // Picker dismissed or unavailable: fall back to in-memory receive.
        writable = null;
        debugLog("Stream-to-disk fallback:", err);
      }
    }
    card.remove();
    handleFileMetadata(meta, writable);
    connInstance.send({ type: "file-accept", payload: { transferId: meta.transferId } });
  };

  document.getElementById(`decline-btn-${meta.transferId}`).onclick = () => {
    handleTransferCancellation(meta.transferId, false);
    connInstance.send({ type: "file-cancel", payload: { transferId: meta.transferId } });
    card.remove();
  };

  notifyUser("ez-drop file request", `${safeName} (${formatBytes(meta.size)}) is waiting for approval.`);
}

function handleFileMetadata(meta, writable = null) {
  // Idempotent: the recipient accepts the offer (first call) and then receives
  // the authoritative file-meta packet (second call). Only set up state once so
  // we never render a duplicate card or reset already-buffered chunks.
  if (state.incomingTransfers.has(meta.transferId)) return;

  if (!writable && meta.size > 800 * 1024 * 1024) {
    showGlobalAlert(`Large file incoming (${(meta.size / (1024*1024)).toFixed(0)}MB). Keep browser in foreground.`, "info");
  }

  state.incomingTransfers.set(meta.transferId, {
    meta: meta,
    chunks: writable ? null : [],
    receivedChunksCount: 0,
    receivedBytes: 0,
    status: "RECEIVING",
    startTime: Date.now(),
    writer: writable,
    writeChain: writable ? Promise.resolve() : null,
    writeFailed: false
  });

  requestTransferWakeLock();
  renderTransferCard(meta.transferId, "RECEIVING", meta);
  updateAppBadge();
}

function handleIncomingChunk(payload) {
  const transferId = payload.transferId;
  const incoming = state.incomingTransfers.get(transferId);
  if (!incoming || incoming.status !== "RECEIVING") return;

  if (incoming.writer) {
    // Disk-streaming path: chunks arrive in order on the reliable channel and
    // are appended sequentially through a write chain.
    incoming.writeChain = incoming.writeChain
      .then(() => incoming.writer.write(payload.data))
      .catch(err => {
        if (!incoming.writeFailed && incoming.status === "RECEIVING") {
          incoming.writeFailed = true;
          incoming.status = "ERROR";
          debugLog("Disk write failed:", err);
          handleTransferError(transferId, "Disk write failed", false);
        }
      });
  } else {
    incoming.chunks[payload.chunkIndex] = payload.data;
  }

  incoming.receivedChunksCount++;
  incoming.receivedBytes += payload.data.byteLength;

  updateTransferProgress(transferId, "RECEIVING", incoming.receivedBytes, incoming.meta.size);
}

function finalizeIncomingFile(transferId) {
  const incoming = state.incomingTransfers.get(transferId);
  if (!incoming || incoming.status === "ERROR" || incoming.status === "CANCELLED") return;

  const safeName = sanitizeFileName(incoming.meta.name);

  // Disk-streamed receive: flush pending writes, close the handle, done.
  if (incoming.writer) {
    incoming.doneLabel = "Saved to disk";
    incoming.writeChain
      .then(() => incoming.writer.close())
      .then(() => {
        incoming.status = "COMPLETE";
        updateTransferProgress(transferId, "COMPLETE", incoming.meta.size, incoming.meta.size);
        addHistoryRecord("file-received", `${safeName} (${formatBytes(incoming.meta.size)})`, false);
        playSound("complete");
        hapticTap([15, 40, 20]);
        notifyUser("ez-drop file received", `${safeName} was saved to disk.`);
        releaseTransferWakeLock();
        updateAppBadge();
      })
      .catch(err => {
        console.error("Disk finalize failed:", err);
        handleTransferError(transferId, "Could not finish writing to disk", false);
      });
    return;
  }

  incoming.status = "COMPLETE";
  updateTransferProgress(transferId, "COMPLETE", incoming.meta.size, incoming.meta.size);
  addHistoryRecord("file-received", `${safeName} (${formatBytes(incoming.meta.size)})`, false);
  playSound("complete");
  hapticTap([15, 40, 20]);
  updateAppBadge();

  try {
    const fileBlob = new Blob(incoming.chunks, { type: incoming.meta.type });
    incoming.blob = fileBlob;
    const objectUrl = URL.createObjectURL(fileBlob);
    incoming.objectUrl = objectUrl;

    const downloadBtn = document.getElementById(`dl-btn-${transferId}`);
    if (downloadBtn) {
      downloadBtn.href = objectUrl;
      downloadBtn.download = safeName;
      downloadBtn.rel = "noopener";
      downloadBtn.onclick = (event) => saveReceivedFile(event, transferId);
      downloadBtn.classList.remove("hidden");
    }

    if (isMobileDevice()) {
      showGlobalAlert(`Received ${safeName}. Tap Save in the transfer card to store it on this device.`, "info");
    } else {
      // Desktop browsers consistently allow user-session initiated object URL downloads.
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
    notifyUser("ez-drop file received", `${safeName} is ready to save.`);

    if (incoming.meta.sha256 && crypto?.subtle) {
      computeBlobSha256(fileBlob).then(hash => {
        const speedEl = document.getElementById(`speed-${transferId}`);
        if (speedEl) {
          speedEl.textContent = hash === incoming.meta.sha256 ? "Verified" : "Checksum mismatch";
        }
        if (hash !== incoming.meta.sha256) {
          showGlobalAlert(`Checksum mismatch for ${incoming.meta.name}. Ask the sender to retry.`, "error");
        }
      }).catch(err => debugLog("Checksum verification skipped:", err));
    }

    releaseTransferWakeLock();

  } catch (err) {
    console.error("Blob compilation crashed", err);
    handleTransferError(transferId, "Blob parsing failure", false);
  }
}

async function saveReceivedFile(event, transferId) {
  const incoming = state.incomingTransfers.get(transferId);
  if (!incoming?.blob || !window.showSaveFilePicker) return;
  event.preventDefault();

  const safeName = sanitizeFileName(incoming.meta.name);
  try {
    const handle = await window.showSaveFilePicker({ suggestedName: safeName });
    const writable = await handle.createWritable();
    await writable.write(incoming.blob);
    await writable.close();
    showGlobalAlert(`Saved ${safeName}`, "info");
  } catch (err) {
    if (err?.name !== "AbortError") {
      showGlobalAlert(`Could not save ${safeName}. Use the browser download button instead.`, "error");
    }
  }
}

// --- RENDER STREAM TRANSFER PROGRESS CARDS ---
function renderTransferCard(transferId, direction, meta) {
  document.getElementById("queue-empty-state").classList.add("hidden");
  const container = document.getElementById("transfers-container");

  const card = document.createElement("div");
  card.id = `card-${transferId}`;
  card.className = "brutal-border p-3 bg-[var(--surface)] brutal-shadow-sm flex flex-col gap-2 relative";

  const heading = document.createElement("div");
  heading.className = "flex justify-between items-center gap-2 border-b border-[var(--ink)] pb-1";

  const iconBox = document.createElement("span");
  iconBox.className = "file-kind-icon";
  iconBox.innerHTML = `<i data-lucide="${getFileKindIcon(meta.name)}" class="w-4 h-4"></i>`;

  const titleWrapper = document.createElement("div");
  titleWrapper.className = "min-w-0 flex-grow";

  const title = document.createElement("h4");
  title.className = "font-bold text-xs truncate uppercase font-mono-custom";
  title.textContent = meta.name;

  const specs = document.createElement("div");
  specs.className = "text-[9px] font-mono-custom text-[var(--muted)]";
  specs.textContent = `${formatBytes(meta.size)} • ${direction === "SENDING" ? "Sending" : "Receiving"}`;

  titleWrapper.appendChild(title);
  titleWrapper.appendChild(specs);

  const actionWrapper = document.createElement("div");
  actionWrapper.className = "flex items-center gap-1.5";

  const dlBtn = document.createElement("a");
  dlBtn.id = `dl-btn-${transferId}`;
  dlBtn.className = "hidden brutal-btn-sm bg-[var(--yellow)] px-2 py-0.5 text-[9px] font-mono-custom font-bold uppercase text-black";
  dlBtn.textContent = "Save";
  
  const cancelBtn = document.createElement("button");
  cancelBtn.id = `cancel-btn-${transferId}`;
  cancelBtn.className = "brutal-btn-sm bg-[var(--muted-paper)] px-2 py-0.5 text-[9px] font-mono-custom font-bold uppercase text-[var(--red)]";
  cancelBtn.textContent = "Cancel";
  cancelBtn.onclick = () => handleTransferCancellation(transferId, true);

  actionWrapper.appendChild(dlBtn);
  actionWrapper.appendChild(cancelBtn);

  heading.appendChild(iconBox);
  heading.appendChild(titleWrapper);
  heading.appendChild(actionWrapper);

  const progressWrapper = document.createElement("div");
  progressWrapper.className = "flex flex-col gap-1";

  const barOuter = document.createElement("div");
  barOuter.className = "w-full brutal-border h-3.5 bg-[var(--muted-paper)] relative overflow-hidden";

  const barInner = document.createElement("div");
  barInner.id = `bar-${transferId}`;
  barInner.className = `h-full w-0 transition-all duration-100 bar-striped ${direction === "SENDING" ? 'bg-[var(--blue)]' : 'bg-[var(--gold)]'}`;

  barOuter.appendChild(barInner);

  const footer = document.createElement("div");
  footer.className = "flex justify-between items-center text-[9px] font-mono-custom uppercase opacity-80";
  
  const percentVal = document.createElement("span");
  percentVal.id = `percent-${transferId}`;
  percentVal.textContent = "0%";

  const speedVal = document.createElement("span");
  speedVal.id = `speed-${transferId}`;
  speedVal.textContent = "Initiating...";

  footer.appendChild(percentVal);
  footer.appendChild(speedVal);

  progressWrapper.appendChild(barOuter);
  progressWrapper.appendChild(footer);

  card.appendChild(heading);
  card.appendChild(progressWrapper);

  container.prepend(card);
  refreshIcons();
}

const pendingProgressUpdates = new Map();
let progressUpdateRaf = 0;

function updateTransferProgress(transferId, direction, current, total) {
  pendingProgressUpdates.set(transferId, { direction, current, total });

  if (!progressUpdateRaf) {
    progressUpdateRaf = requestAnimationFrame(flushTransferProgressUpdates);
  }
}

function flushTransferProgressUpdates() {
  progressUpdateRaf = 0;
  const updates = Array.from(pendingProgressUpdates.entries());
  pendingProgressUpdates.clear();

  for (const [transferId, progress] of updates) {
    applyTransferProgress(transferId, progress.direction, progress.current, progress.total);
  }
}

function applyTransferProgress(transferId, direction, current, total) {
  const percentage = Math.min(Math.floor((current / total) * 100), 100);
  
  const bar = document.getElementById(`bar-${transferId}`);
  if (bar) bar.style.width = `${percentage}%`;

  const pct = document.getElementById(`percent-${transferId}`);
  if (pct) pct.textContent = `${percentage}%`;

  const tracker = direction === "SENDING" ? state.outgoingTransfers.get(transferId) : state.incomingTransfers.get(transferId);
  if (tracker) {
    const timeDiff = (Date.now() - tracker.startTime) / 1000;
    const instantSpeed = timeDiff > 0 ? (current / timeDiff) : 0;
    // Exponential moving average keeps the readout steady instead of jittery.
    tracker.emaSpeed = tracker.emaSpeed ? tracker.emaSpeed * 0.7 + instantSpeed * 0.3 : instantSpeed;

    const speedText = document.getElementById(`speed-${transferId}`);
    if (speedText) {
      if (percentage === 100) {
        speedText.textContent = tracker.doneLabel || "Finished";
        const cancelBtn = document.getElementById(`cancel-btn-${transferId}`);
        if (cancelBtn) cancelBtn.classList.add("hidden");
        if (bar) bar.classList.remove("bar-striped");
        const doneCard = document.getElementById(`card-${transferId}`);
        if (doneCard && !doneCard.classList.contains("transfer-complete")) {
          doneCard.classList.add("transfer-complete");
        }
      } else {
        const remainingSecs = tracker.emaSpeed > 0 ? (total - current) / tracker.emaSpeed : Infinity;
        const eta = formatEta(remainingSecs);
        speedText.textContent = `${formatBytes(tracker.emaSpeed)}/s${eta ? ` • ${eta} left` : ""}`;
      }
    }
  }
}

function handleTransferCancellation(transferId, initiatedLocally) {
  const outgoing = state.outgoingTransfers.get(transferId);
  const incoming = state.incomingTransfers.get(transferId);
  
  if (outgoing) outgoing.status = "CANCELLED";
  if (incoming) {
    incoming.status = "CANCELLED";
    // Drop any partially-written disk file.
    try {
      incoming.writer?.abort()?.catch?.(() => {});
    } catch (err) {
      debugLog("Writer abort skipped:", err);
    }
  }

  const card = document.getElementById(`card-${transferId}`);
  if (card) {
    card.classList.add("opacity-40");
    const cancelBtn = document.getElementById(`cancel-btn-${transferId}`);
    if (cancelBtn) cancelBtn.classList.add("hidden");
    const speedEl = document.getElementById(`speed-${transferId}`);
    if (speedEl) speedEl.textContent = "Cancelled";
  }

  if (initiatedLocally && state.conn) {
    state.conn.send({
      type: "file-cancel",
      payload: { transferId: transferId }
    });
  }
  if (outgoing?.acceptReject) {
    outgoing.acceptReject(new Error("Transfer cancelled"));
  }
  releaseTransferWakeLock();
  updateAppBadge();
}

function handleTransferError(transferId, errorMsg, isOutgoing) {
  const outgoing = state.outgoingTransfers.get(transferId);
  if (outgoing && outgoing.status !== "COMPLETE") outgoing.status = "ERROR";
  const incoming = state.incomingTransfers.get(transferId);
  if (incoming && incoming.status !== "COMPLETE") incoming.status = "ERROR";

  const card = document.getElementById(`card-${transferId}`);
  if (card) {
    card.classList.add("border-[var(--red)]");
    const bar = document.getElementById(`bar-${transferId}`);
    if (bar) bar.classList.remove("bar-striped");
    const speedEl = document.getElementById(`speed-${transferId}`);
    if (speedEl) speedEl.textContent = `Error: ${errorMsg}`;
    const cancelBtn = document.getElementById(`cancel-btn-${transferId}`);
    if (cancelBtn) cancelBtn.classList.add("hidden");
  }
  playSound("error");
  releaseTransferWakeLock();
  updateAppBadge();
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function clearSessionLogs() {
  document.getElementById("transfers-container").innerHTML = "";
  document.getElementById("queue-empty-state").classList.remove("hidden");
  state.outgoingTransfers.clear();
  state.incomingTransfers.clear();
  updateAppBadge();
}

// --- SIMPLE SESSION HISTORY ---
function addHistoryRecord(type, description, isMe) {
  const record = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    description,
    isMe,
    createdAt: Date.now()
  };
  renderHistoryRecord(record, { persist: true });
}

function renderHistoryRecord(record, options = {}) {
  const histContainer = document.getElementById("history-container");
  if (!histContainer) return;
  // Remove placeholder empty text
  if (histContainer.querySelector("p.italic")) {
    histContainer.innerHTML = "";
  }

  const item = document.createElement("div");
  item.className = "flex justify-between items-center p-2 bg-[var(--surface)] brutal-border border-2";
  
  const meta = document.createElement("span");
  meta.className = "truncate mr-2";
  meta.innerHTML = `<strong class="uppercase text-[9px] px-1 bg-[var(--muted-paper)] mr-1">${escapeHtml(record.type)}</strong> ${escapeHtml(record.description)}`;

  const timeVal = document.createElement("span");
  timeVal.className = "text-[9px] opacity-75 shrink-0";
  timeVal.textContent = new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  item.appendChild(meta);
  item.appendChild(timeVal);
  histContainer.prepend(item);

  if (options.persist) {
    putRecord(HISTORY_STORE, record)
      .then(pruneHistoryRecords)
      .catch(err => debugLog("History save skipped:", err));
  }
}

async function pruneHistoryRecords() {
  const records = (await getAllRecords(HISTORY_STORE)).sort((a, b) => b.createdAt - a.createdAt);
  await Promise.all(records.slice(MAX_HISTORY_ITEMS).map(record => deleteRecord(HISTORY_STORE, record.id)));
}

// --- LOOPBACK SIMULATOR "SEND TO SELF" DEBUG SUITE ---
function toggleDebugMode(explicitFlag = null) {
  const modal = document.getElementById("debug-modal");
  const targetState = explicitFlag !== null ? explicitFlag : modal.classList.contains("hidden");
  
  if (targetState) {
    modal.classList.remove("hidden");
    state.debugActive = true;
    writeToDebugLog("Virtual Sandbox Transport Loop active.", "info");
    document.getElementById("close-debug-btn").focus();
  } else {
    modal.classList.add("hidden");
    state.debugActive = false;
  }
}

function writeToDebugLog(msg, type = "log") {
  const term = document.getElementById("debug-terminal-logs");
  const wrap = document.createElement("div");
  const timeStr = new Date().toLocaleTimeString([], { hour12: false });
  
  if (type === "info") {
    wrap.className = "text-yellow-400";
  } else if (type === "error") {
    wrap.className = "text-rose-500";
  } else {
    wrap.className = "text-emerald-400";
  }

  wrap.textContent = `[${timeStr}] ${msg}`;
  term.appendChild(wrap);
  term.scrollTop = term.scrollHeight;
}

function clearDebugConsole() {
  document.getElementById("debug-terminal-logs").innerHTML = `<div class="text-gray-500">[System] Simulator cleared.</div>`;
}

function sendDebugPayload(senderNode, type) {
  const partnerNode = senderNode === "A" ? "B" : "A";
  const txtVal = document.getElementById(`debug-text-${senderNode.toLowerCase()}`).value.trim();

  if (!txtVal) return;

  writeToDebugLog(`Node ${senderNode} sends snippet: "${txtVal.substring(0, 20)}..."`);
  appendChatBubble(senderNode === "A" ? "Copper Fox" : "Neon Owl", txtVal, senderNode === "A");
  document.getElementById(`debug-text-${senderNode.toLowerCase()}`).value = "";
}

async function handleDebugFileSelection(node, event) {
  const file = event.target.files[0];
  if (!file) return;

  const partnerNode = node === "A" ? "B" : "A";
  writeToDebugLog(`Node ${node} initialized file: ${file.name} (${formatBytes(file.size)})`, "info");

  const transferId = `db-${Math.random().toString(36).substr(2, 9)}`;
  const chunkSize = getPreferredChunkSize();
  const fileMeta = {
    transferId: transferId,
    name: `[Sim] ${file.name}`,
    path: file.webkitRelativePath || file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    totalChunks: Math.ceil(file.size / chunkSize),
    chunkSize: chunkSize
  };

  renderTransferCard(transferId, node === "A" ? "SENDING" : "RECEIVING", fileMeta);

  const receiverChunks = [];
  let offset = 0;
  let chunkIdx = 0;

  const simulateStream = async () => {
    while (offset < file.size) {
      const slice = file.slice(offset, offset + chunkSize);
      const buf = await slice.arrayBuffer();

      await new Promise(r => setTimeout(r, 12));

      receiverChunks[chunkIdx] = buf;
      offset += chunkSize;
      chunkIdx++;

      const currentBytes = Math.min(offset, file.size);
      updateTransferProgress(transferId, "SENDING", currentBytes, file.size);
    }

    const fileBlob = new Blob(receiverChunks, { type: fileMeta.type });
    const objectUrl = URL.createObjectURL(fileBlob);
    
    const dlBtn = document.getElementById(`dl-btn-${transferId}`);
    if (dlBtn) {
      dlBtn.href = objectUrl;
      dlBtn.download = fileMeta.name;
      dlBtn.classList.remove("hidden");
    }

    updateTransferProgress(transferId, "COMPLETE", file.size, file.size);
    writeToDebugLog("P2P stream finish. Local node virtual file available for download.", "info");
  };

  simulateStream();
}
