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
    equipment: {
      weaponId: null,
      shieldId: null,
    },
  },
  inventory: [
    { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "ration", name: "Travel Ration", type: "ration" },
  ],
  location: "village_square",
  flags: {
    // filled as you play
  },
  combat: {
    inCombat: false,
    enemy: null,
    previousLocation: null,
    intent: null, // what the enemy is winding up to do
  },
};

// =========================
// Utility: player ID
// =========================

function getOrCreatePlayerId() {
  const key = "venistasia_player_id";
  let id = localStorage.getItem(key);
  if (!id) {
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

function pickLine(arr) {
  return arr[roll(0, arr.length - 1)];
}

// Simple inventory helpers
function findItemIndexByType(type) {
  return gameState.inventory.findIndex((item) => item.type === type);
}

function consumeItemByType(type) {
  const idx = findItemIndexByType(type);
  if (idx === -1) return false;
  gameState.inventory.splice(idx, 1);
  return true;
}

// Extra inventory helpers for "use" system
function findItemIndexByNameFragment(fragment) {
  const lower = fragment.toLowerCase();
  return gameState.inventory.findIndex((item) =>
    (item.name || "").toLowerCase().includes(lower)
  );
}

function consumeItemByIndex(idx) {
  if (idx < 0 || idx >= gameState.inventory.length) return null;
  const [item] = gameState.inventory.splice(idx, 1);
  return item;
}

// Any lantern shard fragment in inventory?
function playerHasLanternShard() {
  return gameState.inventory.some((item) => {
    if (!item) return false;
    const id = item.id || "";
    const name = (item.name || "").toLowerCase();
    return id.startsWith("lantern-shard") || name.includes("lantern shard");
  });
}

// Equipment helpers
function ensureEquipment() {
  if (!gameState.player.equipment) {
    gameState.player.equipment = { weaponId: null, shieldId: null };
  }
}

function getEquippedWeapon() {
  ensureEquipment();
  const eqId = gameState.player.equipment.weaponId;
  if (eqId) {
    const found = gameState.inventory.find((i) => i.id === eqId);
    if (found) return found;
  }
  return gameState.inventory.find((i) => i.type === "weapon") || null;
}

// =========================
// Combat flavor text
// =========================

const combatFlavor = {
  player: {
    normal: {
      beast: [
        "You hack into the {name}, fur and flesh tearing under your swing.",
        "Your blade bites into the {name}, opening a ragged line of red.",
      ],
      humanoid: [
        "You smash your weapon into the {name}'s ribs.",
        "You drive your blade into the {name}'s side, hot blood soaking your hands.",
      ],
      caster: [
        "You cut through trailing cloth and flesh as the {name} fumbles a spell.",
        "Your weapon bites into the {name}'s side, scattering ash-stained fabric and blood.",
      ],
    },
    crit: {
      beast: [
        "Your swing connects with the {name}'s neck. CRITICAL HIT.",
        "You bring your weapon down and split the {name}'s skull. CRITICAL HIT.",
      ],
      humanoid: [
        "Your weapon caves in the {name}'s skull. CRITICAL HIT.",
        "You drive your blade up beneath the {name}'s jaw. CRITICAL HIT.",
      ],
      caster: [
        "You drive your weapon straight through the {name}'s chest. CRITICAL HIT.",
        "Your strike shears off the {name}'s casting hand. CRITICAL HIT.",
      ],
    },
  },

  enemy: {
    normal: {
      beast: [
        "The {name} sinks its teeth into your arm.",
        "The {name} rakes claws across your side.",
      ],
      humanoid: [
        "The {name}'s weapon crunches into your ribs.",
        "The {name} drives a blade across your chest.",
      ],
      caster: [
        "A jagged bolt of force slams into your chest.",
        "The {name}'s spell burns across your arm.",
      ],
    },
    crit: {
      beast: [
        "The {name} latches onto your throat. CRITICAL WOUND.",
        "The {name} tears a mouthful from your face. CRITICAL WOUND.",
      ],
      humanoid: [
        "The {name}'s weapon crushes into your skull. CRITICAL WOUND.",
        "The {name} drives steel deep into your chest. CRITICAL WOUND.",
      ],
      caster: [
        "The {name}'s spell erupts inside your chest. CRITICAL WOUND.",
        "A lance of warped light punches through your shoulder. CRITICAL WOUND.",
      ],
    },
  },
};

// =========================
// DOM references
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
  if (!statusNameEl) return;
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
    description: [
      "You stand in the cramped heart of Briar's Edge, a frontier village nailed together from weather-beaten timber and old promises.",
      "Beyond the last sagging rooftops to the north, the Shaded Frontier begins in a hard, dark line of trees.",
    ].join(" "),
  },

  dark_forest_edge: {
    name: "Forest Edge",
    description: [
      "The road from Briar's Edge dissolves into churned mud and exposed roots as the forest takes over.",
      "Somewhere deeper in, the quake-torn clearing and the Dawnspire wait.",
    ].join(" "),
  },

  dungeon_entrance: {
    name: "Dawnspire – Broken Ring",
    description: [
      "The trees fall away into a raw wound in the earth where the ground has split and slumped, exposing a ring of ancient stone.",
      "Rough steps spiral downward into a throat of cold, unmoving darkness.",
    ].join(" "),
  },

  // Room 1 – Broken Ring Descent
  broken_ring_descent: {
    name: "Dawnspire – Broken Ring Descent",
    description: [
      "The spiral stairs descend from the surface. The walls are slick with seepage and faintly glowing lichen.",
      "The air is colder the deeper you go, as if this place has been holding its breath for a very long time.",
    ].join(" "),
  },

  // Room 2 – Cracked Landing
  cracked_landing: {
    name: "Dawnspire – Cracked Landing",
    description: [
      "The stairs spill out onto a cramped stone landing littered with fresh rubble.",
      "Looking back up, you can still see a pale suggestion of light far above.",
    ].join(" "),
  },

  // Room 3 – Collapsed Stairwell
  collapsed_stairwell: {
    name: "Dawnspire – Collapsed Stairwell",
    description: [
      "The stairwell here buckles around a mound of fallen stone.",
      "Above, a plug of shattered blocks chokes the way up; below, the stairs continue into deeper dark.",
    ].join(" "),
  },

  // Room 4 – Rat-gnawed Vestibule
  rat_gnawed_vestibule: {
    name: "Dawnspire – Rat-gnawed Vestibule",
    description: [
      "The stair spills into a low chamber where stone has been gnawed and worried at the edges.",
      "Chewed-open tunnels vein the lower masonry. The remains of an old camp slump against one wall.",
    ].join(" "),
  },

  // Room 5 – Gnawed Storeroom
  gnawed_storeroom: {
    name: "Dawnspire – Gnawed Storeroom",
    description: [
      "A low arch opens into what was once a storeroom. Shelves have collapsed into rotten heaps.",
      "Torn sacks spill long-mummified grain and a carpet of small bones that crack under every step.",
    ].join(" "),
  },

  // Room 6 – Outer Hall of Lanterns
  outer_hall_lanterns: {
    name: "Dawnspire – Outer Hall of Lanterns",
    description: [
      "A long hall runs north and east, lined with broken sconces and cracked stone lanterns.",
      "A few intact sconces remain: shallow cups shaped to cradle something prismatic, now empty.",
    ].join(" "),
  },

  // Room 7 – Flicker Node
  flicker_node: {
    name: "Dawnspire – Flicker Node",
    description: [
      "The hall cinches into a small junction chamber, ceiling low and air close with dust.",
      "A single lantern fixture survives on the far wall, mirror-backed with an empty prismatic socket.",
    ].join(" "),
  },

  // Room 8 – Door of Failed Light
  door_failed_light: {
    name: "Dawnspire – Door of Failed Light",
    description: [
      "The hall terminates in a heavy stone door carved with a fractured sunburst.",
      "Above it, three dull crystal sockets wait, lines in the stone leading back along the walls.",
      "Chiseled below: “Lanterns failed. Stones fell. Light must bend to pass.”",
    ].join(" "),
  },

  // Room 9 – Mirror Gallery
  mirror_gallery: {
    name: "Dawnspire – Mirror Gallery",
    description: [
      "A narrow hall ribbed with tall mirror panels, most cracked or clouded.",
      "Some still pivot loosely on corroded brackets, ready to catch and bend any light.",
    ].join(" "),
  },

  // Room 10 – Shard Niche
  shard_niche: {
    name: "Dawnspire – Shard Niche",
    description: [
      "The passage tightens into a small circular chamber with walls smoothed by long-ago hands.",
      "At the center stands a pedestal with a lantern fixture. Beside its empty socket lies a narrow crystal shard.",
    ].join(" "),
  },

  // Room 11 – Fallen Guard Post
  fallen_guard_post: {
    name: "Dawnspire – Fallen Guard Post",
    description: [
      "A cramped room that still remembers the shape of vigilance.",
      "An overturned table leans like a failed barricade; rusted spears lie scattered.",
      "From a cracked bracket near the ceiling hangs a split iron bell, heavy and mute.",
    ].join(" "),
  },

  // Room 12 – Broken Barracks
  broken_barracks: {
    name: "Dawnspire – Broken Barracks",
    description: [
      "The stone opens into a longer chamber that once served as a bunk room for the garrison.",
      "Two rows of bunk frames lean at sick angles, half of them half-slid into a black fissure that splits the floor.",
      "Rotted bedding clings to splintered boards like molted skins. Footlockers lie smashed open, contents long since looted or ground into dust.",
    ].join(" "),
  },

  // Room 13 – Lantern Muster Hall
  lantern_muster_hall: {
    name: "Dawnspire – Lantern Muster Hall",
    description: [
      "A broader chamber opens here, wider than the barracks, its ceiling held aloft by squat stone pillars veined with old soot.",
      "Faded banners hang in ragged strips from iron rings, each bearing a stylized lantern picked out in flaking gold thread.",
      "At the room’s center, the flagstones give way to a cracked stone relief-map of the Dawnspire itself—three concentric rings etched into the floor, shattered by jagged fault-lines.",
    ].join(" "),
  },

  // Room 14 – Armory of Dust
  armory_of_dust: {
    name: "Dawnspire – Armory of Dust",
    description: [
      "Weapon racks stand in leaning rows, their hooks hung with shapes that were once steel and are now little more than red-brown flakes.",
      "Every breath disturbs a skin of rust on the floor, sending tiny metallic ghosts swirling in the lantern-light.",
      "Here and there, something has survived: a few intact blades, a handful of shield-bosses, and one sword that looks almost too perfect for this graveyard.",
    ].join(" "),
  },

  // Room 15 – Watch Balcony
  watch_balcony: {
    name: "Dawnspire – Watch Balcony",
    description: [
      "A narrow stone balcony juts out over a vast dark hollow, its parapet cracked and bowed outward over nothing.",
      "Far below, you can just make out the glimmer of black water and the ghost-lines of walkways skirting a buried cistern.",
      "A narrow stair curls down along the eastern wall, clinging to the stone like something afraid to let go.",
    ].join(" "),
  },

  // Room 16 – Hidden Shrine to the Flame (Secret Room)
  hidden_shrine_flame: {
    name: "Dawnspire – Hidden Shrine to the Flame",
    description: [
      "You squeeze out of the crawl into a small circular chamber carved smooth and close.",
      "At its center stands an intact statue of a Lantern Knight, stone cloak swept back, one gauntleted hand held out as if offering or asking.",
      "Nestled in the statue’s other hand burns a crystal flame—pale, steady, and somehow untouched by dust.",
    ].join(" "),
  },

  // Room 18 – Upper Cistern Walk (stub for Zone D)
  upper_cistern_walk: {
    name: "Dawnspire – Upper Cistern Walk",
    description: [
      "A narrow ledge clings to the side of a massive cistern wall, slick stone dropping away into dark water below.",
      "The air is cold and wet; the sound of slow, heavy dripping echoes from unseen depths.",
      "This stretch of the Dawnspire (Zone D) feels half-formed, as if the world is still deciding what else to put here.",
    ].join(" "),
  },
};

