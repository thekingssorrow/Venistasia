/* Venistasia — Single-file Text Adventure (browser JS)
   Drop this entire file into your project (e.g., venistasia.js) and include it with a <script>.
   If your HTML already has elements with these IDs, it will use them:
     #output, #commandInput, #statusName, #statusLevel, #statusHp, #statusXp
   Otherwise it will auto-build a simple UI.

   Changes implemented (per your request):
   - Provision Cellar loot is EXACTLY 2 rations, once.
   - Shrine “use shard” grants +5 Max HP permanently AND heals +5 current HP (capped),
     and also enables the “first lethal blow leaves you at 1 HP” blessing.
   - Non-combat `use` goes through extendedUseSystem, so shrine/flicker/niche shard logic works.
*/

"use strict";

// ============================================================
// MODULE 0 — UI BOOTSTRAP (auto-create if missing)
// ============================================================

(function ensureUI() {
  const has = (id) => document.getElementById(id);

  if (!has("output") || !has("commandInput") || !has("statusName")) {
    const style = document.createElement("style");
    style.textContent = `
      :root { --bg:#0f1115; --panel:#171a21; --text:#e7e9ee; --muted:#9aa3b2; --accent:#6ea8fe; --danger:#ff6b6b; }
      body { margin:0; background:var(--bg); color:var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
      .wrap { max-width: 980px; margin: 0 auto; padding: 16px; display: grid; gap: 12px; }
      .top { background:var(--panel); border:1px solid #2a2f3b; border-radius: 16px; padding: 10px 12px; display:flex; gap: 14px; flex-wrap:wrap; }
      .stat { color: var(--muted); font-size: 14px; }
      .stat b { color: var(--text); font-weight: 700; }
      .out { background:var(--panel); border:1px solid #2a2f3b; border-radius: 16px; padding: 14px; height: 62vh; overflow:auto; white-space: pre-wrap; line-height: 1.35; }
      .line { margin: 0 0 10px 0; }
      .line.command { color: var(--accent); }
      .line.system { color: var(--text); }
      .line.error { color: var(--danger); }
      form { display:flex; gap:10px; }
      input { flex:1; padding: 12px 14px; border-radius: 14px; border:1px solid #2a2f3b; background:#0b0d11; color:var(--text); font-size: 16px; outline:none; }
      button { padding: 12px 14px; border-radius: 14px; border:1px solid #2a2f3b; background:#202637; color:var(--text); font-weight:700; cursor:pointer; }
      button:hover { filter: brightness(1.05); }
      .hint { color: var(--muted); font-size: 12px; margin-left: 2px; }
    `;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    const top = document.createElement("div");
    top.className = "top";
    top.innerHTML = `
      <div class="stat" id="statusName"><b>Name:</b> —</div>
      <div class="stat" id="statusLevel"><b>Level:</b> —</div>
      <div class="stat" id="statusHp"><b>HP:</b> —</div>
      <div class="stat" id="statusXp"><b>XP:</b> —</div>
    `;

    const out = document.createElement("div");
    out.className = "out";
    out.id = "output";

    const form = document.createElement("form");
    form.id = "commandForm";
    form.innerHTML = `
      <input id="commandInput" autocomplete="off" placeholder="Type a command (help, look, go north, inventory, use bandage, adjust mirrors east)…" />
      <button type="submit">Enter</button>
    `;

    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Tip: You can type directions directly (north/south/east/west/up/down).";

    wrap.appendChild(top);
    wrap.appendChild(out);
    wrap.appendChild(form);
    wrap.appendChild(hint);
    document.body.appendChild(wrap);
  }
})();

// ============================================================
// MODULE 1 — GAME STATE
// ============================================================

const gameState = {
  playerId: null,

  player: {
    name: "Adventurer",
    level: 1,
    xp: 0,
    xpToLevel: 100,
    hp: 20,
    maxHp: 20,
  },

  // Inventory supports duplicates (stacking) + equipment items
  inventory: [
    { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "ration", name: "Travel Ration", type: "ration" },
  ],

  equipment: {
    weapon: "rusty-sword", // inventory item id
    offhand: null,         // e.g. "rust-buckler"
  },

  location: "village_square",

  flags: {
    gotLanternBadge: false,

    collapsedStairTrapDone: false,

    vestibuleCombatDone: false,
    vestibuleRatsRemaining: 0,
    gotVestibuleLoot: false,

    storeroomTrapDone: false,
    gotStoreroomLoot: false,

    flickerLootDone: false,
    flickerShardAligned: false,

    mirrorToNiche: false,
    mirrorToDoor: false,

    nicheShardTaken: false,
    nicheShardSeated: false,

    guardSpearTaken: false,

    barracksCombatDone: false,
    barracksSoldiersRemaining: 0,

    musterLoreDone: false,
    musterCombatDone: false,

    armoryTrapDone: false,
    armoryLootDone: false,

    gotProvisionRations: false, // IMPORTANT: used for room 17 (provision_cellar)

    shrineUsed: false,
    shrineBlessingActive: false,
  },

  combat: {
    inCombat: false,
    enemy: null,
    previousLocation: null,
    intent: null,
  },
};

// ============================================================
// MODULE 2 — UTILS & GENERIC HELPERS
// ============================================================

// --- Player ID + Save/Load ---
function getOrCreatePlayerId() {
  const key = "venistasia_player_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto?.randomUUID ? crypto.randomUUID() : ("P-" + Math.random().toString(36).slice(2));
    localStorage.setItem(key, id);
  }
  return id;
}

