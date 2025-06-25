const express = require("express");
const http = require("http");
const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const AutoAuth = require("mineflayer-auto-auth");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (_, res) => res.send("Botul e pornit!"));
app.listen(PORT, () => console.log(`Web server on ${PORT}`));

// Anti-sleep auto-ping (UptimeRobot-friendly)
setInterval(() => {
  http.get("http://localhost:" + PORT);
}, 280000); // la fiecare ~5 minute

let reconnectTimeout = 10000;

function createBot() {
  const bot = mineflayer.createBot({
    host: "rokbedrock.falixsrv.me",
    port: 36188,
    version: "1.16.5",
    username: "Bot",
    plugins: [AutoAuth],
    AutoAuth: "bot112022",
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  // Anti-AFK loop
  const antiAFK = setInterval(() => {
    if (!bot || !bot.entity) return;
    bot.setControlState("jump", true);
    bot.setControlState("forward", true);
    bot.look(bot.entity.yaw + Math.random() * 0.5, 0);
    setTimeout(() => {
      bot.setControlState("jump", false);
      bot.setControlState("forward", false);
    }, 500);
  }, 30000);

  bot.on("chat", (username, message) => {
    const player = bot.players[username]?.entity;
    if (!player) return;
    if (message === "guard") {
      bot.chat("I will!");
      guardArea(player.position);
    }
    if (message === "stop") {
      bot.chat("I will stop!");
      stopGuarding();
    }
  });

  let guardPos = null;

  function guardArea(pos) {
    guardPos = pos.clone();
    if (!bot.pvp.target) moveToGuardPos();
  }

  function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
  }

  function moveToGuardPos() {
    const mcData = require("minecraft-data")(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
  }

  bot.on("physicTick", () => {
    if (guardPos && !bot.pvp.target) {
      const filter = e =>
        e.type === "mob" &&
        e.position.distanceTo(bot.entity.position) < 16 &&
        e.mobType !== "Armor Stand";
      const entity = bot.nearestEntity(filter);
      if (entity) bot.pvp.attack(entity);
    }
  });

  bot.on("end", () => {
    console.log(`Bot disconnected. Reconnecting in ${reconnectTimeout / 1000}s`);
    clearInterval(antiAFK);
    setTimeout(() => {
      createBot();
      reconnectTimeout = Math.min(reconnectTimeout * 2, 60000);
    }, reconnectTimeout);
  });

  bot.once("spawn", () => {
    reconnectTimeout = 10000;
    console.log("Bot spawned, reconnect timeout reset.");
  });

  bot.on("error", err => {
    console.log("Bot error:", err);
  });
}

createBot();