// Exits helper text for each location
const exitsByLocation = {
  village_square:
    "Obvious exits: north – toward the Shaded Frontier and the Dawnspire rumors.",
  dark_forest_edge:
    "Obvious exits: south – back to Briar's Edge; north – to the quake-torn clearing and the stone ring.",
  dungeon_entrance:
    "Obvious exits: south – back to the forest edge; down – into the Broken Ring Descent.",
  broken_ring_descent:
    "Obvious exits: up – back to the stone ring; down – deeper to the cracked landing.",
  cracked_landing:
    "Obvious exits: up – back toward the Broken Ring Descent; down/forward – into the warped stairwell below.",
  collapsed_stairwell:
    "Obvious exits: up – back to the cracked landing; down/forward – into the rat-gnawed chamber.",
  rat_gnawed_vestibule:
    "Obvious exits: west/back – toward the twisted stairwell; east – into a gnawed storeroom; north – into the Outer Hall of Lanterns.",
  gnawed_storeroom:
    "Obvious exits: west/back – through the low arch into the rat-gnawed vestibule.",
  outer_hall_lanterns:
    "Obvious exits: south – back to the rat-gnawed vestibule; east – toward a flickering node of old power; north – to a sealed Door of Failed Light.",
  flicker_node:
    "Obvious exits: west/back – to the Outer Hall of Lanterns; north – into a gallery of cracked mirrors.",
  door_failed_light:
    "Obvious exits: south/back – to the Outer Hall of Lanterns; north – deeper into the Dawnspire, if the door ever opens.",
  mirror_gallery:
    "Obvious exits: south/back – to the flicker node junction; east – into a small niche chamber cut around a lonely pedestal.",
  shard_niche:
    "Obvious exits: west/back – to the mirror gallery; north – toward a cramped guard post with an overturned table and a cracked bell.",
  fallen_guard_post:
    "Obvious exits: south/back – to the shard niche; east – into a longer chamber lined with ruined bunks.",
  broken_barracks:
    "Obvious exits: west/back – to the fallen guard post; north – into a broader hall where lantern-bearers once gathered.",
  lantern_muster_hall:
    "Obvious exits: south/back – to the broken barracks; east – into an old armory; north – up to a watch balcony over the chasm.",
  armory_of_dust:
    "Obvious exits: west/back – to the Lantern Muster Hall; east – a low, shadowed gap in the racks (if you’ve found it).",
  watch_balcony:
    "Obvious exits: south – back down into the Lantern Muster Hall; east/down – along a narrow stair to an upper cistern walk.",
  hidden_shrine_flame:
    "Obvious exits: west/back – crawl back through the tight passage to the Armory of Dust.",
  upper_cistern_walk:
    "Obvious exits: west/up – back along the narrow stair to the watch balcony.",
};

function printExitsForLocation(id) {
  const text = exitsByLocation[id];
  if (text) logSystem(text);
}

// helper: stairs collapse message
function reportStairsCollapsed() {
  logSystem(
    "Stone and dust fill the stairwell above. Whatever daylight once lived up there is gone."
  );
}

// helper: landing loot
function maybeGrantLanternBadge() {
  if (gameState.flags.gotLanternBadge) return;

  gameState.flags.gotLanternBadge = true;
  const badge = {
    id: "lantern-knight-badge",
    name: "Lantern Knight’s Badge",
    type: "key",
  };
  gameState.inventory.push(badge);

  logSystem(
    "Half-buried in the rubble, your fingers close on something cold and worked: a small badge stamped with a stylized lantern."
  );
  logSystem("You take the Lantern Knight’s Badge.");
}

// ===== Trap death helper =====
function handleTrapDeath(trapKey) {
  let lines;
  switch (trapKey) {
    case "collapsed_stair_rock":
      lines = [
        "Stone shears free above. A block the size of your chest slams into you. There is a crack, a flash, and then nothing.",
      ];
      break;
    case "gnawed_rats":
      lines = [
        "The bone-drift erupts under your feet in a living tide of teeth. You go down screaming into the swarm.",
      ];
      break;
    case "mirror_flash":
      lines = [
        "Light ricochets between mirrors and hits your eyes full-on. White pain tears through your skull and never quite lets go.",
      ];
      break;
    case "barracks_collapse":
      lines = [
        "The bunk gives way under your weight. You fall with it into the fissure, stone and splintered wood slamming you into the dark.",
      ];
      break;
    case "armory_rust_cloud":
      lines = [
        "You grab the perfect blade and it explodes into dust in your hands. Rust floods your eyes and mouth as your lungs seize and everything goes hard and black.",
      ];
      break;
    case "watch_fall":
      lines = [
        "Stone gives way under your grip. You pitch forward with the railing, falling into the hollow below.",
        "The rush of air rips any last sound out of your throat. The impact, when it comes, is just distance closing.",
      ];
      break;
    default:
      lines = [
        "Something in the dark moves, and your story ends faster than you can understand.",
      ];
      break;
  }

  logSystem(pickLine(lines));
  logSystem("The Dawnspire doesn’t care how you die. It only cares that you stay.");
  handleReset();
}

// helper: Room 3 loose-stone trap
function runCollapsedStairTrap() {
  if (gameState.flags.collapsedStairTrapDone) return true;

  gameState.flags.collapsedStairTrapDone = true;

  logSystem(
    "Your boot rolls on a loose stone. The stair lurches, and a chunk of the ceiling breaks free."
  );

  const dmg = roll(1, 3);
  const p = gameState.player;

  if (dmg <= 0) {
    logSystem("Dust and pebbles shower over you, but the worst of it misses.");
    return true;
  }

  p.hp -= dmg;

  if (p.hp <= 0) {
    p.hp = 0;
    updateStatusBar();
    handleTrapDeath("collapsed_stair_rock");
    return false;
  }

  updateStatusBar();
  logSystem(`The falling stone grazes you for ${dmg} damage. HP: ${p.hp}/${p.maxHp}.`);
  return true;
}

// helper: Room 5 rat-swarm trap
function runGnawedStoreroomTrap() {
  if (gameState.flags.gnawedStoreroomTrapDone) return true;

  gameState.flags.gnawedStoreroomTrapDone = true;

  logSystem(
    "Your step sinks into a drift of bones. The whole pile shivers, then erupts as a churning swarm of half-rotten rats."
  );

  const dmg = roll(1, 3);
  const p = gameState.player;

  p.hp -= dmg;

  if (p.hp <= 0) {
    p.hp = 0;
    updateStatusBar();
    handleTrapDeath("gnawed_rats");
    return false;
  }

  updateStatusBar();
  logSystem(
    `They tear at your ankles and calves before scattering back into the dark. (${dmg} damage) HP: ${p.hp}/${p.maxHp}.`
  );
  return true;
}

// helper: Broken Barracks search trap + loot
function runBarracksSearchTrapAndLoot() {
  if (gameState.flags.barracksTrapDone) {
    if (gameState.flags.barracksLootTaken) {
      logSystem(
        "You pick over the ruined bunks again, but all that’s left is splinters and dust."
      );
      return;
    }
    maybeGrantBarracksLoot();
    return;
  }

  gameState.flags.barracksTrapDone = true;

  logSystem(
    "You lean your weight into one of the more intact bunks. Rotten timbers give with a sharp crack."
  );
  logSystem(
    "The frame lurches sideways and slides into the fissure, dragging you half with it in a roar of splintering wood and falling stone."
  );

  const dmg = roll(1, 3);
  const p = gameState.player;
  p.hp -= dmg;

  if (p.hp <= 0) {
    p.hp = 0;
    updateStatusBar();
    handleTrapDeath("barracks_collapse");
    return;
  }

  updateStatusBar();
  logSystem(
    `You slam into the edge of the fissure and haul yourself back up, bruised and breathless. (${dmg} damage) HP: ${p.hp}/${p.maxHp}.`
  );

  maybeGrantBarracksLoot();
}

function maybeGrantBarracksLoot() {
  if (gameState.flags.barracksLootTaken) return;
  gameState.flags.barracksLootTaken = true;

  const ration = { id: "ration", name: "Travel Ration", type: "ration" };
  const draught = {
    id: "low-healing-draught",
    name: "Low-grade Healing Draught",
    type: "consumable",
    heal: 8,
  };
  const journal = {
    id: "torn-journal-pages",
    name: "Torn Journal Pages",
    type: "lore",
  };

  gameState.inventory.push(ration, draught, journal);

  logSystem(
    "In the space where the bunk tore free, your hand brushes old parchment and something glass still mostly intact."
  );
  logSystem(
    "You recover a few Torn Journal Pages, a shriveled ration wrapped in oilcloth, and a small stoppered vial of pale liquid."
  );
  logSystem("You gain: Torn Journal Pages, Travel Ration, Low-grade Healing Draught.");
}

// helper: Watch Balcony trap
function runWatchBalconyTrap() {
  if (gameState.flags.watchBalconyTrapDone) {
    logSystem(
      "You keep a healthier distance from the cracked parapet this time; the stone looks ready to betray anyone who trusts it twice."
    );
    return;
  }

  gameState.flags.watchBalconyTrapDone = true;

  logSystem(
    "You lean out over the parapet to get a better look at the cistern below. The cracked stone shifts under your hands with a sharp, grinding pop."
  );
  logSystem(
    "For a heartbeat you hang in empty air with the railing, then slam back into the balcony as a chunk breaks away and tumbles into the dark."
  );

  const dmg = roll(2, 5);
  const p = gameState.player;
  p.hp -= dmg;

  if (p.hp <= 0) {
    p.hp = 0;
    updateStatusBar();
    handleTrapDeath("watch_fall");
    return;
  }

  updateStatusBar();
  logSystem(
    `Pain blooms along your ribs where the stone caught you. Somewhere far below, the broken railing hits water with a distant splash. (${dmg} damage) HP: ${p.hp}/${p.maxHp}.`
  );
}

