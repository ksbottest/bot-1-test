const mineflayer = require("mineflayer");
const util = require("minecraft-server-util");

const HOST = "ksnexus.progamer.me";
const PORT = 16736;
const USERNAME = "nexus";
const CHECK_MS = 1000;  // How often to check server
const AFK_MS = 10000;   // How often the bot moves

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
    await sleep(25000); // Wait 25s before retrying
  }
}

// === START BOT ===
function startBot() {
  if (bot) return;

  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: false // auto-detect
  });

  // Login event
  bot.once("login", () => {
    console.log("[i] Bot logged in, waiting for resource pack...");
  });

  // Resource pack handling
  bot.on("resourcePack", (url, hash) => {
    console.log(`[i] Server requested resource pack: ${url}`);
    bot.acceptResourcePack(true)
      .then(() => console.log("[i] Resource pack accepted!"))
      .catch(err => {
        console.log("[!] Failed to accept resource pack:", err);
        bot.quit();
      });
  });

  // Track resource pack status
  bot.on("resourcePackStatus", status => {
    console.log(`[i] Resource pack status: ${status}`);
    if (status === "FAILED_DOWNLOAD" || status === "DECLINED") {
      console.log("[!] Resource pack not accepted, quitting bot.");
      bot.quit();
    }
  });

  // Spawn event
  bot.once("spawn", () => {
    console.log(`[+] Bot spawned as ${USERNAME}`);
    startAFK();
  });

  // Disconnect events
  bot.on("end", () => {
    console.log("[-] Bot disconnected");
    stopAFK();
    bot = null;
  });

  bot.on("kicked", reason => {
    console.log("[-] Bot kicked:", reason);
    stopAFK();
    bot = null;
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

    // Random small head movement
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.5;
    bot.look(yaw, pitch, true);

    // Random sneak
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
