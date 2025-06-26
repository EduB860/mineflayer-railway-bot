const express = require("express");
const http = require("http");
const mineflayer = require("mineflayer");
const pvp = require("mineflayer-pvp").plugin;
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const armorManager = require("mineflayer-armor-manager");
const AutoAuth = require("mineflayer-auto-auth");

const app = express();
app.use(express.json());

app.get("/", (_, res) => res.send("Botul e online!"));
app.listen(process.env.PORT || 3000, () => {
  console.log("Web server listening on port", process.env.PORT || 3000);
});

let reconnectTimeout = 10000;

function createBot() {
  const bot = mineflayer.createBot({
    host: "rokbedrock.falixsrv.me",
    version: "1.16.5",
    username: "Bot",
    port: 36188,
    plugins: [AutoAuth],
    AutoAuth: "bot112022"
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  // Anti-AFK (jump + forward)
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

  bot.on("playerCollect", (collector, itemDrop) => {
    if (collector !== bot.entity) return;
    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes("sword"));
      if (sword) bot.equip(sword, "hand");
    }, 150);
  });

  bot.on("playerCollect", (collector, itemDrop) => {
    if (collector !== bot.entity) return;
    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes("shield"));
      if (shield) bot.equip(shield, "off-hand");
    }, 250);
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

  bot.on("stoppedAttacking", () => {
    if (guardPos) moveToGuardPos();
  });

  bot.on("physicTick", () => {
    if (bot.pvp.target || bot.pathfinder.isMoving()) return;
    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
  });

  bot.on("physicTick", () => {
    if (!guardPos) return;
    const filter = e =>
      e.type === "mob" &&
      e.position.distanceTo(bot.entity.position) < 16 &&
      e.mobType !== "Armor Stand";
    const entity = bot.nearestEntity(filter);
    if (entity) bot.pvp.attack(entity);
  });

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

  bot.on("kicked", reason => {
    console.log("Bot was kicked:", reason);
  });

  bot.on("error", err => {
    console.error("Bot encountered an error:", err);
    console.log(`Reconnecting in ${reconnectTimeout / 1000} seconds...`);
    clearInterval(antiAFK);
    setTimeout(() => {
      createBot();
      reconnectTimeout = Math.min(reconnectTimeout * 2, 60000);
    }, reconnectTimeout);
  });

  bot.on("end", () => {
    console.log(`Bot disconnected. Reconnecting in ${reconnectTimeout / 1000} seconds...`);
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
}

createBot();