function getSaveKey() {
  return `venistasia_save_${gameState.playerId || "unknown"}`;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function saveNow() {
  try {
    localStorage.setItem(getSaveKey(), JSON.stringify(gameState));
  } catch (e) {
    logError("Saving failed (storage full or blocked).");
    console.error(e);
  }
}

let __saveTimer = null;
function scheduleSave() {
  if (__saveTimer) clearTimeout(__saveTimer);
  __saveTimer = setTimeout(saveNow, 250);
}

function loadSaveIfExists() {
  try {
    const raw = localStorage.getItem(getSaveKey());
    if (!raw) return false;
    const parsed = JSON.parse(raw);

    // Merge into current structure (so future fields still exist)
    const merged = deepClone(gameState);
    Object.assign(merged, parsed);

    // Nested merges
    merged.player = Object.assign(deepClone(gameState.player), parsed.player || {});
    merged.equipment = Object.assign(deepClone(gameState.equipment), parsed.equipment || {});
    merged.flags = Object.assign(deepClone(gameState.flags), parsed.flags || {});
    merged.combat = Object.assign(deepClone(gameState.combat), parsed.combat || {});
    merged.inventory = Array.isArray(parsed.inventory) ? parsed.inventory : deepClone(gameState.inventory);

    // Apply merged -> gameState (by mutation to keep references predictable)
    Object.assign(gameState, merged);
    return true;
  } catch (e) {
    logError("Save data was corrupted; starting fresh.");
    console.error(e);
    return false;
  }
}

// --- RNG helpers ---
function roll(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(arr) {
  if (!arr || !arr.length) return "";
  return arr[roll(0, arr.length - 1)];
}

// --- Inventory helpers ---
function findItemIndexById(id) {
  return gameState.inventory.findIndex((i) => i && i.id === id);
}
function playerHasItem(id) {
  return findItemIndexById(id) !== -1;
}
function consumeItemById(id) {
  const idx = findItemIndexById(id);
  if (idx === -1) return false;
  gameState.inventory.splice(idx, 1);
  return true;
}
function findItemIndexByType(type) {
  return gameState.inventory.findIndex((i) => i && i.type === type);
}
function consumeItemByType(type) {
  const idx = findItemIndexByType(type);
  if (idx === -1) return false;
  gameState.inventory.splice(idx, 1);
  return true;
}

function getItemById(id) {
  return gameState.inventory.find((i) => i && i.id === id) || null;
}

// --- Equipment helpers ---
function ensureEquipment() {
  // Ensure equipped weapon exists; if not, equip first available weapon
  const weaponId = gameState.equipment.weapon;
  if (weaponId && playerHasItem(weaponId)) return;

  const firstWeapon = gameState.inventory.find((i) => i.type === "weapon");
  gameState.equipment.weapon = firstWeapon ? firstWeapon.id : null;
}

function getEquippedWeapon() {
  ensureEquipment();
  const id = gameState.equipment.weapon;
  return id ? getItemById(id) : null;
}

function isShieldEquipped(id) {
  return gameState.equipment.offhand === id;
}
function isWeaponEquipped(id) {
  const w = getEquippedWeapon();
  return !!w && w.id === id;
}

// ============================================================
// MODULE 2B — LOGGING + STATUS BAR
// ============================================================

let outputEl = null;
let statusNameEl = null, statusLevelEl = null, statusHpEl = null, statusXpEl = null;

function initUIRefs() {
  outputEl = document.getElementById("output");
  statusNameEl = document.getElementById("statusName");
  statusLevelEl = document.getElementById("statusLevel");
  statusHpEl = document.getElementById("statusHp");
  statusXpEl = document.getElementById("statusXp");
}

function appendLine(text, cls) {
  if (!outputEl) {
    console.log(text);
    return;
  }
  const el = document.createElement("div");
  el.className = `line ${cls || "system"}`;
  el.textContent = text;
  outputEl.appendChild(el);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function logSystem(text) {
  appendLine(text, "system");
}
function logCommand(text) {
  appendLine("> " + text, "command");
}
function logError(text) {
  appendLine(text, "error");
}

function updateStatusBar() {
  const p = gameState.player;
  if (!statusNameEl) return;
  statusNameEl.innerHTML = `<b>Name:</b> ${p.name}`;
  statusLevelEl.innerHTML = `<b>Level:</b> ${p.level}`;
  statusHpEl.innerHTML = `<b>HP:</b> ${p.hp}/${p.maxHp}`;
  statusXpEl.innerHTML = `<b>XP:</b> ${p.xp}/${p.xpToLevel}`;
}

// ============================================================
// MODULE 3 — WORLD DATA (17 ROOMS)
// ============================================================

const locations = {
  // OUTSIDE WORLD
  village_square: {
    name: "Briar's Edge, Village Square",
    description: [
      "You stand in the cramped heart of Briar's Edge, a frontier village held together by splinters, rope, and desperation.",
      "Posters promising glory inside the 'Dawnspire Below' flap on a warped notice board.",
      "North lies the Shaded Frontier — a wall of trees waiting to swallow you."
    ].join(" "),
    exits: ["north"],
  },

  dark_forest_edge: {
    name: "Forest Edge",
    description: [
      "The dirt road frays into mud and tangled roots as the forest tightens around you.",
      "The air grows colder, heavier, dragging rot, iron, and wet leaves.",
      "To the north: the scar in the earth known as the Dawnspire.",
      "To the south: the last safety Briar’s Edge can pretend to offer."
    ].join(" "),
    exits: ["north", "south"],
  },

  dungeon_entrance: {
    name: "Dawnspire – Broken Ring",
    description: [
      "A ring of shattered stone encircles a gaping hole in the ground.",
      "Leaning pillars tilt like gravemarkers around a spiral stair that winds into breathless dark.",
      "Scrapes in the dust show where others descended. None show return."
    ].join(" "),
    exits: ["south", "down"],
  },

  // FLOOR 1 — ROOM 1
  broken_ring_descent: {
    name: "Broken Ring Descent",
    description: [
      "The spiral stair narrows sharply, slick with cold seepage.",
      "Strange veins of pale green lichen pulse faintly in the cracks, throwing warped shadows.",
      "Footsteps echo strangely — always one more than you make."
    ].join(" "),
    exits: ["up", "down"],
  },

  // ROOM 2
  cracked_landing: {
    name: "Cracked Landing",
    description: [
      "A claustrophobic landing where fractured stone juts from walls and floor.",
      "Dust showers drift from above with every groan of ancient stone.",
      "A faint memory of daylight lingers up the shaft behind you… for now."
    ].join(" "),
    exits: ["up", "down"],
  },

  // ROOM 3
  collapsed_stairwell: {
    name: "Collapsed Stairwell",
    description: [
      "The stair twists around a throat of rubble where the upper descent has collapsed completely.",
      "Dust spirals in the stale air like ash caught mid-fall.",
      "The stone ahead slopes downward again — narrower, meaner, hungrier."
    ].join(" "),
    exits: ["up", "down"],
  },

  // ROOM 4
  rat_gnawed_vestibule: {
    name: "Rat-Gnawed Vestibule",
    description: [
      "A wedge-shaped chamber chewed bare by countless teeth.",
      "Bedroll scraps fuse to the floor in moldy tatters, beside a snapped spear haft and stains that never dried clean.",
      "Thin tunnels web the walls — whatever dug them is probably still near."
    ].join(" "),
    exits: ["west", "east", "north"],
  },

  // ROOM 5
  gnawed_storeroom: {
    name: "Gnawed Storeroom",
    description: [
      "Collapsed shelves lean drunkenly against the walls.",
      "Torn sacks spill rotten grain into heaps crawling with tiny pale insects.",
      "Bones — small and large — scatter the floor in chaotic piles."
    ].join(" "),
    exits: ["west"],
  },

  // ROOM 6
  outer_lantern_hall: {
    name: "Outer Hall of Lanterns",
    description: [
      "A long corridor lined with broken sconces and cracked stone lanterns.",
      "Indentations in the walls suggest places where warm crystal light once burned.",
      "Now only dust and silence remain — but the layout whispers of alignments."
    ].join(" "),
    exits: ["south", "east", "north"],
  },

  // ROOM 7
  flicker_node: {
    name: "Flicker Node",
    description: [
      "A small chamber where a fractured mirror panel leans precariously in its frame.",
      "A single lantern fixture sits inset into the wall — untouched by time.",
      "Carved beneath it: “Light must travel.”"
    ].join(" "),
    exits: ["west", "north"],
  },

  // ROOM 8
  failed_light_door: {
    name: "Door of Failed Light",
    description: [
      "A heavy stone door stands sealed, carved with a fractured sunburst.",
      "Three dull crystal sockets crown the frame, dead and waiting.",
      "Etched beneath the dust: “Lanterns failed. Stones fell. Light must bend to pass.”"
    ].join(" "),
    exits: ["south"],
  },

  // ROOM 9
  mirror_gallery: {
    name: "Mirror Gallery",
    description: [
      "A tight hall lined with tarnished mirror panels, their surfaces cracked into branching veins.",
      "Some look adjustable — rotated on rusted pivots.",
      "Faint scratches on the floor trace paths of reflected light."
    ].join(" "),
    exits: ["south", "east"],
  },

  // ROOM 10
  shard_niche: {
    name: "Shard Niche",
    description: [
      "A circular alcove containing a stone pedestal.",
      "Resting atop it is a lantern fixture — intact — and a shard of prismatic crystal pulsing faintly.",
      "Dust patterns on the floor suggest beams once converged here."
    ].join(" "),
    exits: ["west", "north"],
  },

  // ROOM 11
  fallen_guard_post: {
    name: "Fallen Guard Post",
    description: [
      "An overturned table, shattered spears, and a cracked warning bell hang in stale air.",
      "Scraped drag-marks vanish under a collapsed beam.",
      "A soldier once stood watch here — poorly, by the look of it."
    ].join(" "),
    exits: ["south", "east"],
  },

  // ROOM 12
  broken_barracks: {
    name: "Broken Barracks",
    description: [
      "Rotting bunks sag into a floor split by a narrow fissure.",
      "Blankets lie fossilized in grime. A few skeletal remains curl against footlockers long since pried open.",
      "The air tastes of old dust and something stranger — secrets left to ferment in the dark."
    ].join(" "),
    exits: ["west", "north"],
  },

  // ROOM 13
  lantern_muster_hall: {
    name: "Lantern Muster Hall",
    description: [
      "A wide hall choked with tattered banners depicting lantern-bearing warriors.",
      "A cracked stone floor-map dominates the center, showing three concentric rings descending deeper.",
      "Time has scraped away names and symbols — but intent remains etched in the silence."
    ].join(" "),
    exits: ["south", "east", "north"],
  },

  // ROOM 14
  armory_of_dust: {
    name: "Armory of Dust",
    description: [
      "Weapon racks crumbled into piles of reddish flakes.",
      "A few serviceable relics remain — preserved by luck or forgotten craft.",
      "A collapsed rack against the far wall looks… suspiciously hollow."
    ].join(" "),
    exits: ["west", "east"],
  },

  // ROOM 16 (accessible from armory east)
  hidden_shrine: {
    name: "Hidden Shrine to the Flame",
    description: [
      "A secret circular chamber. At its center stands an untouched Lantern Knight statue, hands cupped as if waiting to cradle fire.",
      "The silence here is deeper — reverent — a pocket of memory preserved from whatever consumed the rest of the Dawnspire."
    ].join(" "),
    exits: ["west"],
  },

  // ROOM 15
  watch_balcony: {
    name: "Watch Balcony",
    description: [
      "A narrow overlook juts above a yawning black chasm.",
      "You can sense water somewhere far below — dripping, echoing like slow footsteps.",
      "Carved into the parapet: “They will climb after us. We must break the way back.”"
    ].join(" "),
    exits: ["south", "east"],
  },

  // ROOM 17
  provision_cellar: {
    name: "Stale Provision Cellar",
    description: [
      "A cool chamber of broken barrels and mold-soft sacks.",
      "Most food here spoiled decades ago, reduced to pale mulch and drifting spores.",
      "But not everything has rotted — some wax-sealed packets remain intact on a toppled crate."
    ].join(" "),
    exits: ["south"],
  },
};

// ============================================================
// MODULE 4 — MOVEMENT + ROOM ENTRY + TRIGGERS
// ============================================================

function enterRoom(id) {
  gameState.location = id;
  const loc = locations[id];
  logSystem(`${loc.name}\n${loc.description}`);

  handleRoomTriggers(id);

  if (loc.exits && loc.exits.length) {
    logSystem("Exits: " + loc.exits.join(", "));
  } else {
    logSystem("Exits: (none)");
  }

  scheduleSave();
}

function handleRoomTriggers(id) {
  switch (id) {
    case "cracked_landing":
      if (!gameState.flags.gotLanternBadge) {
        gameState.flags.gotLanternBadge = true;
        gameState.inventory.push({ id: "lantern-badge", name: "Lantern Knight’s Badge", type: "key" });
        logSystem("Half-buried in rubble, you pull free an old Lantern Knight’s Badge.");
      }
      break;

    case "collapsed_stairwell":
      if (!gameState.flags.collapsedStairTrapDone) runFallingStoneTrap();
      break;

    case "rat_gnawed_vestibule":
      if (!gameState.flags.vestibuleCombatDone) {
        startVestibuleFight();
      } else {
        maybeVestibuleLoot();
      }
      break;

    case "gnawed_storeroom":
      if (!gameState.flags.storeroomTrapDone) {
        runRatPileTrap();
      } else {
        maybeStoreroomLoot();
      }
      break;

    case "flicker_node":
      if (!gameState.flags.flickerLootDone) {
        gameState.flags.flickerLootDone = true;
        const c = roll(2, 5);
        for (let i = 0; i < c; i++) gameState.inventory.push({ id: "coin", type: "coin", name: "Dawnspire Coin" });
        logSystem(`You find ${c} tarnished Dawnspire Coins near the lantern base.`);
      }
      if (gameState.flags.flickerShardAligned) {
        logSystem("A thin beam of crystal light threads north toward the mirror hall.");
      }
      break;

    case "mirror_gallery":
      describeMirrorState();
      break;

    case "shard_niche":
      maybeTakeNicheShard();
      describeShardNicheState();
      break;

    case "fallen_guard_post":
      maybeGuardSpear();
      break;

    case "broken_barracks":
      if (!gameState.flags.barracksCombatDone) startBarracksFight();
      break;

    case "lantern_muster_hall":
      if (!gameState.flags.musterLoreDone) {
        gameState.flags.musterLoreDone = true;
        logSystem("A cracked floor-map shows three descending rings: 'THREE RINGS BELOW — AND MORE BENEATH THAT.'");
      }
      if (!gameState.flags.musterCombatDone) startLanternBearerFight();
      break;

    case "armory_of_dust":
      runArmoryTrap();
      break;

    case "hidden_shrine":
      describeShrineState();
      break;

    case "provision_cellar":
      maybeProvisionCellarLoot(); // (implemented exactly as you asked)
      break;
  }
}

function goDirection(dir) {
  const loc = locations[gameState.location];
  if (!loc?.exits?.includes(dir)) {
    logSystem("You can't go that way.");
    return;
  }

  // World transitions (explicit map)
  const transitions = {
    "village_square": { north: "dark_forest_edge" },
    "dark_forest_edge": { south: "village_square", north: "dungeon_entrance" },
    "dungeon_entrance": { south: "dark_forest_edge", down: "broken_ring_descent" },
    "broken_ring_descent": { up: "dungeon_entrance", down: "cracked_landing" },
    "cracked_landing": { up: "broken_ring_descent", down: "collapsed_stairwell" },
    "collapsed_stairwell": { up: "cracked_landing", down: "rat_gnawed_vestibule" },
    "rat_gnawed_vestibule": { west: "collapsed_stairwell", east: "gnawed_storeroom", north: "outer_lantern_hall" },
    "gnawed_storeroom": { west: "rat_gnawed_vestibule" },
    "outer_lantern_hall": { south: "rat_gnawed_vestibule", east: "flicker_node", north: "failed_light_door" },
    "flicker_node": { west: "outer_lantern_hall", north: "mirror_gallery" },
    "failed_light_door": { south: "outer_lantern_hall" },
    "mirror_gallery": { south: "flicker_node", east: "shard_niche" },
    "shard_niche": { west: "mirror_gallery", north: "fallen_guard_post" },
    "fallen_guard_post": { south: "shard_niche", east: "broken_barracks" },
    "broken_barracks": { west: "fallen_guard_post", north: "lantern_muster_hall" },
    "lantern_muster_hall": { south: "broken_barracks", east: "armory_of_dust", north: "watch_balcony" },
    "armory_of_dust": { west: "lantern_muster_hall", east: "hidden_shrine" },
    "hidden_shrine": { west: "armory_of_dust" },
    "watch_balcony": { south: "lantern_muster_hall", east: "provision_cellar" },
    "provision_cellar": { south: "watch_balcony" },
  };

  const t = transitions[gameState.location];
  const dest = t?.[dir];
  if (!dest) {
    logSystem("You can't go that way.");
    return;
  }

  // combat safety
  if (gameState.combat?.inCombat) {
    logSystem("You're a little busy not dying right now. Try 'attack', 'block', or 'run'.");
    return;
  }

  enterRoom(dest);
}

// ============================================================
// MODULE 4B — TRAPS + LOOT
// ============================================================

function handlePlayerDeath() {
  logSystem(pickOne([
    "Your legs buckle. The world tilts. Blood warms the stone beneath you.",
    "You collapse, breath rattling once—then not at all.",
  ]));
  logSystem("Death claims you in the Dawnspire…");
  handleReset();
}

function runFallingStoneTrap() {
  gameState.flags.collapsedStairTrapDone = true;
  logSystem("Stone grinds overhead. A block shears loose and plummets.");

  const dmg = roll(1, 3);
  gameState.player.hp -= dmg;

  if (gameState.player.hp <= 0) {
    gameState.player.hp = 0;
    updateStatusBar();
    logSystem("The impact crushes the breath from your body.");
    return handlePlayerDeath();
  }

  updateStatusBar();
  logSystem(`The block glances off your shoulder. (${dmg} damage)`);
}

function runRatPileTrap() {
  gameState.flags.storeroomTrapDone = true;
  logSystem("The bone pile erupts into a frenzy of teeth.");

  const dmg = roll(1, 3);
  gameState.player.hp -= dmg;

  if (gameState.player.hp <= 0) {
    gameState.player.hp = 0;
    updateStatusBar();
    logSystem("The swarm tears you apart in seconds.");
    return handlePlayerDeath();
  }

  updateStatusBar();
  logSystem(`You kick free of gnawing bodies. (${dmg} damage)`);
}

function runArmoryTrap() {
  if (gameState.flags.armoryTrapDone) return;
  gameState.flags.armoryTrapDone = true;

  logSystem("A pristine blade catches your eye — too pristine. You grasp it.");
  logSystem("The metal collapses into choking rust, exploding across your face!");

  const dmg = roll(1, 3);
  gameState.player.hp -= dmg;

  if (gameState.player.hp <= 0) {
    gameState.player.hp = 0;
    updateStatusBar();
    logSystem("Your lungs seize as you collapse.");
    return handlePlayerDeath();
  }

  updateStatusBar();
  logSystem(`You stagger, choking on rust. (${dmg} damage)`);

  giveArmoryLoot();
}

function maybeVestibuleLoot() {
  if (gameState.flags.gotVestibuleLoot) return;
  gameState.flags.gotVestibuleLoot = true;

  gameState.inventory.push(
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "dirty-bandage", name: "Dirty Bandage", type: "consumable", heal: 4 }
  );

  logSystem("You find a stale ration and a dirty bandage among shredded bedroll remains.");
}

function maybeStoreroomLoot() {
  if (gameState.flags.gotStoreroomLoot) return;
  gameState.flags.gotStoreroomLoot = true;

  // Buckler
  if (!gameState.flags.gotBuckler) {
    gameState.flags.gotBuckler = true;
    gameState.inventory.push({ id: "rust-buckler", name: "Rust-Flecked Buckler", type: "shield" });
    logSystem("Under the bones you find a rust-flecked buckler.");
  }

  // First shard
  if (!playerHasItem("lantern-shard-1")) {
    gameState.inventory.push({ id: "lantern-shard-1", name: "Lantern Shard (First Fragment)", type: "key" });
    logSystem("A prismatic shard gleams between cracked teeth. You take it.");
  }

  // Auto-equip buckler if offhand empty
  if (!gameState.equipment.offhand) {
    gameState.equipment.offhand = "rust-buckler";
    logSystem("You strap the buckler to your arm.");
  }
}

function maybeGuardSpear() {
  if (gameState.flags.guardSpearTaken) return;
  gameState.flags.guardSpearTaken = true;

  const spear = { id: "old-guard-spear", name: "Old Guard Spear", type: "weapon", atk: 1 };
  gameState.inventory.push(spear);

  logSystem("You find an old guard spear with enough edge left to matter.");

  // Auto-equip if no weapon
  ensureEquipment();
  if (!gameState.equipment.weapon) {
    gameState.equipment.weapon = "old-guard-spear";
    logSystem("You take up the spear — longer reach, safer distance.");
  }
}

function maybeTakeNicheShard() {
  if (gameState.flags.nicheShardTaken) return;
  gameState.flags.nicheShardTaken = true;

  gameState.inventory.push({ id: "lantern-shard-2", name: "Lantern Shard (Second Fragment)", type: "key" });
  logSystem("You take the prismatic shard resting on the pedestal.");
}

function giveArmoryLoot() {
  if (gameState.flags.armoryLootDone) return;
  gameState.flags.armoryLootDone = true;

  const iron = { id: "iron-sword", name: "Serviceable Iron Sword", type: "weapon", atk: 2 };
  const shard = { id: "lantern-shard-3", name: "Lantern Shard (Third Fragment)", type: "key" };

  gameState.inventory.push(iron, shard);

  const c = roll(1, 3);
  for (let i = 0; i < c; i++) gameState.inventory.push({ id: "coin", name: "Dawnspire Coin", type: "coin" });

  logSystem("You recover a sturdy iron sword, a prismatic shard, and a few coins.");

  // Auto-equip if better than current
  const current = getEquippedWeapon();
  if (!current || (current.atk || 0) < iron.atk) {
    gameState.equipment.weapon = "iron-sword";
    logSystem("You equip the iron sword — balanced, reliable, deadly.");
  }
}

// ============================================================
// CHANGE 1: Provision Cellar loot — EXACTLY 2 rations, once
// ============================================================
function maybeProvisionCellarLoot() {
  if (gameState.flags.gotProvisionRations) return;
  gameState.flags.gotProvisionRations = true;

  gameState.inventory.push(
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "ration", name: "Travel Ration", type: "ration" }
  );

  logSystem("You salvage two intact wax-sealed rations from a toppled crate.");
}

// ============================================================
// MODULE 4C — SHRINE + LIGHT PUZZLE
// ============================================================

function playerHasAnyShard() {
  return gameState.inventory.some((i) => i?.id?.startsWith("lantern-shard-"));
}

function describeShrineState() {
  if (!playerHasAnyShard()) {
    logSystem("The Knight statue extends an empty hand, waiting for something sharp and prismatic.");
    return;
  }
  if (!gameState.flags.shrineUsed) {
    logSystem("The crystal flame leans toward your shards. Perhaps: use shard");
  } else if (gameState.flags.shrineBlessingActive) {
    logSystem("Warmth coils in your chest — a single lethal blow will not kill you.");
  } else {
    logSystem("The shrine flame flickers low. Its gift has already been spent.");
  }
}

// ============================================================
// CHANGE 2: Shrine “use shard” => +5 Max HP AND +5 current HP (capped), +blessing
// ============================================================
function useShardAtShrine() {
  if (gameState.location !== "hidden_shrine") {
    logSystem("You hold the shard out. Nothing here responds.");
    return;
  }

  if (gameState.flags.shrineUsed) {
    logSystem("The shrine has already given what it can.");
    return;
  }

  if (!playerHasAnyShard()) {
    logSystem("You reach for a shard you don't have.");
    return;
  }

  // Consume ONE shard
  const shardId = gameState.inventory.find((i) => i?.id?.startsWith("lantern-shard-"))?.id;
  if (shardId) consumeItemById(shardId);

  gameState.flags.shrineUsed = true;
  gameState.flags.shrineBlessingActive = true;

  const p = gameState.player;

  // +5 Max HP (permanent)
  p.maxHp += 5;

  // +5 current HP (capped by NEW max)
  p.hp = Math.min(p.maxHp, p.hp + 5);

  updateStatusBar();

  logSystem("The shard sinks into the Knight’s palm. Light blooms. Warmth fills your lungs.");
  logSystem(`Your body hardens with the flame’s memory. (+5 Max HP, now ${p.maxHp})`);
  logSystem(`Heat stitches your wounds tighter. (+up to 5 HP, now ${p.hp}/${p.maxHp})`);
  logSystem("The blessing settles in your bones — the next killing blow will leave you at 1 HP.");

  scheduleSave();
}

function describeMirrorState() {
  if (!gameState.flags.flickerShardAligned) {
    logSystem("The mirrors show only dust and fractured reflections — no beam reaches them yet.");
    return;
  }
  if (gameState.flags.mirrorToNiche) {
    logSystem("Mirrors angle east, carrying the light toward the Shard Niche.");
  } else if (gameState.flags.mirrorToDoor) {
    logSystem("Mirrors angle south, sending light toward the Door of Failed Light.");
  } else {
    logSystem("The beam flickers chaotically across cracked mirrors.");
  }
}

function handleAdjustMirrors(target) {
  if (gameState.location !== "mirror_gallery") {
    logSystem("Nothing here responds to mirror adjustments.");
    return;
  }
  if (!gameState.flags.flickerShardAligned) {
    logSystem("Without a source beam from the Flicker Node, the mirrors stay dull.");
    return;
  }

  // small risk trap
  if (roll(1, 100) <= 30) {
    const dmg = roll(1, 3);
    gameState.player.hp -= dmg;
    if (gameState.player.hp <= 0) {
      gameState.player.hp = 0;
      updateStatusBar();
      logSystem("A mirror slips — the flash burns right through you.");
      return handlePlayerDeath();
    }
    updateStatusBar();
    logSystem(`A mirror slips — blinding flash! (${dmg} damage)`);
    return;
  }

  const t = (target || "").toLowerCase();
  if (t.includes("east") || t.includes("niche")) {
    gameState.flags.mirrorToNiche = true;
    gameState.flags.mirrorToDoor = false;
    logSystem("You angle mirrors east — the beam now travels toward the Niche.");
    return;
  }

  if (t.includes("south") || t.includes("door")) {
    gameState.flags.mirrorToDoor = true;
    gameState.flags.mirrorToNiche = false;
    logSystem("Mirrors tilt south, sending light toward the great door.");
    return;
  }

  logSystem("You shift mirrors, but the beam scatters uselessly.");
}

function describeShardNicheState() {
  const incoming = gameState.flags.flickerShardAligned && gameState.flags.mirrorToNiche;
  const seated = gameState.flags.nicheShardSeated;

  if (incoming && seated) {
    logSystem("Light hits the shard and splits — one beam feeds the mirrors, another dives toward the Door of Failed Light.");
  } else if (incoming && !seated) {
    logSystem("Light grazes the empty socket — seating a shard would focus it.");
  } else if (!incoming && seated) {
    logSystem("The shard waits, fractures ready to split light when it arrives.");
  } else {
    logSystem("Everything here is still and dark.");
  }
}

function tryOpenFailedLightDoor() {
  const litCount =
    (gameState.flags.flickerShardAligned ? 1 : 0) +
    (gameState.flags.mirrorToDoor ? 1 : 0) +
    (gameState.flags.nicheShardSeated ? 1 : 0);

  if (litCount < 3) {
    logSystem("The stone remains sealed. The sockets glow faintly at best.");
    return;
  }

  logSystem("All three sockets blaze. The fractured sunburst pulses—");
  logSystem("But the mechanism deeper within is incomplete. This path is not yet implemented.");
}

// ============================================================
// MODULE 5 — COMBAT SYSTEM
// ============================================================

const enemyTemplates = {
  dawnspire_rat: {
    id: "dawnspire_rat",
    name: "Starved Tunnel-Rat",
    type: "beast",
    maxHp: 8,
    atkMin: 1,
    atkMax: 3,
    xpReward: 12,
    isUndead: false,
    description: "A hairless, skeletal rat drags itself into view—skin tight over bone, teeth clicking like wet stones.",
  },
  desiccated_soldier: {
    id: "desiccated_soldier",
    name: "Desiccated Soldier",
    type: "humanoid",
    maxHp: 12,
    atkMin: 2,
    atkMax: 4,
    xpReward: 20,
    isUndead: true,
    description: "The corpse wears the ragged remains of a garrison tabard. It moves with duty’s last reflex—slow, deliberate, wrong.",
  },
  hollow_lantern_bearer: {
    id: "hollow_lantern_bearer",
    name: "Hollow Lantern-Bearer",
    type: "humanoid",
    maxHp: 20,
    atkMin: 3,
    atkMax: 6,
    xpReward: 40,
    isUndead: true,
    description: "Rotten plate armor hangs on a frame of dried sinew. A cracked lantern burns in its fist—cold light that hates you personally.",
  },
};

const combatFlavor = {
  player: {
    normal: {
      beast: ["You slash into the {name}, fur and flesh tearing.", "Steel bites. The {name} recoils, hissing through broken teeth."],
      humanoid: ["You smash your weapon into the {name}'s ribs.", "Your strike drives into dead meat and old armor."],
    },
    crit: {
      beast: ["Your blade finds the throat. CRITICAL HIT.", "You split bone and skull. CRITICAL HIT."],
      humanoid: ["You cave in the {name}'s skull. CRITICAL HIT.", "Your strike punches through weak seams. CRITICAL HIT."],
    },
  },
  enemy: {
    normal: {
      beast: ["The {name} snaps down on you.", "The {name} rakes claws across your side."],
      humanoid: ["The {name}'s weapon crunches into you.", "The {name} drags rusted steel across your skin."],
    },
    crit: {
      beast: ["The {name} sinks teeth deep. CRITICAL WOUND.", "The {name} tears into you like you're meat. CRITICAL WOUND."],
      humanoid: ["Steel drives in. CRITICAL WOUND.", "A brutal blow lands clean. CRITICAL WOUND."],
    },
  },
};

const enemyIntents = {
  beast: [
    { key: "quick", damageMult: 1.0, blockMult: 0.6, tell: "The {name} drops low, ready to spring." },
    { key: "heavy", damageMult: 1.8, blockMult: 0.3, tell: "The {name} coils for a bone-cracking slam." },
    { key: "worry", damageMult: 1.3, blockMult: 0.4, tell: "The {name} circles, searching for a bite it can keep." },
  ],
  humanoid: [
    { key: "cut", damageMult: 1.2, blockMult: 0.5, tell: "The {name} raises its weapon in a stiff, killing arc." },
    { key: "thrust", damageMult: 1.5, blockMult: 0.4, tell: "The {name} lines up a straight thrust." },
    { key: "flail", damageMult: 1.0, blockMult: 0.6, tell: "The {name} jerks into a wild, sweeping attack." },
  ],
};

function createEnemyInstance(enemyId) {
  const t = enemyTemplates[enemyId];
  if (!t) return null;
  return { ...deepClone(t), hp: t.maxHp };
}

function chooseEnemyIntent(enemy) {
  const type = enemy?.type || "beast";
  const pool = enemyIntents[type] || enemyIntents.beast;
  return pool[roll(0, pool.length - 1)];
}

function telegraphEnemyIntent(enemy, intent) {
  if (!enemy || !intent) return;
  logSystem(intent.tell.replace("{name}", enemy.name));
}

function startCombat(enemyId) {
  const enemy = createEnemyInstance(enemyId);
  if (!enemy) {
    logSystem("Something should be here, but isn't. (Missing enemy data.)");
    return;
  }

  gameState.combat.inCombat = true;
  gameState.combat.enemy = enemy;
  gameState.combat.intent = chooseEnemyIntent(enemy);
  gameState.combat.previousLocation = gameState.location;

  logSystem([
    "The air tightens. The room suddenly feels too small.",
    `${enemy.name} steps out of the dark.`,
    "",
    enemy.description,
    "",
    "Commands: attack, block, run (or use bandage).",
  ].join("\n"));

  telegraphEnemyIntent(enemy, gameState.combat.intent);
  scheduleSave();
}

function endCombat() {
  gameState.combat.inCombat = false;
  gameState.combat.enemy = null;
  gameState.combat.intent = null;
  gameState.combat.previousLocation = null;
  scheduleSave();
}

function gainXp(amount) {
  const p = gameState.player;
  p.xp += amount;
  logSystem(`You gain ${amount} XP.`);

  while (p.xp >= p.xpToLevel) {
    p.xp -= p.xpToLevel;
    p.level += 1;

    // Leveling rule: +5 max HP per level
    p.maxHp += 5;
    p.hp = p.maxHp;

    p.xpToLevel = Math.round(p.xpToLevel * 1.3);
    logSystem(`*** LEVEL UP: ${p.level}. Max HP is now ${p.maxHp}. ***`);
  }

  updateStatusBar();
}

function enemyTurn({ blocking = false } = {}) {
  const enemy = gameState.combat.enemy;
  if (!enemy) return;

  const intent = gameState.combat.intent || chooseEnemyIntent(enemy);
  gameState.combat.intent = intent;

  const enemyType = enemy.type || "beast";
  const enemyCrit = roll(1, 100) <= 15;

  let dmg = roll(enemy.atkMin, enemy.atkMax);
  dmg = Math.max(1, Math.round(dmg * (intent.damageMult || 1)));
  if (enemyCrit) dmg *= 2;

  if (blocking) {
    const blockMult = intent.blockMult != null ? intent.blockMult : 0.4;
    dmg = Math.floor(dmg * blockMult);

    // Buckler extra -1 vs beasts when blocking
    if (enemyType === "beast" && isShieldEquipped("rust-buckler")) {
      dmg = Math.max(0, dmg - 1);
    }

    // Spear extra -1 vs all when blocking
    if (isWeaponEquipped("old-guard-spear")) {
      dmg = Math.max(0, dmg - 1);
    }
  }

  const bucket = enemyCrit
    ? (combatFlavor.enemy.crit[enemyType] || combatFlavor.enemy.crit.beast)
    : (combatFlavor.enemy.normal[enemyType] || combatFlavor.enemy.normal.beast);

  const line = pickOne(bucket).replace("{name}", enemy.name);

  if (dmg > 0) {
    logSystem(blocking ? `${line} (${dmg} damage gets through your guard.)` : `${line} (${dmg} damage)`);
    gameState.player.hp -= dmg;

    if (gameState.player.hp <= 0) {
      // Blessing: first lethal blow => set to 1 HP, deactivate
      if (gameState.flags.shrineBlessingActive) {
        gameState.flags.shrineBlessingActive = false;
        gameState.player.hp = 1;
        updateStatusBar();
        logSystem("Everything goes white-hot for a heartbeat. When it snaps back, you’re still standing—barely. The shrine’s blessing gutters out.");
      } else {
        gameState.player.hp = 0;
        updateStatusBar();
        return handlePlayerDeath();
      }
    }

    updateStatusBar();
    logSystem(`HP: ${gameState.player.hp}/${gameState.player.maxHp}.`);
  } else {
    logSystem(blocking ? "You brace—nothing makes it through." : "The attack misses, scraping stone.");
  }

  gameState.combat.intent = chooseEnemyIntent(enemy);
  telegraphEnemyIntent(enemy, gameState.combat.intent);
  scheduleSave();
}

function handleAttack() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing here to attack.");
    return;
  }

  const enemy = gameState.combat.enemy;
  const enemyType = enemy.type || "beast";

  const weapon = getEquippedWeapon();
  const weaponAtk = weapon ? (weapon.atk || 0) : 0;

  const isCrit = roll(1, 100) <= 20;

  let dmg = roll(1 + weaponAtk, 4 + weaponAtk);
  if (isCrit) dmg = dmg * 2 + 1;

  enemy.hp -= dmg;

  const bucket = isCrit
    ? (combatFlavor.player.crit[enemyType] || combatFlavor.player.crit.beast)
    : (combatFlavor.player.normal[enemyType] || combatFlavor.player.normal.beast);

  logSystem(`${pickOne(bucket).replace("{name}", enemy.name)} (${dmg} damage)`);

  if (enemy.hp <= 0) {
    logSystem(pickOne([`The ${enemy.name} collapses in a heap.`, `The ${enemy.name} falls still.`]));
    const xp = enemy.xpReward || 0;
    if (xp) gainXp(xp);

    if (handleWaveContinuation()) return;

    markRoomCombatCleared();
    endCombat();
    return;
  }

  enemyTurn({ blocking: false });
}

