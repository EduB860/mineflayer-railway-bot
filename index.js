const express = require("express");
const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const AutoAuth = require("mineflayer-auto-auth");

const app = express();
app.use(express.json());
app.get("/", (_, res) => res.send("Botul e online!"));
app.listen(process.env.PORT || 3000, () => console.log("Web server on", process.env.PORT || 3000));

let reconnectTimeout = 10000;

function createBot() {
  const bot = mineflayer.createBot({
    host: "rokbedrock.falixsrv.me",
    port: 36188,
    username: "Bot",
    version: "1.16.5",
    plugins: [AutoAuth],
    AutoAuth: "bot112022"
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  const antiAFK = setInterval(() => {
    if (!bot.entity) return;
    bot.setControlState("jump", true);
    setTimeout(() => bot.setControlState("jump", false), 500);
  }, 30000);

  let guardPos = null;
  function guardArea(pos) { guardPos = pos.clone(); if (!bot.pvp.target) moveToGuardPos(); }
  function stopGuarding() { guardPos = null; bot.pvp.stop(); bot.pathfinder.setGoal(null); }
  function moveToGuardPos() {
    const mcData = require("minecraft-data")(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
  }

  bot.on("chat", (u, msg) => {
    const p = bot.players[u]?.entity;
    if (!p) return;
    if (msg === "guard") { bot.chat("I will!"); guardArea(p.position); }
    if (msg === "stop") { bot.chat("Stopping."); stopGuarding(); }
  });

  bot.on('physicsTick', () => {
    if (guardPos && !bot.pvp.target) {
      const e = bot.nearestEntity(e => e.type === "mob" && e.position.distanceTo(bot.entity.position) < 16 && e.mobType !== "Armor Stand");
      if (e) bot.pvp.attack(e);
    }
  });

  function reconnect(reason) {
    console.log(reason);
    clearInterval(antiAFK);
    setTimeout(createBot, reconnectTimeout);
    reconnectTimeout = Math.min(reconnectTimeout * 2, 60000);
  }

  bot.on("end", () => reconnect("Disconnected"));
  bot.on("error", err => reconnect("Error: " + err));
  bot.once("spawn", () => reconnectTimeout = 10000);
}

createBot();
