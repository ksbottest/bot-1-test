const mineflayer = require("mineflayer");
const util = require("minecraft-server-util");

const HOST = "ksnexus.progamer.me";
const PORT = 16736;
const USERNAME = "kingly"; // offline mode username
const CHECK_MS = 2000;
const AFK_MS = 10000;
const RETRY_MS = 15000; // wait 15s before reconnecting

let bot = null;
let afkLoop = null;

// === Sleep function ===
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === CHECK SERVER ===
async function checkPlayers() {
  try {
    const res = await util.status(HOST, PORT);
    const count = res.players.online;

    if (count === 0 && !bot) {
      console.log("[+] Server empty → starting AFK bot...");
      startBot();
    }

    if (count > 1 && bot) {
      console.log("[!] Players joined → stopping AFK bot...");
      stopBot();
    }
  } catch (err) {
    console.log("[Error] Cannot reach server:", err);
    await sleep(25000);
  }
}

// === START BOT ===
function startBot() {
  if (bot) return;

  console.log("[i] Creating bot...");

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: false,
    // acceptResourcePack: true // Uncomment if you want to try ignoring pack
  });

  bot.once("login", () => {
    console.log("[i] Bot logged in, waiting for resource pack...");
  });

  bot.once("spawn", () => {
    console.log(`[+] Bot spawned as ${USERNAME}`);
    console.log(`/register kingly@12345 kingly@12345`);
    startAFK();
  });

  bot.on("end", () => {
    console.log("[-] Bot disconnected");
    stopAFK();
    bot = null;
    console.log(`[i] Reconnecting in ${RETRY_MS / 1000}s...`);
    setTimeout(startBot, RETRY_MS);
  });

  bot.on("kicked", reason => {
    console.log("[-] Bot kicked:", reason);
    stopAFK();
    bot = null;
    console.log(`[i] Reconnecting in ${RETRY_MS / 1000}s...`);
    setTimeout(startBot, RETRY_MS);
  });

  bot.on("error", err => console.log("[×] Bot error:", err));
}

// === STOP BOT ===
function stopBot() {
  if (bot) bot.quit();
  stopAFK();
  bot = null;
}

// === AFK SYSTEM ===
function startAFK() {
  stopAFK();
  afkLoop = setInterval(() => {
    if (!bot) return;

    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.5;
    bot.look(yaw, pitch, true);

    if (Math.random() < 0.5) bot.setControlState("sneak", true);
    setTimeout(() => bot.setControlState("sneak", false), 500);

  }, AFK_MS);
}

function stopAFK() {
  if (afkLoop) clearInterval(afkLoop);
  afkLoop = null;
}

// === MAIN LOOP ===
setInterval(checkPlayers, CHECK_MS);
