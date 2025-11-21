// bot.js
const mineflayer = require("mineflayer");

// ===== CONFIG ===== //
const HOST = "ksnexus.progamer.me";
const PORT = 16736;
const USERNAME = "nexus"; // change to any name
const VERSION = false;    // auto-detect
const RECONNECT_MS = 5000;
// =================== //

let bot = null;

function startBot() {
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: VERSION
  });

  bot.once("spawn", () => {
    console.log(`[+] Logged in as ${bot.username}`);
    startAFK();
  });

  bot.on("end", () => {
    console.log("[!] Bot disconnected. Reconnecting...");
    setTimeout(startBot, RECONNECT_MS);
  });

  bot.on("error", (err) => {
    console.log("[!] Error:", err.message);
  });
}

// ---- Simple AFK Movement ---- //
function startAFK() {
  console.log("[AFK] moving slowly...");

  setInterval(() => {
    if (!bot || !bot.entity) return;
    const yaw = Math.random() * Math.PI * 2;
    bot.look(yaw, 0, false);
    bot.setControlState("forward", true);
    setTimeout(() => bot.setControlState("forward", false), 3000);
  }, 6000);
}

// ---- Start Bot ---- //
startBot();
