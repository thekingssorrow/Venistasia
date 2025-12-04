// =========================
// Basic game state
// =========================

const gameState = {
  playerId: null, // will be filled from localStorage
  player: {
    name: "Adventurer",
    level: 1,
    xp: 0,
    xpToLevel: 100,
    hp: 20,
    maxHp: 20,
  },
  inventory: [
    { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
  ],
  location: "village_square",
  flags: {},
  combat: {
    inCombat: false,
    enemy: null,
    previousLocation: null,
  },
};

// =========================
// Utility: player ID
// =========================

function getOrCreatePlayerId() {
  const key = "venistasia_player_id";
  let id = localStorage.getItem(key);
  if (!id) {
    // If crypto.randomUUID isn't available, fallback
    if (window.crypto && crypto.randomUUID) {
      id = "P-" + crypto.randomUUID();
    } else {
      id = "P-" + Math.random().toString(36).slice(2);
    }
    localStorage.setItem(key, id);
  }
  return id;
}

// Simple RNG helper
function roll(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =========================
// DOM references (filled on DOMContentLoaded)
// =========================

let outputEl,
  formEl,
  inputEl,
  saveIndicatorEl,
  statusNameEl,
  statusLevelEl,
  statusHpEl,
  statusXpEl;

// =========================
// UI helpers
// =========================

function updateStatusBar() {
  if (!statusNameEl) return; // in case DOM didn't init correctly
  const p = gameState.player;
  statusNameEl.textContent = `Name: ${p.name}`;
  statusLevelEl.textContent = `Level: ${p.level}`;
  statusHpEl.textContent = `HP: ${p.hp}/${p.maxHp}`;
  statusXpEl.textContent = `XP: ${p.xp}/${p.xpToLevel}`;
}

function logSystem(text) {
  if (!outputEl) {
    console.log("[SYSTEM]", text);
    return;
  }
  const line = document.createElement("div");
  line.className = "output-line system";
  line.textContent = text;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function logCommand(text) {
  if (!outputEl) {
    console.log("[COMMAND]", text);
    return;
  }
  const line = document.createElement("div");
  line.className = "output-line command";
  line.textContent = `> ${text}`;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

// =========================
// World + locations
// =========================

const locations = {
  village_square: {
    name: "Briar's Edge, Village Square",
    description:
      "You stand in the small square of Briar's Edge, a frontier village clinging to the edge of the Shaded Frontier. To the north, the forest waits in a dark line.",
  },
  dark_forest_edge: {
    name: "Forest Edge",
    description:
      "The trees rise like a wall of black timber. A narrow path pushes north between the trunks, toward the quake-torn ground and the exposed ruin. The village lies to the south.",
  },
  dungeon_entrance: {
    name: "Dawnspire – Broken Ring",
    description:
      "Shattered stone forms a ring around a yawning hole in the earth. Rough steps descend into cold darkness. The air smells of dust, stone, and something that has waited a long time.",
  },
};

function describeLocation() {
  const loc = locations[gameState.location];
  if (!loc) {
    logSystem("You are... nowhere? (Invalid location)");
    return;
  }
  logSystem(`${loc.name}\n${loc.description}`);
}

function handleLook() {
  if (gameState.combat.inCombat) {
    const e = gameState.combat.enemy;
    if (!e) {
      logSystem("You blink, disoriented. The danger seems to have passed.");
      return;
    }
    logSystem(
      `${e.name}\n${e.description}\n\nIt has ${e.hp}/${e.maxHp} HP remaining.`
    );
  } else {
    describeLocation();
  }
}

function handleInventory() {
  if (gameState.inventory.length === 0) {
    logSystem("Your inventory is empty.");
    return;
  }
  const lines = gameState.inventory.map((item, i) => `${i + 1}. ${item.name}`);
  logSystem("You are carrying:\n" + lines.join("\n"));
}

// =========================
// Combat system
// =========================

// Enemy templates
const enemyTemplates = {
  dawnspire_rat: {
    id: "dawnspire_rat",
    name: "Starved Tunnel-Rat",
    maxHp: 8,
    atkMin: 1,
    atkMax: 3,
    xpReward: 12,
    description:
      "A hairless, oversized rat with milky eyes and too many teeth. It skitters in tight circles, desperate and hungry.",
  },
  // You can add more enemies later here.
};

function createEnemyInstance(enemyId) {
  const tmpl = enemyTemplates[enemyId];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    name: tmpl.name,
    maxHp: tmpl.maxHp,
    hp: tmpl.maxHp,
    atkMin: tmpl.atkMin,
    atkMax: tmpl.atkMax,
    xpReward: tmpl.xpReward,
    description: tmpl.description,
  };
}

function startCombat(enemyId) {
  const enemy = createEnemyInstance(enemyId);
  if (!enemy) {
    logSystem("Something should be here, but isn't. (Missing enemy data.)");
    return;
  }

  gameState.combat.inCombat = true;
  gameState.combat.enemy = enemy;
  gameState.combat.previousLocation = gameState.location;

  logSystem(
    [
      "Something moves in the dark.",
      `${enemy.name} emerges from the shadows!`,
      "",
      enemy.description,
      "",
      "Type 'attack' to fight or 'run' to try to flee."
    ].join("\n")
  );
}

function endCombat() {
  gameState.combat.inCombat = false;
  gameState.combat.enemy = null;
  gameState.combat.previousLocation = null;
}

function handlePlayerDeath() {
  logSystem(
    "Your vision narrows and fades as you collapse. Whatever waits in the depths will have to feed on someone else... for now."
  );
  // For now we just auto-reset to make testing easier
  handleReset();
}

function gainXp(amount) {
  const p = gameState.player;
  p.xp += amount;
  logSystem(`You gain ${amount} XP.`);
  while (p.xp >= p.xpToLevel) {
    p.xp -= p.xpToLevel;
    p.level += 1;
    p.maxHp += 5;
    p.hp = p.maxHp;
    p.xpToLevel = Math.round(p.xpToLevel * 1.3);
    logSystem(`*** You reached level ${p.level}! Max HP is now ${p.maxHp}. ***`);
  }
  updateStatusBar();
}

function handleAttack() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing here to attack.");
    return;
  }

  const enemy = gameState.combat.enemy;
  const weapon = gameState.inventory.find((i) => i.type === "weapon");
  const weaponAtk = weapon ? weapon.atk : 0;

  const dmg = roll(1 + weaponAtk, 4 + weaponAtk);
  enemy.hp -= dmg;
  logSystem(`You strike the ${enemy.name} for ${dmg} damage.`);

  if (enemy.hp <= 0) {
    logSystem(`The ${enemy.name} collapses. The echo of the struggle fades.`);
    const xp = enemy.xpReward || 0;
    if (xp > 0) {
      gainXp(xp);
    }
    endCombat();
    return;
  }

  // Enemy turn
  const enemyDmg = roll(enemy.atkMin, enemy.atkMax);
  gameState.player.hp -= enemyDmg;
  logSystem(`The ${enemy.name} claws at you for ${enemyDmg} damage.`);
  if (gameState.player.hp <= 0) {
    gameState.player.hp = 0;
    updateStatusBar();
    handlePlayerDeath();
    return;
  }

  updateStatusBar();
  logSystem(
    `You have ${gameState.player.hp}/${gameState.player.maxHp} HP remaining.`
  );
}

function handleRun() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing to run from right now.");
    return;
  }

  const successRoll = roll(1, 100);
  if (successRoll <= 60) {
    // Successful escape
    const prev = gameState.combat.previousLocation || "dark_forest_edge";
    logSystem("You turn and bolt, scrambling away from the fight!");
    endCombat();
    gameState.location = prev;
    describeLocation();
  } else {
    // Failed escape
    logSystem("You try to flee, but the enemy cuts you off!");
    const enemy = gameState.combat.enemy;
    const enemyDmg = roll(enemy.atkMin, enemy.atkMax);
    gameState.player.hp -= enemyDmg;
    logSystem(`The ${enemy.name} punishes your retreat for ${enemyDmg} damage.`);
    if (gameState.player.hp <= 0) {
      gameState.player.hp = 0;
      updateStatusBar();
      handlePlayerDeath();
      return;
    }
    updateStatusBar();
    logSystem(
      `You have ${gameState.player.hp}/${gameState.player.maxHp} HP remaining.`
    );
  }
}