// helper: vestibule loot (after fight)
function maybeGrantVestibuleLoot() {
  if (gameState.flags.gotVestibuleLoot) return;
  if (!gameState.flags.vestibuleCombatDone) return;

  gameState.flags.gotVestibuleLoot = true;

  const ration = { id: "ration", name: "Travel Ration", type: "ration" };
  const bandage = {
    id: "dirty-bandage",
    name: "Dirty Bandage",
    type: "consumable",
    heal: 4,
  };

  gameState.inventory.push(ration, bandage);

  logSystem(
    "Picking through the shredded bedroll and pack remains, you turn up a stale ration and a strip of dirty bandage stiff with old blood."
  );
  logSystem("You gain: Travel Ration, Dirty Bandage.");
}

// helper: storeroom loot (Rust-Flecked Buckler + Lantern Shard #1)
function maybeGrantStoreroomBuckler() {
  if (gameState.flags.gotStoreroomBuckler) return;
  if (!gameState.flags.gnawedStoreroomTrapDone) return;

  gameState.flags.gotStoreroomBuckler = true;

  const buckler = {
    id: "rust-buckler",
    name: "Rust-Flecked Buckler",
    type: "shield",
  };

  const shard = {
    id: "lantern-shard-1",
    name: "Lantern Shard (First Fragment)",
    type: "key",
  };

  gameState.inventory.push(buckler, shard);

  logSystem(
    "Kicking aside scattered bones, you spot the curve of metal under a fallen shelf: a small buckler, its surface pitted with rust."
  );
  logSystem(
    "Nearby, half-wedged between old grain and gnawed bone, a narrow shard of prismatic crystal catches the light."
  );
  logSystem("You gain: Rust-Flecked Buckler, Lantern Shard (First Fragment).");

  ensureEquipment();
  if (!gameState.player.equipment.shieldId) {
    gameState.player.equipment.shieldId = "rust-buckler";
    logSystem("You strap the buckler onto your forearm. Clumsy, but better than nothing.");
  }
}

// helper: Shard Niche loot – Lantern Shard #2
function maybeGrantShardNicheShard() {
  if (gameState.flags.gotShardNicheShard) return;

  gameState.flags.gotShardNicheShard = true;

  const shard2 = {
    id: "lantern-shard-2",
    name: "Lantern Shard (Second Fragment)",
    type: "key",
  };

  gameState.inventory.push(shard2);

  logSystem(
    "Up close, the crystal on the pedestal is unmistakable: another lantern shard, its facets too clean and deliberate to be natural."
  );
  logSystem("You gain: Lantern Shard (Second Fragment).");
}

// helper: Flicker Node loot – 2–5 coins
function maybeGrantFlickerNodeLoot() {
  if (gameState.flags.gotFlickerNodeLoot) return;

  gameState.flags.gotFlickerNodeLoot = true;

  const count = roll(2, 5);
  for (let i = 0; i < count; i++) {
    gameState.inventory.push({
      id: "dawnspire-coin",
      name: "Dawnspire Coin",
      type: "coin",
    });
  }

  logSystem(
    "Shifting a broken slab near the lantern housing, you expose a few tarnished coins stamped with an unfamiliar crest."
  );
  logSystem(`You gain: Dawnspire Coins (${count}).`);
}

// helper: Guard Post loot – Old Guard Spear
function maybeGrantGuardPostLoot() {
  if (gameState.flags.gotGuardSpear) return;

  gameState.flags.gotGuardSpear = true;

  const spear = {
    id: "old-guard-spear",
    name: "Old Guard Spear",
    type: "weapon",
    atk: 1,
  };

  gameState.inventory.push(spear);

  logSystem(
    "Picking through the fallen spears, you find one whose haft hasn't gone completely to mush and whose head still holds a wicked edge."
  );
  logSystem(
    "It’s longer than your sword—enough reach to keep teeth and knives a step farther from your throat."
  );
  logSystem("You gain: Old Guard Spear.");

  ensureEquipment();
  const eqWeapon = gameState.player.equipment.weaponId;
  if (!eqWeapon || eqWeapon === "rusty-sword") {
    gameState.player.equipment.weaponId = "old-guard-spear";
    logSystem(
      "You trade the close comfort of your rusty sword for the reach of the spear, settling its butt against the stone with a dull knock."
    );
  }
}

// helper: Armory Trap + Loot + Secret Crawl
function runArmoryTrapAndLoot() {
  if (gameState.flags.armoryTrapDone) {
    if (!gameState.flags.armoryLootTaken) {
      maybeGrantArmoryLoot();
    } else {
      logSystem(
        "Most of what might have been useful in the armory is either dust or already on your back."
      );
    }
    return;
  }

  gameState.flags.armoryTrapDone = true;

  logSystem(
    "Among the flaking wreckage of blades, one sword catches your eye—straight, untarnished, almost eager to be taken."
  );
  logSystem(
    "Your fingers close around the hilt. The metal gives like stale bread. The entire blade collapses into a choking cloud of rust that explodes across your face and chest."
  );

  const dmg = roll(1, 3);
  const p = gameState.player;
  p.hp -= dmg;

  if (p.hp <= 0) {
    p.hp = 0;
    updateStatusBar();
    handleTrapDeath("armory_rust_cloud");
    return;
  }

  updateStatusBar();
  logSystem(
    `You stagger back, eyes burning, lungs rasping around the taste of blood and metal. (${dmg} damage) HP: ${p.hp}/${p.maxHp}.`
  );

  maybeGrantArmoryLoot();
}

function maybeGrantArmoryLoot() {
  if (gameState.flags.armoryLootTaken) return;
  gameState.flags.armoryLootTaken = true;

  const ironSword = {
    id: "iron-sword",
    name: "Serviceable Iron Sword",
    type: "weapon",
    atk: 2, // upgrade from rusty sword (1)
  };

  const shard3 = {
    id: "lantern-shard-3",
    name: "Lantern Shard (Third Fragment)",
    type: "key",
  };

  const coinCount = roll(1, 3);
  const coins = [];
  for (let i = 0; i < coinCount; i++) {
    coins.push({
      id: "dawnspire-coin",
      name: "Dawnspire Coin",
      type: "coin",
    });
  }

  gameState.inventory.push(ironSword, shard3, ...coins);

  logSystem(
    "When the rust settles, you notice a sturdier blade still sheathed in its own decay: an iron sword whose edge has somehow survived."
  );
  logSystem(
    "On a lower rack, a shield-boss lies half-buried in red dust. Its center holds a wedge of prismatic crystal, fused deep into the metal."
  );
  logSystem(
    "You pry the shard free and shake a few loose coins from under the collapsed racks."
  );
  logSystem(
    `You gain: Serviceable Iron Sword, Lantern Shard (Third Fragment), Dawnspire Coins (${coinCount}).`
  );

  // Auto-equip if it's clearly better
  ensureEquipment();
  const current = getEquippedWeapon();
  if (!current || (current.atk || 0) < ironSword.atk) {
    gameState.player.equipment.weaponId = "iron-sword";
    logSystem(
      "You discard your inferior steel in favor of the iron blade. It feels honest in your grip—heavy, but willing."
    );
  }

  // Reveal secret crawlspace
  if (!gameState.flags.armorySecretRevealed) {
    gameState.flags.armorySecretRevealed = true;
    logSystem(
      "As you move the racks aside, rust and splinters crumble away to reveal a low, dark gap in the eastern wall—barely wide enough to crawl through."
    );
  }
}

// helper: bell ring logic in Fallen Guard Post
function triggerBellRing() {
  if (gameState.flags.guardPostBellRung) {
    logSystem(
      "You eye the cracked bell again. Whatever answer it had to give, it already shouted it into the halls."
    );
    return;
  }

  gameState.flags.guardPostBellRung = true;

  logSystem(
    "You wrap your fingers around the cold, split rim of the bell and give it a pull. Sound tears out of it in a broken, staggering peal."
  );

  const rollResult = roll(1, 100);

  if (rollResult <= 50) {
    logSystem(
      "For a heartbeat, nothing answers. Then the spears on the floor begin to rattle as something small and many-legged pours out from under the overturned table."
    );
    logSystem(
      "A swarm of tunnel-rats boils across the stone, drawn by the noise and the promise of something warm to gnaw."
    );
    gameState.combat.previousLocation = "fallen_guard_post";
    startCombat("dawnspire_rat");
  } else {
    logSystem(
      "The sound staggers off into the dark, bouncing from wall to wall until it's hard to tell where it started."
    );
    logSystem(
      "Far away in the halls beyond, something answers with the scrape of claws and the faint, excited squeal of things that have just been told where dinner might be."
    );
    gameState.flags.guardPostBellAmbushPending = true;
  }
}

// helper: possibly trigger bell ambush later
function maybeTriggerBellAmbush() {
  if (
    !gameState.flags.guardPostBellAmbushPending ||
    gameState.flags.guardPostBellAmbushTriggered
  ) {
    return;
  }

  const loc = gameState.location;
  if (loc === "outer_hall_lanterns" || loc === "mirror_gallery") {
    gameState.flags.guardPostBellAmbushPending = false;
    gameState.flags.guardPostBellAmbushTriggered = true;

    logSystem(
      "Somewhere behind you, the echo of that broken bell peals again—memory or imagination, you can't tell. What you do hear clearly is the sudden scrabble of claws."
    );
    logSystem(
      "A starving tunnel-rat darts out from a crack in the stone, eyes wild and teeth already wet."
    );

    gameState.combat.previousLocation = loc;
    startCombat("dawnspire_rat");
  }
}

// helper: start the vestibule multi-rat fight
function startVestibuleFight() {
  gameState.flags.firstVestibuleVisit = true;

  const twoRats = roll(1, 100) <= 50;
  gameState.flags.vestibuleRatsRemaining = twoRats ? 2 : 1;
  gameState.combat.previousLocation = "collapsed_stairwell";

  if (twoRats) {
    logSystem(
      "The scratching in the tunnels builds to a frenzy. Two starved shapes spill out of the holes at once."
    );
  } else {
    logSystem(
      "Scratching builds in the walls until a single starved shape spills out, all teeth and motion."
    );
  }

  startCombat("dawnspire_rat");
}

// helper: start the Broken Barracks fight (1–2 Desiccated Soldiers)
function startBarracksFight() {
  if (gameState.flags.barracksFightStarted) return;
  gameState.flags.barracksFightStarted = true;

  const two = roll(1, 100) <= 50;
  gameState.flags.barracksSoldiersRemaining = two ? 2 : 1;
  gameState.combat.previousLocation = "fallen_guard_post";

  if (two) {
    logSystem(
      "As you step between the ruined bunks, two shapes pull themselves upright from where they lay collapsed, joints cracking dryly."
    );
  } else {
    logSystem(
      "One of the slumped figures on a bunk jerks and rises, bones creaking as it remembers how to stand guard."
    );
  }

  startCombat("desiccated_soldier");
}

