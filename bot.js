const mineflayer = require("mineflayer");
const util = require("minecraft-server-util");

const HOST = "ksnexus.progamer.me";
const PORT = 16736;
const USERNAME = "kingly";
const PASSWORD = "kingly@12345";

const CHECK_MS = 2000;
const RETRY_MS = 15000;

let bot = null;

// Sleep helper
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Check server
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
    console.log("[Error] Cannot reach server.");
    await sleep(RETRY_MS);
  }
}

// Start Bot
function startBot() {
  if (bot) return;

  console.log("[i] Creating bot...");
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME
  });

  bot.once("spawn", () => {
    console.log(`[+] Bot spawned as ${USERNAME}`);
    setTimeout(() => bot.chat(`/login ${PASSWORD}`), 1000);
    startAFK();
  });

  bot.on("end", () => console.log("[×] Bot ended"));
  bot.on("kicked", () => console.log("[×] Bot kicked"));
  bot.on("error", err => console.log("[×] Bot error:", err));
}

// Stop Bot
function stopBot() {
  if (bot) {
    try { bot.quit(); } catch {}
  }
  bot = null;
}

// AFK actions
function startAFK() {
  if (!bot) return;

  // Random Jump
  if (Math.random() < 0.4) bot.setControlState("jump", true);
  setTimeout(() => bot.setControlState("jump", false), 300);

  // Random Look
  bot.look(Math.random() * Math.PI * 2, 0, true);

  // Random Move
  if (Math.random() < 0.7) {
    bot.setControlState("forward", true);
    setTimeout(() => bot.setControlState("forward", false), 1000);
  }

  // Obstacle handling
  try {
    const front = bot.blockAt(bot.entity.position.offset(0, 0, 1));
    if (front && front.boundingBox !== "empty") {
      bot.setControlState("jump", true);
      setTimeout(() => bot.setControlState("jump", false), 500);
    }
  } catch {}
}

// Main loop
setInterval(checkPlayers, CHECK_MS);