function handleBlock() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("You raise your guard against nothing.");
    return;
  }
  logSystem("You brace, muscles locked, waiting for impact.");
  enemyTurn({ blocking: true });
}

function handleRun() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing to run from.");
    return;
  }

  const success = roll(1, 100) <= 60;
  if (success) {
    const prev = gameState.combat.previousLocation;
    logSystem("You bolt from the fight, scrambling away!");
    endCombat();
    if (prev) enterRoom(prev);
    return;
  }

  logSystem("You try to flee, but it cuts you off!");
  enemyTurn({ blocking: false });
}

// waves
function handleWaveContinuation() {
  const loc = gameState.location;

  if (loc === "rat_gnawed_vestibule" && gameState.flags.vestibuleRatsRemaining > 1) {
    gameState.flags.vestibuleRatsRemaining -= 1;
    const next = createEnemyInstance("dawnspire_rat");
    gameState.combat.enemy = next;
    gameState.combat.intent = chooseEnemyIntent(next);
    logSystem("More skittering—another tunnel-rat claws its way out, drawn by the blood.");
    telegraphEnemyIntent(next, gameState.combat.intent);
    return true;
  }

  if (loc === "broken_barracks" && gameState.flags.barracksSoldiersRemaining > 1) {
    gameState.flags.barracksSoldiersRemaining -= 1;
    const next = createEnemyInstance("desiccated_soldier");
    gameState.combat.enemy = next;
    gameState.combat.intent = chooseEnemyIntent(next);
    logSystem("A second soldier drags itself upright, joints cracking dryly.");
    telegraphEnemyIntent(next, gameState.combat.intent);
    return true;
  }

  return false;
}

