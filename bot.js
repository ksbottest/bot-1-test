const mineflayer = require("mineflayer");
const util = require("minecraft-server-util");

const HOST = "ksnexus.progamer.me";
const PORT = 16736;
const USERNAME = "nexus";
const CHECK_MS = 5000; // 5s
const AFK_MS = 10000; // 15s anti-kick action

let bot = null;
let afkLoop = null;

// === CHECK SERVER === //
async function checkPlayers() {
  try {
    const res = await util.status(HOST, PORT);
    const count = res.players.online;

    console.log(`[Check] players online: ${count}`);

    if (count === 0 && !bot) {
      console.log("[+] Empty → start AFK bot");
      startBot();
    }

    if (count > 0 && bot) {
      console.log("[!] Player joined → quit bot");
      stopBot();
    }
  } catch {
    console.log("[Error] Cannot reach server");
  }
}

// === START BOT === //
function startBot() {
  bot = mineflayer.createBot({
    host: HOST,
    port: PORT,
    username: USERNAME,
    version: false // auto
  });

  bot.once("spawn", () => {
    console.log(`[+] Bot spawned (${USERNAME})`);
    bot.chat("/gamemode spectator");

    // start AFK
    startAFK();
  });

  bot.on("end", () => {
    console.log("[Bot] Disconnected");
    stopAFK();
    bot = null;
  });

  bot.on("error", () => console.log("[Bot] Error"));
}

// === STOP BOT === //
function stopBot() {
  if (bot) bot.quit();
  stopAFK();
  bot = null;
}

// === AFK SYSTEM (anti-kick) === //
function startAFK() {
  stopAFK(); // safe
  afkLoop = setInterval(() => {
    if (!bot) return;

    // Small random rotation
    const yaw = Math.random() * Math.PI * 2;
    const pitch = (Math.random() - 0.5) * 0.5;
    bot.look(yaw, pitch, true);

    // Random little swing or sneak
    if (Math.random() < 0.5) bot.setControlState("sneak", true);
    setTimeout(() => bot.setControlState("sneak", false), 500);
  }, AFK_MS);
}

function stopAFK() {
  if (afkLoop) clearInterval(afkLoop);
  afkLoop = null;
}

// === MAIN LOOP === //
setInterval(checkPlayers, CHECK_MS);
console.log(`[Monitor] Checking every ${CHECK_MS} ms`);