// helper: start Lantern Muster Hall mini-elite fight
function startLanternMusterFight() {
  if (gameState.flags.lanternMusterFightStarted) return;
  gameState.flags.lanternMusterFightStarted = true;

  gameState.combat.previousLocation = "broken_barracks";

  logSystem(
    "As you step across the cracked floor-map, one of the banner-shadows peels itself away from the far wall, lantern swinging from a dead hand."
  );
  logSystem(
    "A figure in half-rotted plate armor staggers into the light it carries, empty eye-sockets glowing with a pale, steady ember."
  );

  startCombat("hollow_lantern_bearer");
}

// =========================
// Use / bandage / draught / equip / mirrors / shards / bell / search
// =========================

function useBandage(inCombat) {
  const idx = findItemIndexByNameFragment("bandage");
  if (idx === -1) {
    logSystem("You fumble for a bandage, but come up with nothing but dirty fingers.");
    return false;
  }

  const item = gameState.inventory[idx];
  const healAmount = item.heal || 4;
  consumeItemByIndex(idx);

  const p = gameState.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + healAmount);
  updateStatusBar();

  const healed = p.hp - before;

  if (healed <= 0) {
    logSystem(
      "You wrap the filthy cloth around already-closed wounds. It does more for your courage than your flesh."
    );
  } else if (inCombat) {
    logSystem(
      "You yank the filthy bandage tight around the worst of the bleeding, teeth clenched."
    );
    logSystem(`You recover ${healed} HP. HP: ${p.hp}/${p.maxHp}.`);
  } else {
    logSystem(
      "You take a moment to wrap the dirty bandage around the worst of the damage. It isn't clean, but it holds you together."
    );
    logSystem(`You recover ${healed} HP. HP: ${p.hp}/${p.maxHp}.`);
  }

  return true;
}

function useHealingDraught(inCombat) {
  const idx = findItemIndexByNameFragment("draught");
  const idxAlt = idx === -1 ? findItemIndexByNameFragment("potion") : idx;

  const useIdx = idxAlt;
  if (useIdx === -1) {
    logSystem("You pat yourself down for a vial, but come up empty.");
    return false;
  }

  const item = gameState.inventory[useIdx];
  const healAmount = item.heal || 8;
  consumeItemByIndex(useIdx);

  const p = gameState.player;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + healAmount);
  updateStatusBar();
  const healed = p.hp - before;

  if (healed <= 0) {
    logSystem("You swallow the bitter liquid, but it only calms your nerves.");
  } else if (inCombat) {
    logSystem(
      "You wrench the stopper out with your teeth and gulp the draught down as fast as you dare. Heat blooms in your gut and spreads outward."
    );
    logSystem(`You recover ${healed} HP. HP: ${p.hp}/${p.maxHp}.`);
  } else {
    logSystem(
      "You drink the draught slowly, letting its warmth seep into the aches and bruises that never quite left."
    );
    logSystem(`You recover ${healed} HP. HP: ${p.hp}/${p.maxHp}.`);
  }

  return true;
}

function handleEquip(rawArgs) {
  const arg = (rawArgs || "").trim().toLowerCase();
  if (!arg) {
    logSystem("Equip what? (e.g., 'equip sword' or 'equip buckler')");
    return;
  }

  const idx = gameState.inventory.findIndex((item) =>
    (item.name || "").toLowerCase().includes(arg)
  );
  if (idx === -1) {
    logSystem("You don't seem to be carrying anything like that.");
    return;
  }

  const item = gameState.inventory[idx];
  ensureEquipment();

  if (item.type === "weapon") {
    gameState.player.equipment.weaponId = item.id;
    logSystem(
      `You shift your grip around the ${item.name}, letting its weight settle into something that feels like intent.`
    );
  } else if (item.type === "shield") {
    gameState.player.equipment.shieldId = item.id;
    logSystem(
      `You strap the ${item.name} to your forearm. It's not much, but it's better than empty air.`
    );
  } else {
    logSystem("That doesn't sit right in your hands as a weapon or shield.");
  }

  updateStatusBar();
}

function grantShrineBlessingAndCharm() {
  if (gameState.flags.shrineBlessingGranted) return;

  gameState.flags.shrineBlessingGranted = true;
  gameState.flags.shrineBlessingActive = true;

  // Loot: Flame-Touched Charm (only once)
  if (!gameState.flags.shrineLootTaken) {
    gameState.flags.shrineLootTaken = true;
    const charm = {
      id: "flame-touched-charm",
      name: "Flame-Touched Charm",
      type: "charm",
    };
    gameState.inventory.push(charm);
    logSystem(
      "As the crystal flame swells, a sliver of it gutters loose and hardens into a small charm—warm to the touch, threaded with a quiet inner glow."
    );
    logSystem("You gain: Flame-Touched Charm.");
  }

  const p = gameState.player;
  const oldMax = p.maxHp;
  const oldHp = p.hp;

  // Permanent max HP boost: +5 to current max HP
  p.maxHp = oldMax + 5;

  // Also add 5 to current HP, but cap at new max
  p.hp = Math.min(p.maxHp, oldHp + 5);
  updateStatusBar();

  logSystem(
    "Light floods up through the statue’s arm, into the crystal flame, and then out through the chamber. For a heartbeat, you feel as though you’re standing in noon sunlight instead of buried stone."
  );
  logSystem(
    "The warmth doesn’t just close wounds—it settles deeper, thickening bone and hardening muscle."
  );
  logSystem(
    `Your maximum HP rises from ${oldMax} to ${p.maxHp}.`
  );
  if (p.hp > oldHp) {
    logSystem(
      `You also feel some of your current hurts ease. HP: ${p.hp}/${p.maxHp}.`
    );
  }

  logSystem(
    "You carry a quiet certainty now: the first blow that should kill you in battle will leave you hanging on at the edge instead."
  );
}

function handleUse(rawArgs, { inCombat = false } = {}) {
  const arg = (rawArgs || "").trim().toLowerCase();
  if (!arg) {
    logSystem("Use what?");
    return;
  }

  // Bell in Fallen Guard Post
  if (arg.includes("bell") && gameState.location === "fallen_guard_post") {
    if (inCombat) {
      logSystem("You have no spare seconds to tug on a bell rope right now.");
      return;
    }
    triggerBellRing();
    return;
  }

  // Bandages – mid-combat heal
  if (arg.includes("bandage")) {
    const used = useBandage(inCombat);
    if (!used) return;
    return;
  }

  // Healing draught / potion
  if (arg.includes("draught") || arg.includes("potion")) {
    const used = useHealingDraught(inCombat);
    if (!used) return;
    return;
  }

  // Journal pages – lore
  if (arg.includes("journal") || arg.includes("pages")) {
    const idx = findItemIndexByNameFragment("journal");
    const idx2 = idx === -1 ? findItemIndexByNameFragment("pages") : idx;
    if (idx2 === -1) {
      logSystem("You don't seem to be carrying any pages worth reading.");
      return;
    }
    logSystem(
      "The Torn Journal Pages crackle faintly as you unfold them. The handwriting is hurried, ink blotched by old sweat and something darker."
    );
    logSystem(
      "\"The Lantern Knights held the upper rings as long as they could. When the light failed, they shattered the stones and fled downward instead of up. Said the dark below was safer than the dark above.\""
    );
    logSystem(
      "Another line, half-smeared: \"If anyone finds this—remember: light isn't the only thing that can hold a gate.\""
    );
    return;
  }

  // Lantern Shard in Hidden Shrine – blessing + charm
  if (
    (arg.includes("shard") || arg.includes("crystal")) &&
    gameState.location === "hidden_shrine_flame"
  ) {
    if (!playerHasLanternShard()) {
      logSystem(
        "You lay an empty hand in the statue’s open palm. The crystal flame flickers once, politely, and then ignores you."
      );
      return;
    }

    if (gameState.flags.shrineBlessingGranted) {
      logSystem(
        "You press a shard into the statue’s hand again. The crystal flame stirs, but whatever bargain it made with you is already sealed."
      );
      return;
    }

    logSystem(
      "You ease a Lantern Shard into the Knight’s outstretched hand. For a moment it simply rests there, a dull sliver against stone."
    );
    grantShrineBlessingAndCharm();
    return;
  }

  // Lantern Shard in Flicker Node – "Light must travel."
  if (
    (arg.includes("shard") || arg.includes("crystal")) &&
    gameState.location === "flicker_node"
  ) {
    if (!playerHasLanternShard()) {
      logSystem(
        "You pat your pockets for crystal, but come up empty. The lantern socket stays dark and expectant."
      );
      return;
    }

    if (gameState.flags.flickerShardAligned) {
      logSystem(
        "The shard already sits snug in the lantern’s socket, throwing a faint beam north into the waiting mirrors."
      );
      return;
    }

    gameState.flags.flickerShardAligned = true;

    logSystem(
      "You fit a Lantern Shard into the empty socket. A thin thread of pale light wakes inside it and knifes outward toward the north."
    );
    logSystem("The inscription beneath the lantern seems satisfied: “Light must travel.”");
    return;
  }

  // Lantern Shard in Shard Niche – split beam
  if (
    (arg.includes("shard") || arg.includes("crystal")) &&
    gameState.location === "shard_niche"
  ) {
    if (!playerHasLanternShard()) {
      logSystem(
        "Your fingers find only dust and old cuts. Whatever shard once lay here is either in your past or in somebody else’s story."
      );
      return;
    }

    if (gameState.flags.deepNodeShardAligned) {
      logSystem(
        "The shard already sits in the niche’s socket. Light crawls through it in slow pulses, splitting along fractures you can feel more than see."
      );
      return;
    }

    gameState.flags.deepNodeShardAligned = true;

    const hasIncoming =
      !!gameState.flags.flickerShardAligned &&
      !!gameState.flags.mirrorBeamToNiche;

    if (hasIncoming) {
      logSystem(
        "You press the shard into the waiting socket. It bites down with a tiny, hungry click as the faint beam from the gallery finds it."
      );
      logSystem(
        "Light floods the crystal and splits: one ray knifes back toward the mirrors, another dives down the stone toward the carved door to the south."
      );
    } else {
      logSystem(
        "You settle a Lantern Shard into the empty socket. It hums faintly, waiting for a beam to arrive."
      );
    }

    return;
  }

  logSystem("You don't have a clear way to use that right now.");
}