function markRoomCombatCleared() {
  const loc = gameState.location;
  if (loc === "rat_gnawed_vestibule") gameState.flags.vestibuleCombatDone = true;
  if (loc === "broken_barracks") gameState.flags.barracksCombatDone = true;
  if (loc === "lantern_muster_hall") gameState.flags.musterCombatDone = true;
  scheduleSave();
}

// combat triggers by room
function startVestibuleFight() {
  const two = roll(1, 100) <= 50;
  gameState.flags.vestibuleRatsRemaining = two ? 2 : 1;
  logSystem(two ? "Two starved tunnel-rats spill out of the gnawed tunnels!" : "A single starved tunnel-rat lunges from the darkness!");
  startCombat("dawnspire_rat");
}
function startBarracksFight() {
  const two = roll(1, 100) <= 50;
  gameState.flags.barracksSoldiersRemaining = two ? 2 : 1;
  logSystem(two ? "Two desiccated soldiers rise from ruined bunks!" : "A desiccated soldier pulls itself upright with a rasp of bone!");
  startCombat("desiccated_soldier");
}
function startLanternBearerFight() {
  logSystem("A Hollow Lantern-Bearer steps forward, lantern burning with pale hatred.");
  startCombat("hollow_lantern_bearer");
}

// ============================================================
// MODULE 6 — COMMANDS (use/equip/search/rest/reset/adjust/ring)
// ============================================================

