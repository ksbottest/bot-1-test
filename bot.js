const mineflayer = require("mineflayer");  
const util = require("minecraft-server-util");  
  
const HOST = "ksnexus.progamer.me";  
const PORT = 16736;  
const USERNAME = "nexus";  
const CHECK_MS = 1000;  
const AFK_MS = 10000;   
  
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
      console.log("[+] Empty → start AFK bot");  
      startBot();  
    }  

    if (count > 1 && bot) {  
      console.log("[!] Player joined → quit bot");  
      stopBot();  
    }  
  } catch (err) {  
    console.log("[Error] Cannot reach server:", err);  
    await sleep(25000);  
  }  
}  

// === START BOT ===
function startBot() {  
  if (bot) return; // safety

  bot = mineflayer.createBot({  
    host: HOST,  
    port: PORT,  
    username: USERNAME,  
    version: false // auto  
  });  

  bot.once("spawn", () => {  
    console.log(`[+] Bot spawned as ${USERNAME}`);  
    startAFK();  
  });  

  bot.on("end", () => {  
    console.log("[-] Bot Disconnected");  
    stopAFK();  
    bot = null;  
  });  

  bot.on("kicked", (reason) => {
    console.log("[-] Bot Kicked:", reason);
    stopAFK();
    bot = null;
  });

  bot.on("error", (err) => console.log("[×] Bot Error:", err));
}  

// === STOP BOT ===
function stopBot() {  
  if (bot) bot.quit();  
  stopAFK();  
  bot = null;  
}  

// === AFK SYSTEM ===
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

// === MAIN LOOP ===
setInterval(checkPlayers, CHECK_MS);