// =========================
// Movement
// =========================

function handleGo(direction) {
  // no moving while in combat
  if (gameState.combat.inCombat) {
    logSystem("You're a little busy not dying right now. Try 'attack' or 'run'.");
    return;
  }

  const loc = gameState.location;

  if (loc === "village_square" && direction === "north") {
    gameState.location = "dark_forest_edge";
    logSystem("You walk north, leaving the safety of Briar's Edge behind...");
    describeLocation();
    gainXp(5); // simple: reward exploring a bit
    return;
  }

  if (loc === "dark_forest_edge" && direction === "south") {
    gameState.location = "village_square";
    logSystem("You walk back south, returning to the village square.");
    describeLocation();
    return;
  }

  if (loc === "dark_forest_edge" && direction === "north") {
    gameState.location = "dungeon_entrance";
    logSystem(
      "You follow the path to the quake-torn clearing. The broken stone ring looms ahead as you approach the Dawnspire Below..."
    );
    describeLocation();
    // First encounter
    if (!gameState.flags.firstDungeonFightDone) {
      gameState.flags.firstDungeonFightDone = true;
      startCombat("dawnspire_rat");
    }
    return;
  }

  if (loc === "dungeon_entrance" && direction === "south") {
    gameState.location = "dark_forest_edge";
    logSystem("You climb back up out of the broken ring and return to the forest edge.");
    describeLocation();
    return;
  }

  logSystem("You can't go that way.");
}