function normalizeDir(d) {
  const x = (d || "").toLowerCase();
  const map = { n: "north", s: "south", e: "east", w: "west", u: "up", d: "down", f: "forward", b: "back" };
  return map[x] || x;
}

function handleHelp() {
  logSystem([
    "Available commands:",
    "  help               - show this help",
    "  look               - describe your surroundings (or current foe)",
    "  inventory (inv)    - list items",
    "  go <direction>     - move (north,south,east,west,up,down)",
    "  name <your name>   - set your name",
    "  attack             - attack (combat only)",
    "  block              - block (combat only)",
    "  run                - attempt to flee (combat only)",
    "  rest               - consume a ration to fully restore HP",
    "  use <item>         - use an item (bandage, shard, door, etc.)",
    "  equip <item>       - equip a weapon or shield (e.g., spear, buckler, sword)",
    "  adjust <target>    - adjust mechanisms (e.g., 'adjust mirrors east')",
    "  ring <thing>       - ring something where it exists (e.g., 'ring bell')",
    "  search             - search the area",
    "  reset              - wipe progress and restart",
  ].join("\n"));
}

function handleName(nameRaw) {
  const name = (nameRaw || "").trim();
  if (!name) {
    logSystem("You must provide a name. Example: name Six");
    return;
  }
  gameState.player.name = name;
  updateStatusBar();
  logSystem(`You will be known as ${name}.`);
  scheduleSave();
}