// Mirror adjustment in room 9
function handleAdjust(rawArgs) {
  const arg = (rawArgs || "").trim().toLowerCase();

  if (gameState.location !== "mirror_gallery") {
    logSystem(
      "You prod at your surroundings, but nothing here feels built to be adjusted that way."
    );
    return;
  }

  const hasBeam = !!gameState.flags.flickerShardAligned;

  if (!hasBeam) {
    logSystem(
      "You shove at a few cracked panels. Without any light to catch, all you do is rearrange your own reflection."
    );
    return;
  }

  const misalignRoll = roll(1, 100);
  if (misalignRoll <= 30) {
    logSystem(
      "You wrench one of the looser mirrors a little too far. For a heartbeat, every panel finds the same cruel angle."
    );

    const p = gameState.player;
    const dmg = roll(1, 3);
    p.hp -= dmg;

    if (p.hp <= 0) {
      p.hp = 0;
      updateStatusBar();
      handleTrapDeath("mirror_flash");
      return;
    }

    updateStatusBar();
    logSystem(
      `White fire detonates behind your eyes. When the world staggers back into place, everything swims. (${dmg} damage) HP: ${p.hp}/${p.maxHp}.`
    );
    return;
  }

  const wantsEast = arg.includes("east");
  const wantsDoor =
    arg.includes("door") ||
    arg.includes("gate") ||
    arg.includes("sun") ||
    arg.includes("north");

  if (!wantsEast && !wantsDoor) {
    gameState.flags.mirrorBeamToNiche = false;
    gameState.flags.mirrorBeamToDoor = false;
    gameState.flags.mirrorShardAligned = false;

    logSystem(
      "You nudge a few panels into new positions. The beam skitters from crack to crack, never settling."
    );
    return;
  }

  if (wantsEast) {
    gameState.flags.mirrorBeamToNiche = true;
    gameState.flags.mirrorBeamToDoor = false;
    gameState.flags.mirrorShardAligned = false;

    logSystem(
      "You angle a trio of panels until the beam spears away to the east, threading through a gap toward the niche chamber."
    );
    return;
  }

  if (wantsDoor) {
    gameState.flags.mirrorBeamToDoor = true;
    gameState.flags.mirrorBeamToNiche = false;
    gameState.flags.mirrorShardAligned = true;

    logSystem(
      "Careful adjustments bring the beam around in a broken arc—panel to panel—until it slips out of the gallery at a shallow, southward angle toward the carved door."
    );
    return;
  }
}

// Ring command – mostly for the bell
function handleRing(rawArgs, { inCombat = false } = {}) {
  const arg = (rawArgs || "").trim().toLowerCase();
  if (!arg || arg === "bell") {
    if (gameState.location === "fallen_guard_post") {
      if (inCombat) {
        logSystem("You have no spare breath to waste on that bell.");
        return;
      }
      triggerBellRing();
      return;
    }
    logSystem("You look around for something worth ringing. Nothing here seems eager to answer.");
    return;
  }

  if (arg.includes("bell")) {
    if (gameState.location === "fallen_guard_post") {
      if (inCombat) {
        logSystem("You have no spare breath to waste on that bell.");
        return;
      }
      triggerBellRing();
      return;
    }
    logSystem("There’s no bell here to ring.");
    return;
  }

  logSystem("You don't find anything that wants to be rung.");
}

function handleSearch() {
  if (gameState.combat.inCombat) {
    logSystem("You don't have time to rummage around while something is trying to kill you.");
    return;
  }

  const loc = gameState.location;

  if (loc === "broken_barracks") {
    runBarracksSearchTrapAndLoot();
    return;
  }

  if (loc === "gnawed_storeroom") {
    if (!gameState.flags.gnawedStoreroomTrapDone) {
      logSystem(
        "The piles of bones and torn sacks look like a bad place to stick your hands until you're ready for whatever wakes up."
      );
    } else if (!gameState.flags.gotStoreroomBuckler) {
      maybeGrantStoreroomBuckler();
    } else {
      logSystem(
        "You sift through the bones again but come up with nothing new—just more brittle remains."
      );
    }
    return;
  }

  if (loc === "fallen_guard_post") {
    logSystem(
      "You pick over the overturned table and fallen spears. Anything worth keeping is either already on you or long gone."
    );
    return;
  }

  if (loc === "lantern_muster_hall") {
    logSystem(
      "You trace the edges of the cracked floor-map and check behind the tattered banners, but nothing new offers itself up—at least not yet."
    );
    return;
  }

  if (loc === "armory_of_dust") {
    runArmoryTrapAndLoot();
    return;
  }

  if (loc === "hidden_shrine_flame") {
    logSystem(
      "You circle the small chamber, checking behind the statue and along the curved walls. There’s nothing else hidden here—the Knight and its flame are the point."
    );
    return;
  }

  if (loc === "watch_balcony") {
    runWatchBalconyTrap();
    return;
  }

  logSystem("You take a moment to search, but nothing new turns up.");
}

function describeLocation() {
  const loc = locations[gameState.location];
  if (!loc) {
    logSystem("You are... nowhere? (Invalid location)");
    return;
  }
  logSystem(`${loc.name}\n${loc.description}`);

  // landing loot
  if (gameState.location === "cracked_landing") {
    maybeGrantLanternBadge();
  }

  // vestibule loot
  if (
    gameState.location === "rat_gnawed_vestibule" &&
    !gameState.combat.inCombat
  ) {
    maybeGrantVestibuleLoot();
  }

  // storeroom loot
  if (
    gameState.location === "gnawed_storeroom" &&
    !gameState.combat.inCombat
  ) {
    maybeGrantStoreroomBuckler();
  }

  // Flicker Node
  if (
    gameState.location === "flicker_node" &&
    !gameState.combat.inCombat
  ) {
    maybeGrantFlickerNodeLoot();

    if (gameState.flags.flickerShardAligned) {
      logSystem(
        "The inset lantern hums faintly, a hairline beam of light carving north through the dust toward the mirror-lined hall."
      );
    } else if (playerHasLanternShard()) {
      logSystem(
        "On the lantern’s base, a tiny inscription reads: “Light must travel.” The empty prismatic socket looks uncomfortably close to the shard you’re carrying."
      );
    } else {
      logSystem(
        "The lantern’s inscription—“Light must travel.”—sits beneath an empty prismatic socket. Whatever once lived there is long gone."
      );
    }
  }

  // Mirror Gallery
  if (gameState.location === "mirror_gallery") {
    if (!gameState.flags.mirrorGalleryHintShown) {
      gameState.flags.mirrorGalleryHintShown = true;
      logSystem(
        "A few of the taller panels still pivot. You could 'adjust mirrors east' to send a beam into the niche, or 'adjust mirrors door' to bend it back toward the gate."
      );
    }

    const hasBeam = !!gameState.flags.flickerShardAligned;

    if (!hasBeam) {
      logSystem(
        "Without a source of light, the mirrors show nothing but dust and fractured reflections."
      );
    } else if (gameState.flags.mirrorBeamToNiche) {
      logSystem(
        "A thin thread of light slips in from the south and jumps panel to panel before knifing off to the east."
      );
    } else if (gameState.flags.mirrorBeamToDoor) {
      logSystem(
        "The incoming beam fractures and reforms across several panels, then slides out of the gallery at a shallow, southward angle."
      );
    } else {
      logSystem(
        "A restless line of light jitters from crack to crack, never quite settling on any single path."
      );
    }
  }

  // Shard Niche
  if (gameState.location === "shard_niche" && !gameState.combat.inCombat) {
    maybeGrantShardNicheShard();

    const hasIncoming =
      !!gameState.flags.flickerShardAligned &&
      !!gameState.flags.mirrorBeamToNiche;
    const shardSeated = !!gameState.flags.deepNodeShardAligned;

    if (!hasIncoming && !shardSeated) {
      logSystem(
        "The lantern fixture sits dark, socket empty, as if waiting for the first taste of light before it decides what to do."
      );
    } else if (!hasIncoming && shardSeated) {
      logSystem(
        "The seated shard glows faintly, fractures ready to catch any beam that finally finds its way here."
      );
    } else if (hasIncoming && !shardSeated) {
      logSystem(
        "A faint beam from the gallery sneaks in along the west wall, grazing the empty socket without quite catching."
      );
    } else if (hasIncoming && shardSeated) {
      logSystem(
        "Light threads into the seated shard and splits along its scars: one thin beam knifes back toward the mirrors, the other dives through the stone toward the heavy door to the south."
      );
    }
  }

  // Door of Failed Light – status
  if (gameState.location === "door_failed_light") {
    const beam7 = !!gameState.flags.flickerShardAligned;
    const beam9 = !!gameState.flags.mirrorShardAligned;
    const beam10 = !!gameState.flags.deepNodeShardAligned;
    const lit = (beam7 ? 1 : 0) + (beam9 ? 1 : 0) + (beam10 ? 1 : 0);

    if (lit === 0) {
      logSystem(
        "All three crystal sockets sit dull and blind. Whatever mechanism once listened for light here is deaf to you."
      );
    } else if (lit === 1) {
      logSystem(
        "One of the sockets holds the faintest glow, like embers buried in ash. The other two remain dark."
      );
    } else if (lit === 2) {
      logSystem(
        "Two sockets answer with a weak internal glimmer, lines in the stone pulsing faintly before fading. The third stays stubbornly dead."
      );
    } else {
      logSystem(
        "All three sockets throb with trapped radiance, but the stone door still feels like a clenched jaw. Whatever comes next hasn't been written yet."
      );
    }
  }

  // Fallen Guard Post loot
  if (
    gameState.location === "fallen_guard_post" &&
    !gameState.combat.inCombat
  ) {
    maybeGrantGuardPostLoot();

    if (!gameState.flags.guardPostBellRung) {
      logSystem(
        "The cracked bell hangs just high enough to make you think about jumping for it. Nothing here looks like it would thank you for the noise."
      );
    } else {
      logSystem(
        "The bell sways slightly on its damaged bracket, stilling with a faint metallic creak."
      );
    }
  }

  // Broken Barracks – auto-start fight on first entry
  if (
    gameState.location === "broken_barracks" &&
    !gameState.combat.inCombat &&
    !gameState.flags.barracksFightCleared
  ) {
    startBarracksFight();
  }

  // Lantern Muster Hall – auto-start Hollow Lantern-Bearer + lore hint
  if (
    gameState.location === "lantern_muster_hall" &&
    !gameState.combat.inCombat
  ) {
    if (!gameState.flags.lanternMusterMapHintShown) {
      gameState.flags.lanternMusterMapHintShown = true;
      logSystem(
        "You follow the cracks in the floor-map with your boot. Three descending rings are carved there, each labeled in a tongue you only half-recognize."
      );
      logSystem(
        "Along one shattered edge, a chipped inscription remains: “THREE RINGS BELOW—AND MORE BENEATH THAT.”"
      );
    }

    if (!gameState.flags.lanternMusterFightCleared) {
      startLanternMusterFight();
    }
  }

  // Armory of Dust – note secret if revealed
  if (gameState.location === "armory_of_dust") {
    if (gameState.flags.armorySecretRevealed) {
      logSystem(
        "Between two sagging racks on the eastern side, a low, dark gap waits where stone has crumbled away—a crawlspace, if you’re willing to scrape your shoulders."
      );
    } else {
      logSystem(
        "Most of the racks lean inward, closing the room in around you. Any secrets here are still buried under rust and splinters."
      );
    }
  }

  // Watch Balcony lore
  if (gameState.location === "watch_balcony") {
    if (!gameState.flags.watchBalconyLoreShown) {
      gameState.flags.watchBalconyLoreShown = true;
      logSystem(
        "On the parapet, half-obscured by hairline cracks, someone carved a line in cramped, deliberate strokes:"
      );
      logSystem(
        "“THEY WILL CLIMB AFTER US. WE MUST BREAK THE WAY BACK.”"
      );
    }
    logSystem(
      "The stone beneath your boots feels tired and untrustworthy; leaning too far out over the hollow would be a bad way to test your luck."
    );
  }

  // Hidden Shrine to the Flame – hint and blessing state
  if (gameState.location === "hidden_shrine_flame") {
    const hasShard = playerHasLanternShard();
    const blessed = !!gameState.flags.shrineBlessingGranted;
    const active = !!gameState.flags.shrineBlessingActive;

    if (!blessed) {
      if (hasShard) {
        logSystem(
          "The Knight’s outstretched hand is worn smooth in the palm, as if it has held something sharp and prismatic a thousand times. The crystal flame leans toward whatever you’re carrying."
        );
        logSystem(
          "(You could try 'use shard' or 'use crystal' here.)"
        );
      } else {
        logSystem(
          "The Knight’s open hand is empty, fingers curled as if expecting a weight that never arrived. The crystal flame burns patiently, waiting."
        );
      }
    } else if (active) {
      logSystem(
        "The crystal flame burns with a quiet intensity that never quite fades. You can feel a thin thread of its heat coiled somewhere behind your heart, ready to jerk you back from the edge once."
      );
    } else {
      logSystem(
        "The crystal flame is smaller now, burned down to a steady ember. Its warmth has already paid out its debt to you."
      );
    }
  }

  // Upper Cistern Walk – small note
  if (gameState.location === "upper_cistern_walk") {
    logSystem(
      "The ledge here narrows to the width of your boots. You get the sense the Dawnspire's cisterns go much deeper than this, when the rest of it remembers how to be real."
    );
  }

  printExitsForLocation(gameState.location);

  if (!gameState.combat.inCombat) {
    maybeTriggerBellAmbush();
  }
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

  const grouped = new Map();

  for (const item of gameState.inventory) {
    const key = item.id || item.name;
    if (!grouped.has(key)) {
      grouped.set(key, { item, count: 0 });
    }
    grouped.get(key).count++;
  }

  const lines = [];
  let index = 1;

  for (const { item, count } of grouped.values()) {
    const label = count > 1 ? `${item.name} (${count})` : item.name;
    lines.push(`${index}. ${label}`);
    index++;
  }

  logSystem("You are carrying:\n" + lines.join("\n"));
}