// =========================
// Help / name / reset
// =========================

function handleHelp() {
  logSystem(
    [
      "Available commands:",
      "  help               - show this help",
      "  look               - describe your surroundings or current foe",
      "  inventory (or inv) - show your items",
      "  go <direction>     - move (e.g., 'go north')",
      "  name <your name>   - set your name",
      "  attack             - attack the enemy in combat",
      "  run                - attempt to flee from combat",
      "  reset              - wipe your progress and restart",
    ].join("\n")
  );
}

function handleName(name) {
  if (!name) {
    logSystem("You must provide a name. Example: name Six");
    return;
  }
  gameState.player.name = name;
  logSystem(`You will be known as ${name}.`);
  updateStatusBar();
}

// Intro / story

function showIntro() {
  const introText = [
    "Briar's Edge is a quiet village on the very edge of the Shaded Frontier, one of the last places where the empire's maps fade away into wilderness.",
    "",
    "You grew up hearing stories of the Lantern Knights, wanderers who carried crystal lanterns into the deep woods to fight back the darkness.",
    "You believed every word of those tales. Maybe you still do.",
    "",
    "Recently, rumors spread of an ancient ruin unearthed after a quake: a stone ring jutting from the earth, leading down into what people now call the Dawnspire Below.",
    "Some whisper of treasure. Others of relics left behind by the Lantern Knights.",
    "And strangely, posters appeared overnight in the village square, promising fame, fortune, and glory to anyone brave enough to enter.",
    "",
    "Armed with a rust-flecked sword and an oversized pack, you step toward the forest's edge. The morning is still. Too still.",
    "",
    "But the northern path draws you in, just as the old stories once did.",
    "",
    "And somewhere far below the ground, something stirs, waiting for you to arrive.",
  ].join("\n");

  logSystem(introText);
  describeLocation();
}

// Reset / wipe save