function handleLook() {
  if (gameState.combat.inCombat && gameState.combat.enemy) {
    const e = gameState.combat.enemy;
    logSystem(`${e.name}\n${e.description}\n\nIt has ${e.hp}/${e.maxHp} HP remaining.`);
    return;
  }
  enterRoom(gameState.location); // re-describe current room + triggers (triggers are self-guarded)
}

function handleInventory() {
  const inv = gameState.inventory || [];
  if (!inv.length) {
    logSystem("Your inventory is empty.");
    return;
  }

  const grouped = new Map();
  for (const item of inv) {
    const key = item.id || item.name;
    if (!grouped.has(key)) grouped.set(key, { item, count: 0 });
    grouped.get(key).count++;
  }

  const lines = [];
  let idx = 1;
  for (const { item, count } of grouped.values()) {
    const label = count > 1 ? `${item.name} (${count})` : item.name;
    lines.push(`${idx}. ${label}`);
    idx++;
  }

  const weapon = getEquippedWeapon();
  const offhand = gameState.equipment.offhand ? getItemById(gameState.equipment.offhand) : null;

  logSystem("You are carrying:\n" + lines.join("\n"));
  logSystem(`Equipped: ${weapon ? weapon.name : "None"}${offhand ? ` + ${offhand.name}` : ""}`);
}