// =========================
// Combat system
// =========================

const enemyTemplates = {
  dawnspire_rat: {
    id: "dawnspire_rat",
    name: "Starved Tunnel-Rat",
    type: "beast",
    maxHp: 8,
    atkMin: 1,
    atkMax: 3,
    xpReward: 12,
    description:
      "A hairless, skeletal rat drags itself into view, its skin stretched thin over jutting bones and teeth clicking in a hungry rhythm.",
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
    description:
      "The corpse wears the ragged remains of a garrison tabard. Skin clings tight to bone, eyes sunken to dark pits that still somehow track your movements.",
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
    description:
      "Half-rotted plate armor hangs from a frame of desiccated sinew and bone. In one hand it clutches a cracked crystal lantern that burns with a cold, steady glow; the other drags a notched halberd that scrapes sparks from the stone. Where its eyes should be, two pinpricks of lantern-light burn in patient, hateful circles.",
  },
};

const enemyIntents = {
  beast: [
    {
      key: "quick",
      damageMult: 1.0,
      blockMult: 0.6,
      tell:
        "The {name} drops low, muscles quivering, ready to snap forward in a fast lunge.",
    },
    {
      key: "heavy",
      damageMult: 1.8,
      blockMult: 0.3,
      tell:
        "The {name} rears back, whole body coiling for a bone-cracking slam.",
    },
    {
      key: "worry",
      damageMult: 1.3,
      blockMult: 0.4,
      tell:
        "The {name} paces in a tight circle, teeth chattering, looking for something to latch onto.",
    },
  ],
  humanoid: [
    {
      key: "cut",
      damageMult: 1.2,
      blockMult: 0.5,
      tell:
        "The {name} raises its weapon in a stiff, deliberate arc, aiming for exposed flesh.",
    },
    {
      key: "thrust",
      damageMult: 1.5,
      blockMult: 0.4,
      tell:
        "The {name} shifts its weight and draws back for a straight, killing thrust.",
    },
    {
      key: "flail",
      damageMult: 1.0,
      blockMult: 0.6,
      tell:
        "The {name}'s movements turn jerky and wild, weapon swinging in erratic sweeps.",
    },
  ],
};

function chooseEnemyIntent(enemy) {
  const type = enemy.type || "beast";
  const pool = enemyIntents[type] || enemyIntents.beast;
  return pool[roll(0, pool.length - 1)];
}

function telegraphEnemyIntent(enemy, intent) {
  if (!intent) return;
  const line = intent.tell.replace("{name}", enemy.name);
  logSystem(line);
}

function createEnemyInstance(enemyId) {
  const tmpl = enemyTemplates[enemyId];
  if (!tmpl) return null;
  return {
    id: tmpl.id,
    name: tmpl.name,
    type: tmpl.type || "beast",
    maxHp: tmpl.maxHp,
    hp: tmpl.maxHp,
    atkMin: tmpl.atkMin,
    atkMax: tmpl.atkMax,
    xpReward: tmpl.xpReward,
    description: tmpl.description,
    isUndead: !!tmpl.isUndead,
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
  gameState.combat.intent = null;

  const intro = [
    "The air tightens; the space around you suddenly feels too small.",
    `${enemy.name} drags itself out of the dark, intent fixed entirely on you.`,
    "",
    enemy.description,
    "",
    "Type 'attack' to stand your ground, 'block' to brace, or 'run' if your courage falters.",
  ].join("\n");

  logSystem(intro);

  gameState.combat.intent = chooseEnemyIntent(enemy);
  telegraphEnemyIntent(enemy, gameState.combat.intent);
}

function endCombat() {
  gameState.combat.inCombat = false;
  gameState.combat.enemy = null;
  gameState.combat.previousLocation = null;
  gameState.combat.intent = null;
}

function handlePlayerDeath() {
  const deathDescriptions = [
    "Your legs buckle. The world tilts. Warm blood pools beneath you as the cold earth drinks the last of your strength.",
    "You collapse, vision swimming. Your breath rattles in your chest before fading into the dark.",
  ];

  logSystem(pickLine(deathDescriptions));
  logSystem("Death claims you brutally in the dark halls of the Dawnspire...");
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

function enemyTurn(blocking = false) {
  const enemy = gameState.combat.enemy;
  if (!enemy) return;

  const enemyType = enemy.type || "beast";

  let intent = gameState.combat.intent;
  if (!intent) {
    intent = chooseEnemyIntent(enemy);
    gameState.combat.intent = intent;
  }

  const enemyCritChance = 15;
  const enemyCrit = roll(1, 100) <= enemyCritChance;

  let enemyDmg = roll(enemy.atkMin, enemy.atkMax);
  enemyDmg = Math.max(1, Math.round(enemyDmg * (intent.damageMult || 1)));

  if (enemyCrit) {
    enemyDmg *= 2;
  }

  if (blocking) {
    const blockMult = intent.blockMult != null ? intent.blockMult : 0.4;
    enemyDmg = Math.floor(enemyDmg * blockMult);
  }

  // Buckler bonus vs beasts while blocking
  if (blocking && enemyType === "beast" && enemyDmg > 0) {
    ensureEquipment();
    const hasBuckler =
      gameState.player.equipment.shieldId === "rust-buckler";
    if (hasBuckler) {
      enemyDmg = Math.max(0, enemyDmg - 1);
    }
  }

  // Old Guard Spear passive reach block: -1 damage to any hit when equipped
  const weapon = getEquippedWeapon();
  const hasSpear = weapon && weapon.id === "old-guard-spear";
  if (enemyDmg > 0 && hasSpear) {
    enemyDmg = Math.max(0, enemyDmg - 1);
  }

  const enemyBucket = enemyCrit
    ? (combatFlavor.enemy.crit[enemyType] ||
        combatFlavor.enemy.crit.beast)
    : (combatFlavor.enemy.normal[enemyType] ||
        combatFlavor.enemy.normal.beast);

  const enemyLine = pickLine(enemyBucket).replace("{name}", enemy.name);

  if (enemyDmg > 0) {
    if (blocking) {
      logSystem(
        `${enemyLine} (${enemyDmg} damage makes it through your guard.)`
      );
    } else {
      logSystem(`${enemyLine} (${enemyDmg} damage)`);
    }

    gameState.player.hp -= enemyDmg;

    if (gameState.player.hp <= 0) {
      // Check for shrine blessing (combat only)
      if (gameState.flags && gameState.flags.shrineBlessingActive) {
        gameState.flags.shrineBlessingActive = false;
        gameState.player.hp = 1;
        updateStatusBar();
        logSystem(
          "For a heartbeat everything goes white-hot. When the world snaps back into place, you’re still on your feet—barely. The crystal flame’s blessing gutters out inside you."
        );
      } else {
        gameState.player.hp = 0;
        updateStatusBar();
        handlePlayerDeath();
        return;
      }
    }

    updateStatusBar();
    logSystem(
      `Blood slicks your skin. HP: ${gameState.player.hp}/${gameState.player.maxHp}.`
    );
  } else if (blocking) {
    logSystem(
      "You brace and the blow glances off your guard, leaving only numb arms and a ringing in your bones."
    );
  } else {
    logSystem("The enemy's wild motion fails to find flesh this time.");
  }

  gameState.combat.intent = chooseEnemyIntent(enemy);
  telegraphEnemyIntent(enemy, gameState.combat.intent);
}

function handleAttack() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing here to attack.");
    return;
  }

  const enemy = gameState.combat.enemy;
  const enemyType = enemy.type || "beast";

  const weapon = getEquippedWeapon();
  const weaponAtk = weapon ? weapon.atk : 0;

  const critChance = 20;
  const isCrit = roll(1, 100) <= critChance;

  let dmg = roll(1 + weaponAtk, 4 + weaponAtk);
  if (isCrit) {
    dmg = dmg * 2 + 1;
  }

  // Flame-Touched Charm: light burst on crits
  const hasCharm = gameState.inventory.some(
    (item) => item && item.id === "flame-touched-charm"
  );
  if (isCrit && hasCharm) {
    const bonus = enemy.isUndead ? 3 : 2;
    dmg += bonus;
    logSystem(
      "The Flame-Touched Charm at your throat flares, pouring a lance of pale fire down your arm and into the strike."
    );
  }

  enemy.hp -= dmg;

  const playerBucket = isCrit
    ? (combatFlavor.player.crit[enemyType] ||
        combatFlavor.player.crit.beast)
    : (combatFlavor.player.normal[enemyType] ||
        combatFlavor.player.normal.beast);

  const playerLine = pickLine(playerBucket).replace("{name}", enemy.name);
  logSystem(`${playerLine} (${dmg} damage)`);

  if (enemy.hp <= 0) {
    const deathLines = [
      `The ${enemy.name} hits the ground in a broken heap.`,
      `The ${enemy.name} twitches once, then lies still.`,
    ];
    logSystem(pickLine(deathLines));
    const xp = enemy.xpReward || 0;
    if (xp > 0) gainXp(xp);

    // Multi-rat fight in Vestibule
    if (
      gameState.location === "rat_gnawed_vestibule" &&
      gameState.flags &&
      gameState.flags.vestibuleRatsRemaining &&
      gameState.flags.vestibuleRatsRemaining > 1
    ) {
      gameState.flags.vestibuleRatsRemaining--;

      const newEnemy = createEnemyInstance("dawnspire_rat");
      gameState.combat.enemy = newEnemy;
      gameState.combat.intent = null;

      logSystem(
        "Something else skitters in the gnawed stone. Another tunnel-rat claws its way out of a hole, drawn by the blood."
      );

      gameState.combat.intent = chooseEnemyIntent(newEnemy);
      telegraphEnemyIntent(newEnemy, gameState.combat.intent);
      return;
    }

    if (gameState.location === "rat_gnawed_vestibule") {
      gameState.flags.vestibuleCombatDone = true;
    }

    // Multi-soldier fight in Broken Barracks
    if (
      gameState.location === "broken_barracks" &&
      gameState.flags &&
      gameState.flags.barracksSoldiersRemaining &&
      gameState.flags.barracksSoldiersRemaining > 1
    ) {
      gameState.flags.barracksSoldiersRemaining--;

      const newEnemy = createEnemyInstance("desiccated_soldier");
      gameState.combat.enemy = newEnemy;
      gameState.combat.intent = null;

      logSystem(
        "Another desiccated soldier hauls itself upright from a nearby bunk, jaw hanging open in a soundless shout."
      );

      gameState.combat.intent = chooseEnemyIntent(newEnemy);
      telegraphEnemyIntent(newEnemy, gameState.combat.intent);
      return;
    }

    if (gameState.location === "broken_barracks") {
      gameState.flags.barracksFightCleared = true;
    }

    // Lantern Muster Hall – Hollow Lantern-Bearer cleared
    if (gameState.location === "lantern_muster_hall") {
      gameState.flags.lanternMusterFightCleared = true;
    }

    endCombat();
    return;
  }

  enemyTurn(false);
}