function handleReset() {
  logSystem("Wiping your progress and starting a new run...");

  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  gameState.player = {
    name: "Adventurer",
    level: 1,
    xp: 0,
    xpToLevel: 100,
    hp: 20,
    maxHp: 20,
  };

  gameState.inventory = [
    { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
  ];
  gameState.location = "village_square";
  gameState.flags = {};
  gameState.combat = {
    inCombat: false,
    enemy: null,
    previousLocation: null,
  };

  updateStatusBar();
  showIntro();
  scheduleSave();
}

// =========================
// Command parser
// =========================

function handleCombatCommand(cmd, raw, rest) {
  switch (cmd) {
    case "attack":
      handleAttack();
      break;
    case "run":
      handleRun();
      break;
    case "look":
      handleLook();
      break;
    case "inventory":
    case "inv":
      handleInventory();
      break;
    case "help":
      handleHelp();
      break;
    default:
      logSystem("In the heat of battle, that command makes no sense. Try 'attack' or 'run'.");
      break;
  }
}

function handleCommand(raw) {
  const input = raw.trim();
  if (!input) return;

  logCommand(input);

  const [cmd, ...rest] = input.toLowerCase().split(/\s+/);
  const argStr = rest.join(" ");

  if (gameState.combat.inCombat) {
    handleCombatCommand(cmd, raw, rest);
    scheduleSave();
    return;
  }

  switch (cmd) {
    case "help":
      handleHelp();
      break;
    case "look":
      handleLook();
      break;
    case "inventory":
    case "inv":
      handleInventory();
      break;
    case "go":
      if (!rest.length) {
        logSystem("Go where? (north, south, east, west)");
      } else {
        handleGo(rest[0]);
      }
      break;
    case "name":
      // preserve capitalization after 'name '
      handleName(raw.slice(5).trim());
      break;
    case "attack":
      logSystem("There's nothing here to attack.");
      break;
    case "run":
      logSystem("There's nothing to run from.");
      break;
    case "reset":
      handleReset();
      break;
    default:
      logSystem("You mumble, unsure what that means. (Type 'help' for commands.)");
      break;
  }

  // After each command, schedule a save
  scheduleSave();
}

// =========================
// Autosave to server
// =========================

let saveTimeout = null;
let lastSaveTime = null;

function setSaveIndicator(text) {
  if (!saveIndicatorEl) return;
  saveIndicatorEl.textContent = text;
}

function scheduleSave() {
  setSaveIndicator("Changes pending...");
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveGameToServer, 3000);
}

async function saveGameToServer() {
  saveTimeout = null;

  try {
    const payload = {
      playerId: gameState.playerId,
      state: gameState,
    };

    const res = await fetch("api/save.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data && data.success) {
      lastSaveTime = new Date();
      setSaveIndicator("Last saved just now");
    } else {
      setSaveIndicator("Save failed (server error).");
    }
  } catch (err) {
    console.error("Save error:", err);
    setSaveIndicator("Save failed (network error).");
  }
}

async function loadGameFromServer() {
  logSystem("Loading your adventure...");
  try {
    const res = await fetch("api/load.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: gameState.playerId }),
    });

    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    if (data && data.state) {
      Object.assign(gameState, data.state);
      logSystem("Welcome back. Your adventure has been restored.");
      if (gameState.combat && gameState.combat.inCombat && gameState.combat.enemy) {
        logSystem("You come back to your senses in the middle of a fight!");
      }
      describeLocation();
    } else {
      showIntro();
    }
  } catch (err) {
    console.error("Load error:", err);
    logSystem("Could not load save; starting a new game.");
    showIntro();
  }

  updateStatusBar();
  setSaveIndicator("Loaded / ready.");
}

// =========================
// Init: run AFTER DOM is ready
// =========================

window.addEventListener("DOMContentLoaded", () => {
  // Grab DOM elements now that they exist
  outputEl = document.getElementById("output");
  formEl = document.getElementById("command-form");
  inputEl = document.getElementById("command-input");
  saveIndicatorEl = document.getElementById("save-indicator");
  statusNameEl = document.getElementById("status-name");
  statusLevelEl = document.getElementById("status-level");
  statusHpEl = document.getElementById("status-hp");
  statusXpEl = document.getElementById("status-xp");

  if (!outputEl || !formEl || !inputEl) {
    console.error("Game UI elements not found in DOM.");
    return;
  }

  gameState.playerId = getOrCreatePlayerId();
  updateStatusBar();

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = inputEl.value;
    inputEl.value = "";
    handleCommand(value);
  });

  loadGameFromServer();
});