function handleGoWrapper(dirRaw) {
  const dir = normalizeDir(dirRaw);
  if (!dir) {
    logSystem("Go where? (north, south, east, west, up, down)");
    return;
  }
  if (gameState.combat.inCombat) {
    logSystem("You're a little busy not dying right now. Try 'attack', 'block', or 'run'.");
    return;
  }
  goDirection(dir);
}

function handleSearch() {
  // Light, simple, once-per-room “flavor” searches
  const loc = gameState.location;
  if (loc === "fallen_guard_post") {
    logSystem("You sift the debris. The bell still hangs — tarnished, but intact.");
    return;
  }
  if (loc === "failed_light_door") {
    logSystem("You brush dust from the sockets. They look like they once held focused crystal light.");
    return;
  }
  logSystem("You search the area, but find nothing new.");
}

function handleEquip(argRaw) {
  const arg = (argRaw || "").toLowerCase().trim();
  if (!arg) {
    logSystem("Equip what? Example: equip spear");
    return;
  }

  // match by name/id
  const match = gameState.inventory.find((i) =>
    (i.name || "").toLowerCase().includes(arg) || (i.id || "").toLowerCase().includes(arg)
  );

  if (!match) {
    logSystem("You don't seem to have that.");
    return;
  }

  if (match.type === "weapon") {
    gameState.equipment.weapon = match.id;
    logSystem(`You equip: ${match.name}.`);
    scheduleSave();
    return;
  }

  if (match.type === "shield") {
    gameState.equipment.offhand = match.id;
    logSystem(`You ready: ${match.name}.`);
    scheduleSave();
    return;
  }

  logSystem("That can't be equipped.");
}

function handleAdjust(argRaw) {
  const arg = (argRaw || "").trim();
  if (!arg) {
    logSystem("Adjust what? Example: adjust mirrors east");
    return;
  }
  if (arg.toLowerCase().includes("mirror")) {
    handleAdjustMirrors(arg);
    scheduleSave();
    return;
  }
  logSystem("Nothing here seems adjustable.");
}