function handleRun() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing to run from right now.");
    return;
  }

  const successRoll = roll(1, 100);
  if (successRoll <= 60) {
    const prev = gameState.combat.previousLocation || "dark_forest_edge";
    logSystem("You turn and bolt, scrambling away from the fight!");
    endCombat();
    gameState.location = prev;
    describeLocation();
  } else {
    logSystem("You try to flee, but the enemy cuts you off!");
    enemyTurn(false);
  }
}

function handleBlock() {
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("You raise your guard against nothing but your own nerves.");
    return;
  }

  logSystem("You tighten your stance, weapon raised, bracing for whatever comes next.");
  enemyTurn(true);
}

// =========================
// Rest system
// =========================

function handleRest() {
  if (gameState.combat.inCombat) {
    logSystem("You can't rest while something is trying to tear you apart.");
    return;
  }

  const p = gameState.player;

  if (p.hp >= p.maxHp) {
    logSystem("You're already as patched up as you're going to get.");
    return;
  }

  const hadRation = consumeItemByType("ration");
  if (!hadRation) {
    logSystem("You rummage through your pack, but there's nothing left to eat.");
    return;
  }

  p.hp = p.maxHp;
  updateStatusBar();

  const restLines = [
    "You find a patch of ground that isn't completely soaked or sharp, chew through a tasteless ration, and breathe until the shaking slows.",
    "You sit with your back to cold stone, chew down a ration that tastes of dust and salt, and let time drag past in the dark.",
  ];

  logSystem(pickLine(restLines));
  logSystem(`HP fully restored: ${p.hp}/${p.maxHp}.`);
}

// =========================
// Movement
// =========================

