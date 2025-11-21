// bot.js
// Optimized AFK bot: joins when server empty, leaves when anyone joins.
// Author: Deep thinking (optimized version)

const mineflayer = require('mineflayer');
const util = require('minecraft-server-util');

// ===== CONFIG ===== //
const HOST = 'ksnexus.progamer.me';
const PORT = 16736;
const USERNAME = 'nexus';            // change if needed
const VERSION = false;              // false = auto-detect
const CHECK_INTERVAL_MS = 5000;     // how often to query server
const JOIN_CONSECUTIVE_EMPTY = 2;   // require this many consecutive 0-player checks before joining
const LEAVE_CONSECUTIVE_OCCUPIED = 1; // require this many consecutive non-zero checks before leaving
const STATUS_TIMEOUT_MS = 3000;     // timeout for the server query
const MAX_BACKOFF_MS = 60_000;      // cap exponential backoff
const PAN_INTERVAL_MS = 7000;       // how often bot slowly pans (to look "alive")
const PAN_AMPLITUDE_DEG = 25;       // how far the bot pans left-right (degrees)
// ================== //

let bot = null;
let monitorTimer = null;
let consecutiveEmpty = 0;
let consecutiveOccupied = 0;
let backoffMs = 0;
let shuttingDown = false;

// Safe status query with timeout
async function queryStatus(host, port, timeoutMs) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('status timeout')), timeoutMs));
  const statusPromise = util.status(host, port, { timeout: timeoutMs }); // util supports timeout too
  return Promise.race([statusPromise, timeout]);
}

async function checkServerOnce() {
  if (shuttingDown) return;
  try {
    const status = await queryStatus(HOST, PORT, STATUS_TIMEOUT_MS);
    const online = Number(status?.players?.online ?? 0);
    // reset backoff on success
    backoffMs = 0;
    console.log(new Date().toISOString(), `[Check] players online: ${online}`);

    if (online === 0) {
      consecutiveEmpty += 1;
      consecutiveOccupied = 0;
    } else {
      consecutiveOccupied += 1;
      consecutiveEmpty = 0;
    }

    // join logic
    if (online === 0 && !bot && consecutiveEmpty >= JOIN_CONSECUTIVE_EMPTY) {
      console.log('[+] Server empty confirmed → starting bot...');
      startBot();
      // avoid immediate re-check jitter
      consecutiveEmpty = 0;
      consecutiveOccupied = 0;
    }

    // leave logic
    if (online > 0 && bot && consecutiveOccupied >= LEAVE_CONSECUTIVE_OCCUPIED) {
      console.log('[!] Player(s) detected → instructing bot to leave...');
      stopBot('player-joined');
      consecutiveEmpty = 0;
      consecutiveOccupied = 0;
    }
  } catch (err) {
    // exponential backoff on repeated failures (keeps checks from hammering network/server)
    backoffMs = backoffMs ? Math.min(backoffMs * 2, MAX_BACKOFF_MS) : 2000;
    console.log(new Date().toISOString(), `[Check Error] ${err.message}. next backoff: ${backoffMs}ms`);

    // apply backoff by pausing the monitor briefly
    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = setInterval(wrappedCheck, Math.max(CHECK_INTERVAL_MS, backoffMs));
    }
  }
}

async function wrappedCheck() {
  await checkServerOnce();
}

// ===== BOT LIFECYCLE ===== //
function startBot() {
  if (bot) return;
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: VERSION,
    // You can add auth: 'microsoft' or token details if needed
  });

  // safe guard: if bot doesn't spawn within X seconds, destroy it
  const spawnTimeout = setTimeout(() => {
    if (bot && !bot.player) {
      console.log('[!] Spawn timeout - destroying bot instance');
      try { bot.quit(); } catch (e) {}
      bot = null;
    }
  }, 15000);

  bot.once('spawn', () => {
    clearTimeout(spawnTimeout);
    console.log(`[+] Bot spawned as ${bot.username}. entering AFK mode.`);

    // try to set spectator mode (works only if bot has permission)
    sendCommandSafe('/gamemode spectator');

    // start a gentle pan to avoid completely static presence
    startPanLoop();
  });

  bot.on('kicked', (reason, loggedIn) => {
    console.log('[Bot] Kicked:', reason);
    stopBot('kicked');
  });

  bot.on('end', () => {
    console.log('[Bot] Connection ended.');
    stopBot('end');
  });

  bot.on('error', (err) => {
    console.log('[Bot Error]', err && err.message ? err.message : err);
    // some errors are transient; we remove bot and wait for monitor to re-create when server is empty
    stopBot('error');
  });
}

// use bot.chat or bot._client.write if needed; here we send as a chat command safely
function sendCommandSafe(cmd) {
  if (!bot || !bot.connected) return;
  try {
    // in offline-mode or restricted servers commands may be disallowed; ignore errors
    bot.chat(cmd);
  } catch (e) {
    // fallback: try raw packet (rarely needed)
    try { bot._client.write('chat', { message: cmd }); } catch (e2) { /* ignore */ }
  }
}

let panInterval = null;
let panDirection = 1;
let panAngle = 0;
function startPanLoop() {
  stopPanLoop();
  // Pan slowly left-right by adjusting yaw (note: mineflayer exposes look)
  panInterval = setInterval(() => {
    if (!bot || !bot.player) return;
    // compute next yaw
    panAngle = panAngle + panDirection * 0.3; // small steps
    if (panAngle > PAN_AMPLITUDE_DEG || panAngle < -PAN_AMPLITUDE_DEG) {
      panDirection *= -1;
    }
    const yaw = (panAngle * Math.PI) / 180;
    // pitch small nod
    const pitch = Math.sin(Date.now() / 3000) * 0.08;
    try {
      bot.look(yaw, pitch, true);
    } catch (e) {
      // ignore look errors (e.g., if server restricts)
    }
  }, PAN_INTERVAL_MS / 10);
}

function stopPanLoop() {
  if (panInterval) {
    clearInterval(panInterval);
    panInterval = null;
  }
}

function stopBot(reason = 'manual') {
  // clear any pan loop
  stopPanLoop();

  if (!bot) return;
  try {
    if (bot.connected) {
      // send a polite quit message (optional)
      try { sendCommandSafe('/say AFK bot leaving'); } catch (e) {}
      bot.quit();
    }
  } catch (e) {
    // ignore
  } finally {
    bot = null;
    console.log(`[Bot] Stopped (${reason}).`);
  }
}

// end everything gracefully
function shutdownAndExit() {
  shuttingDown = true;
  if (monitorTimer) clearInterval(monitorTimer);
  stopBot('shutdown');
  console.log('[Monitor] Exiting.');
  process.exit(0);
}

process.on('SIGINT', shutdownAndExit);
process.on('SIGTERM', shutdownAndExit);

// ===== START MONITOR ===== //
function startMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  console.log('[Monitor] starting — checking server every', CHECK_INTERVAL_MS, 'ms');
  // Do an immediate check, then interval
  wrappedCheck().catch(() => {});
  monitorTimer = setInterval(wrappedCheck, CHECK_INTERVAL_MS);
}

startMonitor();