function handleRing(argRaw) {
  const arg = (argRaw || "").toLowerCase().trim();
  if (!arg) {
    logSystem("Ring what? Example: ring bell");
    return;
  }
  if (gameState.location === "fallen_guard_post" && arg.includes("bell")) {
    logSystem("You ring the cracked bell. The sound limps out into the dark… and dies.");
    return;
  }
  logSystem("You ring nothing but the air.");
}

function handleRest() {
  if (!consumeItemByType("ration")) {
    logSystem("You have no rations to rest with.");
    return;
  }
  gameState.player.hp = gameState.player.maxHp;
  updateStatusBar();
  logSystem("You choke down a ration and force your breath steady. You feel whole again.");
  scheduleSave();
}

function handleReset() {
  try {
    localStorage.removeItem(getSaveKey());
  } catch {}
  // reset by reloading page statefully
  gameState.player = deepClone({
    name: "Adventurer", level: 1, xp: 0, xpToLevel: 100, hp: 20, maxHp: 20,
  });
  gameState.inventory = deepClone([
    { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "ration", name: "Travel Ration", type: "ration" },
  ]);
  gameState.equipment = deepClone({ weapon: "rusty-sword", offhand: null });
  gameState.location = "village_square";
  gameState.flags = deepClone({
    gotLanternBadge: false,
    collapsedStairTrapDone: false,
    vestibuleCombatDone: false,
    vestibuleRatsRemaining: 0,
    gotVestibuleLoot: false,
    storeroomTrapDone: false,
    gotStoreroomLoot: false,
    flickerLootDone: false,
    flickerShardAligned: false,
    mirrorToNiche: false,
    mirrorToDoor: false,
    nicheShardTaken: false,
    nicheShardSeated: false,
    guardSpearTaken: false,
    barracksCombatDone: false,
    barracksSoldiersRemaining: 0,
    musterLoreDone: false,
    musterCombatDone: false,
    armoryTrapDone: false,
    armoryLootDone: false,
    gotProvisionRations: false,
    shrineUsed: false,
    shrineBlessingActive: false,
  });
  gameState.combat = deepClone({ inCombat: false, enemy: null, previousLocation: null, intent: null });

  updateStatusBar();
  logSystem("Your progress is wiped. You return to the surface.");
  enterRoom(gameState.location);
  scheduleSave();
}

// ============================================================
// CHANGE 3: extendedUseSystem used BOTH in and out of combat
// ============================================================

function extendedUseSystem(argRaw, inCombat) {
  const arg = (argRaw || "").toLowerCase().trim();

  // shrine
  if ((arg.includes("shard") || arg.includes("crystal")) && gameState.location === "hidden_shrine") {
    return useShardAtShrine();
  }

  // flicker node — align beam
  if ((arg.includes("shard") || arg.includes("crystal")) && gameState.location === "flicker_node") {
    if (!playerHasAnyShard()) {
      logSystem("You press empty fingers to the lantern fixture. Nothing happens.");
      return;
    }
    gameState.flags.flickerShardAligned = true;
    logSystem("You set a shard into the lantern — a thin beam leaps north into the dark.");
    scheduleSave();
    return;
  }

  // shard niche — seat shard
  if ((arg.includes("shard") || arg.includes("crystal")) && gameState.location === "shard_niche") {
    if (!playerHasAnyShard()) {
      logSystem("You don't have a shard to seat.");
      return;
    }
    gameState.flags.nicheShardSeated = true;
    logSystem("You set a shard into the socket. Its fractures are ready to split incoming light.");
    scheduleSave();
    return;
  }

  // bandage (usable in/out of combat)
  if (arg.includes("bandage")) {
    const idx = findItemIndexById("dirty-bandage");
    if (idx === -1) {
      logSystem("You don't have a bandage.");
      return;
    }
    const heal = gameState.inventory[idx].heal || 4;
    gameState.inventory.splice(idx, 1);

    const before = gameState.player.hp;
    gameState.player.hp = Math.min(gameState.player.maxHp, gameState.player.hp + heal);
    updateStatusBar();
    logSystem(`You wrap the wound. (+${gameState.player.hp - before} HP)`);
    scheduleSave();
    return;
  }

  // door interactions
  if ((arg.includes("door") || arg.includes("sunburst")) && gameState.location === "failed_light_door") {
    return tryOpenFailedLightDoor();
  }

  // default
  if (inCombat) logSystem("You fumble for an item, but nothing happens.");
  else logSystem("Nothing happens.");
}

// ============================================================
// MODULE 6B — MAIN COMMAND DISPATCH
// ============================================================

function handleCombatCommand(cmd, rawLine) {
  const c = (cmd || "").toLowerCase();

  if (c === "attack") return handleAttack();
  if (c === "block") return handleBlock();
  if (c === "run") return handleRun();

  if (c === "use") {
    const arg = (rawLine || "").slice(4).trim();
    return extendedUseSystem(arg, true);
  }

  logSystem("That makes no sense in a fight. Try: attack, block, run, use <item>.");
}

function handleCommand(rawLine) {
  const input = (rawLine || "").trim();
  if (!input) return;

  logCommand(input);

  const lower = input.toLowerCase();
  const [cmd, ...rest] = lower.split(/\s+/);
  const argStr = rest.join(" ");
  const rawArgStr = input.split(/\s+/).slice(1).join(" "); // preserves case

  // combat routing
  if (gameState.combat.inCombat) {
    handleCombatCommand(cmd, input);
    scheduleSave();
    return;
  }

  switch (cmd) {
    case "help": handleHelp(); break;

    case "look":
    case "l": handleLook(); break;

    case "inventory":
    case "inv":
    case "i": handleInventory(); break;

    case "go":
    case "move":
      if (!rest.length) logSystem("Go where? (north, south, east, west, up, down)");
      else handleGoWrapper(rest[0]);
      break;

    // allow direction alone
    case "north":
    case "south":
    case "east":
    case "west":
    case "up":
    case "down":
      handleGoWrapper(cmd);
      break;

    case "name":
      handleName(rawArgStr);
      break;

    case "rest":
      handleRest();
      break;

    case "use":
      // IMPORTANT: use extendedUseSystem outside combat too
      extendedUseSystem(rawArgStr, false);
      break;

    case "equip":
      handleEquip(rawArgStr);
      break;

    case "adjust":
      handleAdjust(rawArgStr);
      break;

    case "ring":
      handleRing(rawArgStr);
      break;

    case "search":
      handleSearch();
      break;

    case "reset":
      handleReset();
      break;

    default:
      logSystem("You mumble, unsure what that means. (Type 'help' for commands.)");
      break;
  }

  scheduleSave();
}

// ============================================================
// MODULE 7 — BOOT
// ============================================================

function bootGame() {
  initUIRefs();

  gameState.playerId = getOrCreatePlayerId();

  const loaded = loadSaveIfExists();

  ensureEquipment();
  updateStatusBar();

  if (!loaded) {
    logSystem("VENISTASIA — Dawnspire Below");
    logSystem("Type 'help' for commands.");
  }

  enterRoom(gameState.location);

  const form = document.getElementById("commandForm");
  const input = document.getElementById("commandInput");

  if (form && input) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value;
      input.value = "";
      handleCommand(value);
    });
    input.focus();
  }
}

bootGame();

// Optional: expose for debugging in console
window.VENISTASIA = { gameState, handleCommand, enterRoom, goDirection, saveNow };