function handleGo(direction) {
  if (gameState.combat.inCombat) {
    logSystem(
      "You're a little busy not dying right now. Try 'attack', 'block', or 'run'."
    );
    return;
  }

  const loc = gameState.location;
  const stairsCollapsed = !!gameState.flags.stairsCollapsed;

  // village <-> forest
  if (loc === "village_square" && direction === "north") {
    gameState.location = "dark_forest_edge";
    logSystem("You walk north, leaving the safety of Briar's Edge behind...");
    describeLocation();
    gainXp(5);
    return;
  }

  if (loc === "dark_forest_edge" && direction === "south") {
    gameState.location = "village_square";
    logSystem("You walk back south, returning to the village square.");
    describeLocation();
    return;
  }

  // forest -> surface ring
  if (loc === "dark_forest_edge" && direction === "north") {
    const fromLocation = gameState.location;

    gameState.location = "dungeon_entrance";
    logSystem(
      "You follow the path to the quake-torn clearing. The broken stone ring looms ahead..."
    );
    describeLocation();

    if (!gameState.flags.firstDungeonFightDone) {
      gameState.flags.firstDungeonFightDone = true;
      gameState.combat.previousLocation = fromLocation;
      startCombat("dawnspire_rat");
    }
    return;
  }

  // surface ring -> forest
  if (loc === "dungeon_entrance" && direction === "south") {
    if (stairsCollapsed) {
      reportStairsCollapsed();
      return;
    }
    gameState.location = "dark_forest_edge";
    logSystem("You climb back up out of the broken ring and return to the forest edge.");
    describeLocation();
    return;
  }

  // surface ring -> Room 1
  if (loc === "dungeon_entrance" && direction === "down") {
    if (stairsCollapsed) {
      reportStairsCollapsed();
      return;
    }
    gameState.location = "broken_ring_descent";
    logSystem("You step onto the worn stone steps and begin the descent into the Dawnspire.");
    describeLocation();
    return;
  }

  // Room 1 -> surface
  if (loc === "broken_ring_descent" && direction === "up") {
    if (stairsCollapsed) {
      reportStairsCollapsed();
      return;
    }
    gameState.location = "dungeon_entrance";
    logSystem("You climb back toward the broken ring, each step heavier than the last.");
    describeLocation();
    return;
  }

  // Room 1 -> Room 2
  if (loc === "broken_ring_descent" && direction === "down") {
    gameState.location = "cracked_landing";
    logSystem(
      "You descend further until the stairwell opens into a small, fractured ledge."
    );
    describeLocation();
    return;
  }

  // Room 2
  if (loc === "cracked_landing") {
    if (direction === "up") {
      if (stairsCollapsed) {
        reportStairsCollapsed();
        return;
      } else {
        gameState.location = "broken_ring_descent";
        logSystem("You climb back up the spiral toward the faint memory of light above.");
        describeLocation();
        return;
      }
    }

    if (direction === "down" || direction === "forward") {
      const firstTimeLeavingDeeper = !stairsCollapsed;

      gameState.location = "collapsed_stairwell";

      if (firstTimeLeavingDeeper) {
        gameState.flags.stairsCollapsed = true;
        logSystem(
          "As you step off the landing, a deep groan rolls through the stone. The stairwell shudders violently."
        );
        logSystem(
          "Above, blocks crash down, choking the upper stair in dust and rubble."
        );
        reportStairsCollapsed();
      }

      describeLocation();
      return;
    }
  }

  // Room 3
  if (loc === "collapsed_stairwell") {
    if (direction === "up") {
      gameState.location = "cracked_landing";
      logSystem(
        "You climb back up to the cracked landing, dust sifting down from the ruined stair above."
      );
      describeLocation();
      return;
    }

    if (direction === "down" || direction === "forward") {
      const alive = runCollapsedStairTrap();
      if (!alive) return;

      gameState.location = "rat_gnawed_vestibule";
      logSystem(
        "Shaking the last of the dust from your shoulders, you push deeper down the warped stair into the gnawed stone ahead."
      );
      describeLocation();

      if (!gameState.flags.firstVestibuleVisit) {
        startVestibuleFight();
      }

      return;
    }
  }

  // Room 4
  if (loc === "rat_gnawed_vestibule") {
    if (direction === "west" || direction === "back") {
      gameState.location = "collapsed_stairwell";
      logSystem(
        "You edge back toward the twisted stair, leaving the chewed tunnels behind."
      );
      describeLocation();
      return;
    }

    if (direction === "east") {
      gameState.location = "gnawed_storeroom";
      logSystem(
        "You push through a low, tooth-scored arch into a cramped side chamber."
      );
      const alive = runGnawedStoreroomTrap();
      if (!alive) return;
      describeLocation();
      return;
    }

    if (direction === "north") {
      gameState.location = "outer_hall_lanterns";
      logSystem(
        "You follow a tunnel that climbs and straightens, the gnawed stone giving way to a long hall of dead lantern brackets."
      );
      describeLocation();

      if (!gameState.flags.outerHallFirstCheck) {
        gameState.flags.outerHallFirstCheck = true;
        const spawn = roll(1, 100) <= 60;
        if (spawn) {
          gameState.combat.previousLocation = "rat_gnawed_vestibule";
          logSystem(
            "From behind a cracked lantern base, something hairless and starving peels itself off the stone."
          );
          startCombat("dawnspire_rat");
        } else {
          logSystem(
            "For once, nothing immediately slinks out of the dark to meet you. The hall only watches, empty and patient."
          );
        }
      }

      return;
    }
  }

  // Room 5
  if (loc === "gnawed_storeroom") {
    if (direction === "west" || direction === "back") {
      gameState.location = "rat_gnawed_vestibule";
      logSystem(
        "You pick your way back through the low arch, leaving the bone-littered storeroom behind."
      );
      describeLocation();
      return;
    }
  }

  // Room 6
  if (loc === "outer_hall_lanterns") {
    if (direction === "south") {
      gameState.location = "rat_gnawed_vestibule";
      logSystem(
        "You retrace your steps, letting the dead lanterns fade behind as you slip back toward the gnawed vestibule."
      );
      describeLocation();
      return;
    }

    if (direction === "east") {
      gameState.location = "flicker_node";
      logSystem(
        "You follow the faint sense of tension in the stone until the hall cinches down around a single intact lantern."
      );
      describeLocation();
      return;
    }

    if (direction === "north") {
      gameState.location = "door_failed_light";
      logSystem(
        "You move north until the hall ends in a heavy stone door carved with a fractured sunburst and three dead crystal sockets."
      );
      describeLocation();
      return;
    }
  }

  // Room 7
  if (loc === "flicker_node") {
    if (direction === "west" || direction === "back") {
      gameState.location = "outer_hall_lanterns";
      logSystem(
        "You back out of the cramped junction, letting the single lantern slip from view as the longer hall opens again."
      );
      describeLocation();
      return;
    }

    if (direction === "north") {
      gameState.location = "mirror_gallery";
      logSystem(
        "You move north, following where the lantern’s cracked mirror panel points. The stone opens into a hall lined with tall, damaged mirrors."
      );
      describeLocation();
      return;
    }
  }

  // Room 8
  if (loc === "door_failed_light") {
    if (direction === "south" || direction === "back") {
      gameState.location = "outer_hall_lanterns";
      logSystem(
        "You step back from the carved sunburst, letting the weight of the sealed door fall behind you."
      );
      describeLocation();
      return;
    }

    if (direction === "north" || direction === "forward") {
      const beam7 = !!gameState.flags.flickerShardAligned;
      const beam9 = !!gameState.flags.mirrorShardAligned;
      const beam10 = !!gameState.flags.deepNodeShardAligned;
      const lit = (beam7 ? 1 : 0) + (beam9 ? 1 : 0) + (beam10 ? 1 : 0);

      if (lit === 0) {
        logSystem(
          "You press your weight against the stone. It doesn't so much as shiver. With all three sockets blind, there's nothing here for the door to listen to."
        );
      } else if (lit === 1) {
        logSystem(
          "As you strain against the door, one socket gives off the faintest warmth. Lines in the stone glow dull red before fading. Not enough."
        );
      } else if (lit === 2) {
        logSystem(
          "Two sockets flare weakly, light crawling along carved channels. Something shifts deep within—and then locks again. The third socket stays dead."
        );
      } else {
        logSystem(
          "All three sockets blaze with buried light. The sunburst seems to swell, rays sharpening, but for now the door remains a promise instead of a path."
        );
      }
      return;
    }
  }

  // Room 9
  if (loc === "mirror_gallery") {
    if (direction === "south" || direction === "back") {
      gameState.location = "flicker_node";
      logSystem(
        "You step back out of the broken reflections and return to the tight junction where the beam begins."
      );
      describeLocation();
      return;
    }

    if (direction === "east") {
      gameState.location = "shard_niche";
      logSystem(
        "You follow the eastward corridor as it tightens, stone smoothing under your fingertips until it spills you into a small circular niche around a single pedestal."
      );
      describeLocation();
      return;
    }
  }

  // Room 10
  if (loc === "shard_niche") {
    if (direction === "west" || direction === "back") {
      gameState.location = "mirror_gallery";
      logSystem(
        "You leave the little circle of stone and its waiting pedestal behind, slipping back toward the hall of mirrors."
      );
      describeLocation();
      return;
    }

    if (direction === "north") {
      gameState.location = "fallen_guard_post";
      logSystem(
        "You take the short northern passage into a low room that still smells faintly of drill and duty."
      );
      describeLocation();
      return;
    }
  }

  // Room 11
  if (loc === "fallen_guard_post") {
    if (direction === "south" || direction === "back") {
      gameState.location = "shard_niche";
      logSystem(
        "You step away from the overturned table and the hanging bell, slipping back toward the shard-lit niche."
      );
      describeLocation();
      return;
    }

    if (direction === "east") {
      gameState.location = "broken_barracks";
      logSystem(
        "You pick your way past the scattered spears and push through a narrow doorway into a longer chamber lined with ruined bunks."
      );
      describeLocation();
      return;
    }
  }

  // Room 12
  if (loc === "broken_barracks") {
    if (direction === "west" || direction === "back") {
      gameState.location = "fallen_guard_post";
      logSystem(
        "You leave the broken bunks behind and step back into the cramped guard post and its cracked bell."
      );
      describeLocation();
      return;
    }

    if (direction === "north") {
      gameState.location = "lantern_muster_hall";
      logSystem(
        "You move past the last line of ruined bunks into a broader chamber hung with tattered banners."
      );
      describeLocation();
      return;
    }
  }

  // Room 13
  if (loc === "lantern_muster_hall") {
    if (direction === "south" || direction === "back") {
      gameState.location = "broken_barracks";
      logSystem(
        "You step away from the cracked floor-map and faded banners, returning to the broken barracks."
      );
      describeLocation();
      return;
    }

    if (direction === "east") {
      gameState.location = "armory_of_dust";
      logSystem(
        "You push through a squat doorway flanked by empty weapon racks into a lower, dust-choked chamber of rust and ruin."
      );
      describeLocation();
      return;
    }

    if (direction === "north") {
      gameState.location = "watch_balcony";
      logSystem(
        "You climb a narrow stair that hugs the wall, emerging onto a stone balcony that hangs over a gulf of darkness."
      );
      describeLocation();
      return;
    }
  }

  // Room 14 – Armory of Dust
  if (loc === "armory_of_dust") {
    if (direction === "west" || direction === "back") {
      gameState.location = "lantern_muster_hall";
      logSystem(
        "You leave the rust-thick air of the armory behind and step back into the banner-hung muster hall."
      );
      describeLocation();
      return;
    }

    if (direction === "east") {
      if (!gameState.flags.armorySecretRevealed) {
        logSystem(
          "You press along the eastern wall, but all you find are solid stone and flakes of ancient rust."
        );
        return;
      }

      gameState.location = "hidden_shrine_flame";
      logSystem(
        "You drop to hands and knees and squeeze through the low gap between collapsed racks, stone scraping your shoulders until the world opens just enough to stand again."
      );
      describeLocation();
      return;
    }
  }

  // Room 15 – Watch Balcony
  if (loc === "watch_balcony") {
    if (direction === "south" || direction === "back") {
      gameState.location = "lantern_muster_hall";
      logSystem(
        "You retreat from the cracked parapet and take the stair back down into the muster hall."
      );
      describeLocation();
      return;
    }

    if (
      direction === "east" ||
      direction === "down" ||
      direction === "forward"
    ) {
      gameState.location = "upper_cistern_walk";
      logSystem(
        "You take the narrow stair that spirals down along the chasm wall, each step damp and slick, until it spills you onto a ledge above the cistern."
      );
      describeLocation();
      return;
    }
  }

  // Room 16 – Hidden Shrine to the Flame
  if (loc === "hidden_shrine_flame") {
    if (direction === "west" || direction === "back") {
      gameState.location = "armory_of_dust";
      logSystem(
        "You duck back into the tight crawlspace, dragging yourself through grit and old ash until the broader shape of the armory opens around you again."
      );
      describeLocation();
      return;
    }
  }

  // Room 18 – Upper Cistern Walk
  if (loc === "upper_cistern_walk") {
    if (
      direction === "west" ||
      direction === "up" ||
      direction === "back"
    ) {
      gameState.location = "watch_balcony";
      logSystem(
        "You edge back along the wet stone ledge and climb the narrow stair, returning to the balcony above the hollow."
      );
      describeLocation();
      return;
    }
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
      "  go <direction>     - move (north, south, east, west, up, down, forward, back)",
      "  name <your name>   - set your name",
      "  attack             - attack the enemy in combat",
      "  block              - brace to blunt the enemy's next attack",
      "  run                - attempt to flee from combat",
      "  rest               - consume a ration to fully restore your HP",
      "  use <item>         - use an item (e.g., 'use bandage', 'use shard', 'use draught', 'use journal')",
      "  equip <item>       - equip a weapon or shield (e.g., 'equip buckler', 'equip spear', 'equip sword')",
      "  adjust <target>    - adjust mechanisms (e.g., 'adjust mirrors east', 'adjust mirrors door')",
      "  ring <thing>       - ring something, where appropriate (e.g., 'ring bell' in the guard post)",
      "  search             - search the area for hidden things (and problems)",
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
    "Briar's Edge is a quiet village on the very edge of the Shaded Frontier, where the empire's maps fade into wilderness.",
    "",
    "You grew up hearing stories of the Lantern Knights, wanderers who carried crystal lanterns into the deep woods to fight back the dark.",
    "",
    "Recently, rumors spread of an ancient ruin unearthed after a quake: a stone ring jutting from the earth, leading down into what people now call the Dawnspire Below.",
    "",
    "Armed with a rust-flecked sword and an oversized pack, you step toward the forest's edge.",
    "",
    "Somewhere far below, something stirs, waiting for you to arrive.",
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
    equipment: {
      weaponId: null,
      shieldId: null,
    },
  };

  gameState.inventory = [
    { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "ration", name: "Travel Ration", type: "ration" },
  ];
  gameState.location = "village_square";
  gameState.flags = {};
  gameState.combat = {
    inCombat: false,
    enemy: null,
    previousLocation: null,
    intent: null,
  };

  updateStatusBar();
  showIntro();
  scheduleSave();
}

// =========================
// Command parser
// =========================

function handleCombatCommand(cmd, raw) {
  switch (cmd) {
    case "attack":
      handleAttack();
      break;
    case "block":
      handleBlock();
      break;
    case "run":
      handleRun();
      break;
    case "use": {
      const argStr = raw.slice(4).trim();
      handleUse(argStr, { inCombat: true });
      break;
    }
    case "ring": {
      const argStr = raw.slice(5).trim();
      handleRing(argStr, { inCombat: true });
      break;
    }
    case "equip":
      logSystem(
        "You don't have time to fumble with gear while something is trying to open you up."
      );
      break;
    case "adjust":
      logSystem("You don't have the luxury of fiddling with mechanisms mid-fight.");
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
    case "rest":
      logSystem("You can't rest while something is trying to rip you open.");
      break;
    case "search":
      logSystem("You can't spare the attention to search right now.");
      break;
    default:
      logSystem(
        "In the heat of battle, that command makes no sense. Try 'attack', 'block', 'run', or 'use bandage'."
      );
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
    handleCombatCommand(cmd, raw);
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
        logSystem("Go where? (north, south, east, west, up, down, forward, back)");
      } else {
        handleGo(rest[0]);
      }
      break;
    case "name":
      handleName(raw.slice(5).trim());
      break;
    case "attack":
      logSystem("There's nothing here to attack.");
      break;
    case "block":
      logSystem("You square your shoulders and raise your guard. Nothing is close enough to hit you. Yet.");
      break;
    case "run":
      logSystem("There's nothing to run from.");
      break;
    case "rest":
      handleRest();
      break;
    case "use":
      handleUse(raw.slice(4).trim(), { inCombat: false });
      break;
    case "equip":
      handleEquip(raw.slice(6).trim());
      break;
    case "adjust":
      handleAdjust(raw.slice(6).trim());
      break;
    case "ring":
      handleRing(raw.slice(5).trim(), { inCombat: false });
      break;
    case "search":
      handleSearch();
      break;
    case "reset":
      handleReset();
      break;
    default:
      logSystem(
        "You mumble, unsure what that means. (Type 'help' for commands.)"
      );
      break;
  }

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
      ensureEquipment();
      logSystem("Welcome back. Your adventure has been restored.");
      if (
        gameState.combat &&
        gameState.combat.inCombat &&
        gameState.combat.enemy
      ) {
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
  ensureEquipment();
  updateStatusBar();

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = inputEl.value;
    inputEl.value = "";
    handleCommand(value);
  });

  loadGameFromServer();
});
