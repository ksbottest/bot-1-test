const mineflayer = require("mineflayer");
const util = require("minecraft-server-util");

const HOST = "ksnexus.progamer.me";
const PORT = 16736;
const USERNAME = "kingly"; // offline mode username
const PASSWORD = "kingly@12345";

const CHECK_MS = 2000;
const AFK_MS = 10000;
const RETRY_MS = 15000;

let bot = null;
let afkLoop = null;

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
    version: false
  });

  // === LOGIN ON JOIN ===
  bot.once("spawn", () => {
    console.log(`[+] Bot spawned as ${USERNAME}`);
    setTimeout(() => bot.chat(`/login ${PASSWORD}`), 1000);
    startAFK();
  });

  // === KICKED / DISCONNECT HANDLER ===
  bot.on("end", () => console.log("[×] Bot end:"));
  bot.on("kicked", (reason) => console.log("[×] Bot kicked:"));
  bot.on("error", err => console.log("[×] Bot error:", err));
}

// === STOP BOT ===
function stopBot() {
  if (bot) {
    try { bot.quit(); } catch { }
  }
  bot = null;
  stopAFK();
}

// === AFK SYSTEM ===
function startAFK() {
  if (!bot) return;

  // === Random Jump === //
  if (Math.random() < 0.4) bot.setControlState("jump", true);
  setTimeout(() => bot.setControlState("jump", false), 300);

  // === Try walking in a random radius (circle) === //
  const angle = Math.random() * Math.PI * 2; // random rotation
  bot.look(angle, 0, true);

  // Move forward randomly
  if (Math.random() < 0.7) {
    bot.setControlState("forward", true);
    setTimeout(() => bot.setControlState("forward", false), 1000);
  }

  // === Check block in front & avoid === //
  try {
    const front = bot.blockAt(bot.entity.position.offset(0, 0, 1));
    if (front && !front.boundingBox === "empty") {
      bot.setControlState("jump", true); // jump if blocked
      setTimeout(() => bot.setControlState("jump", false), 500);
    }
  } catch (err) {}
}

function stopAFK() {
  if (afkLoop) clearInterval(afkLoop);
  afkLoop = null;
}

// === MAIN LOOP ===
setInterval(checkPlayers, CHECK_MS);
