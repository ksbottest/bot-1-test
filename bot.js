// bot.js
// Optimized AFK bot: joins when server empty, leaves when any REAL player joins.
// Author: Deep Thinking (fixed ignore-self)

// ================= DEPENDENCIES =================
const mineflayer = require('mineflayer');
const util = require('minecraft-server-util');

// ==================== CONFIG ====================
const HOST = 'ksnexus.progamer.me';
const PORT = 16736;
const USERNAME = 'nexus'; // bot name
const VERSION = false; // auto detect version

// Monitoring
const CHECK_INTERVAL_MS = 5000;
const JOIN_CONSECUTIVE_EMPTY = 2;
const LEAVE_CONSECUTIVE_OCCUPIED = 1;
const STATUS_TIMEOUT_MS = 3000;
const MAX_BACKOFF_MS = 60_000;

// AFK Animation
const PAN_INTERVAL_MS = 7000;
const PAN_AMPLITUDE_DEG = 25;

// =================================================
let bot = null;
let monitorTimer = null;
let consecutiveEmpty = 0;
let consecutiveOccupied = 0;
let backoffMs = 0;
let shuttingDown = false;

// ===== Safe query with timeout =====
async function queryStatus(host, port, timeoutMs) {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('status timeout')), timeoutMs));
  const statusPromise = util.status(host, port, { timeout: timeoutMs });
  return Promise.race([statusPromise, timeout]);
}

// ===== Monitor server =====
async function checkServerOnce() {
  if (shuttingDown) return;
  try {
    const status = await queryStatus(HOST, PORT, STATUS_TIMEOUT_MS);

    // ===== FIX: ignore bot name from count =====
    let list = status?.players?.sample;
    if (!Array.isArray(list)) list = [];

    const others = list.filter(p => p?.name?.toLowerCase() !== USERNAME.toLowerCase());
    const online = others.length;

    backoffMs = 0; // reset backoff
    console.log(new Date().toISOString(), `[Check] real players online: ${online}`);

    // Update counters
    if (online === 0) {
      consecutiveEmpty++;
      consecutiveOccupied = 0;
    } else {
      consecutiveOccupied++;
      consecutiveEmpty = 0;
    }

    // JOIN
    if (online === 0 && !bot && consecutiveEmpty >= JOIN_CONSECUTIVE_EMPTY) {
      console.log('[+] Server idle → Starting bot...');
      startBot();
      consecutiveEmpty = 0;
      consecutiveOccupied = 0;
    }

    // LEAVE
    if (online > 0 && bot && consecutiveOccupied >= LEAVE_CONSECUTIVE_OCCUPIED) {
      console.log('[!] Real player detected → Bot leaving...');
      stopBot('player-joined');
      consecutiveEmpty = 0;
      consecutiveOccupied = 0;
    }

  } catch (err) {
    // exponential backoff on failure
    backoffMs = backoffMs ? Math.min(backoffMs * 2, MAX_BACKOFF_MS) : 2000;
    console.log(new Date().toISOString(), `[Check Error] ${err.message}. Backoff: ${backoffMs}ms`);

    if (monitorTimer) {
      clearInterval(monitorTimer);
      monitorTimer = setInterval(wrappedCheck, Math.max(CHECK_INTERVAL_MS, backoffMs));
    }
  }
}

async function wrappedCheck() { await checkServerOnce(); }

// ================= BOT LIFECYCLE =================
function startBot() {
  if (bot) return;

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: VERSION
  });

  // Spawn timeout protection
  const spawnTimeout = setTimeout(() => {
    if (bot && !bot.player) {
      console.log('[!] Spawn timeout — destroying bot instance');
      try { bot.quit(); } catch {}
      bot = null;
    }
  }, 15000);

  bot.once('spawn', () => {
    clearTimeout(spawnTimeout);
    console.log(`[+] Bot spawned as ${bot.username} — AFK Spectator`);

    sendCommandSafe('/gamemode spectator');
    startPanLoop();
  });

  bot.on('kicked', (reason) => {
    console.log('[Bot] Kicked:', reason);
    stopBot('kicked');
  });

  bot.on('end', () => {
    console.log('[Bot] Connection ended.');
    stopBot('end');
  });

  bot.on('error', (err) => {
    console.log('[Bot Error]', err.message ?? err);
    stopBot('error');
  });
}

function sendCommandSafe(cmd) {
  if (!bot || !bot.connected) return;
  try { bot.chat(cmd); } catch {}
}

// ===== AFK Animation =====
let panInterval = null;
let panDirection = 1;
let panAngle = 0;
function startPanLoop() {
  stopPanLoop();
  panInterval = setInterval(() => {
    if (!bot || !bot.player) return;
    panAngle += panDirection * 0.3;
    if (panAngle > PAN_AMPLITUDE_DEG || panAngle < -PAN_AMPLITUDE_DEG) panDirection *= -1;
    const yaw = (panAngle * Math.PI) / 180;
    const pitch = Math.sin(Date.now() / 3000) * 0.08;
    try { bot.look(yaw, pitch, true); } catch {}
  }, PAN_INTERVAL_MS / 10);
}

function stopPanLoop() {
  if (panInterval) clearInterval(panInterval);
  panInterval = null;
}

function stopBot(reason = 'manual') {
  stopPanLoop();
  if (!bot) return;
  try { if (bot.connected) bot.quit(); } catch {}
  bot = null;
  console.log(`[Bot] Stopped (${reason}).`);
}

// ===== Graceful shutdown =====
function shutdownAndExit() {
  shuttingDown = true;
  if (monitorTimer) clearInterval(monitorTimer);
  stopBot('shutdown');
  console.log('[Monitor] Exiting.');
  process.exit(0);
}
process.on('SIGINT', shutdownAndExit);
process.on('SIGTERM', shutdownAndExit);

// ===== Start monitor =====
function startMonitor() {
  if (monitorTimer) clearInterval(monitorTimer);
  console.log('[Monitor] Starting — checking every', CHECK_INTERVAL_MS, 'ms');
  wrappedCheck();
  monitorTimer = setInterval(wrappedCheck, CHECK_INTERVAL_MS);
}

startMonitor();
