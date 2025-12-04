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
    { id: "ration", name: "Travel Ration", type: "ration" },
    { id: "ration", name: "Travel Ration", type: "ration" },
  ],
  location: "village_square",
  flags: {
    // firstDungeonFightDone: false,
    // stairsCollapsed: false,
    // gotLanternBadge: false,
    // collapsedStairTrapDone: false,
    // firstVestibuleVisit: false,
    // vestibuleRatsRemaining: 0,
    // vestibuleCombatDone: false,
    // gotVestibuleLoot: false,
    // gnawedStoreroomTrapDone: false,
    // gotStoreroomBuckler: false,
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

// =========================
// Combat flavor text
// =========================

const combatFlavor = {
  player: {
    normal: {
      beast: [
        "You hack into the {name}, fur and flesh tearing under your swing.",
        "Your blade bites into the {name}, opening a ragged line of red.",
        "You slam your weapon into the {name}'s side, feeling its body buckle.",
        "You slash across the {name}, scattering dark hair and droplets of blood.",
        "You drive your weapon into the {name}'s shoulder, wrenching it free with effort.",
        "Your strike sends the {name} skidding across the stone, claws scraping for purchase.",
        "You catch the {name} mid-lunge and knock it sideways with a brutal blow.",
        "You stab low, skewering the {name}'s belly before yanking your weapon back."
      ],
      humanoid: [
        "You smash your weapon into the {name}'s ribs, feeling something crack under the impact.",
        "Your swing tears through cloth and flesh as the {name} staggers back, clutching the wound.",
        "You drive your blade into the {name}'s side, hot blood soaking your hands.",
        "Your strike splits skin and muscle; the {name} lets out a sharp, ugly sound.",
        "You catch the {name} off-balance and slam your weapon into their chest.",
        "Your blow crashes against bone; the {name} grunts as the impact steals their breath.",
        "You rake your weapon across the {name}'s arm, leaving a deep, leaking gash.",
        "You ram your shoulder into the {name} as you cut, sending them stumbling through their own blood."
      ],
      caster: [
        "You cut through trailing cloth and flesh as the {name} scrambles to finish a spell.",
        "Your weapon bites into the {name}'s side, scattering ash-stained fabric and blood.",
        "You slam into the {name}, snapping their focus along with something in their chest.",
        "You carve a line across the {name}'s back as they try to retreat, their chant breaking into a scream.",
        "Your strike hammers into the {name}'s ribs, knocking loose a wheezing breath and a spray of red.",
        "You hack through dangling charms and flesh; the {name}'s hands shake, blood dripping from their fingers.",
        "You drive your blade into the {name}'s shoulder; the smell of singed cloth and blood mingles as their spell fizzles out.",
        "Your attack crashes into the {name}'s gut, folding them in half around the wound."
      ]
    },
    crit: {
      beast: [
        "Your swing connects with the {name}'s neck; bone shears and the head lolls at a wrong angle. CRITICAL HIT.",
        "You bring your weapon down and split the {name}'s skull, bone and brain matter cracking open. CRITICAL HIT.",
        "You carve straight through the {name}'s foreleg; it hits the ground shrieking, stump spraying blood. CRITICAL HIT.",
        "Your blade drives into the {name}'s eye and out the other side. It jerks once and hangs limp. CRITICAL HIT.",
        "You slam the {name} into the stone and feel its spine snap under your weight. CRITICAL HIT.",
        "Your strike opens the {name} from jaw to chest; teeth and tongue spill out with gore. CRITICAL HIT.",
        "You crush the {name}'s skull under your boot after the blow lands, bone popping wetly. CRITICAL HIT.",
        "You tear half the {name}'s face away with a brutal swing; it sprays the wall and collapses twitching. CRITICAL HIT."
      ],
      humanoid: [
        "Your weapon caves in the {name}'s skull with a sickening crunch. Blood and bone spray across the stone. CRITICAL HIT.",
        "You drive your blade up beneath the {name}'s jaw and out through an eye. Their body spasms, then slackens. CRITICAL HIT.",
        "Your strike severs the {name}'s arm at the shoulder; it spins away, fingers still clawing at nothing. CRITICAL HIT.",
        "You smash the {name}'s knee sideways, bone tearing through skin as they drop screaming. CRITICAL HIT.",
        "Your blow rips across the {name}'s throat; a hot, pulsing spray coats your hands as their voice gurgles out. CRITICAL HIT.",
        "You ram your weapon deep into the {name}'s chest and feel ribs crack and heart give way. CRITICAL HIT.",
        "Your swing takes half the {name}'s face with it; teeth, blood, and fragments of bone scatter the ground. CRITICAL HIT.",
        "You twist the blade as you pull it from the {name}'s gut, dragging out loops of slick, steaming entrails. CRITICAL HIT."
      ],
      caster: [
        "You drive your weapon straight through the {name}'s chest, snuffing their chant mid-syllable. Blood pours down your hands. CRITICAL HIT.",
        "Your strike shears off the {name}'s casting hand at the wrist; fingers and rings hit the floor in a bloody spray. CRITICAL HIT.",
        "You carve into the {name}'s face, blinding one eye and leaving the other wide and blood-fogged. CRITICAL HIT.",
        "Your swing smashes the {name}'s back; they crumple, blood and grey matter soaking their robes. CRITICAL HIT.",
        "You bury your blade into the {name}'s spine; their legs go slack as they collapse like a cut puppet. CRITICAL HIT.",
        "Your attack opens the {name}'s abdomen; organs bulge and spill as they clutch at themselves in disbelief. CRITICAL HIT.",
        "You slam them against the wall and drive your weapon through their throat, pinning them there as they gurgle out. CRITICAL HIT.",
        "You slice through both of the {name}'s eyes in a single sweep; they scream, stumbling in circles as blood pours down their cheeks. CRITICAL HIT."
      ]
    }
  },

  enemy: {
    normal: {
      beast: [
        "The {name} sinks its teeth into your arm, ripping skin and muscle loose.",
        "The {name} rakes claws across your side, leaving burning furrows of torn flesh.",
        "The {name} slams into your legs, its teeth snapping at exposed skin.",
        "The {name} bites deep into your calf and shakes, tearing a chunk free.",
        "The {name} scrabbles up your body, claws shredding cloth and carving bloody lines.",
        "The {name} latches onto your hand and gnaws until you wrench it free, leaving skin hanging.",
        "The {name} darts in and snaps at your ribs, leaving a deep, purple-tinged bruise that throbs with every breath.",
        "The {name} rips a mouthful of flesh from your forearm, hot blood running to your fingertips."
      ],
      humanoid: [
        "The {name}'s weapon crunches into your ribs, stealing your breath in a flash of pain.",
        "The {name} drives a blade across your chest, cutting a wide bloody groove.",
        "The {name} cracks you across the jaw; you taste iron as blood fills your mouth.",
        "The {name}'s strike sinks into your shoulder, leaving the arm numb and wet with blood.",
        "The {name} slams a boot into your knee, sending agony lancing up your leg.",
        "The {name} drags steel across your back as you move, carving a long, stinging wound.",
        "The {name}'s weapon punches into your gut and rips sideways, leaving warmth spilling down your front.",
        "The {name} hooks your ankle and sends you crashing to the floor, pain jolting through bone."
      ],
      caster: [
        "A jagged bolt of force slams into your chest, leaving your ribs aching and skin mottled purple.",
        "The {name}'s spell burns across your arm, blistering flesh and filling the air with the stink of cooked skin.",
        "Shards of conjured bone tear into your legs, lodging deep and bleeding freely.",
        "A wave of crushing pressure clamps around your skull; blood leaks from your nose and ears.",
        "The {name} hurls a lance of warped light that sears a smoking line through your side.",
        "Your muscles knot and spasm as the {name}'s curse digs into nerves and bone.",
        "Black flame licks over your hands, devouring flesh without heat, leaving charred, cracked skin.",
        "The {name}'s whispered word sends a spike of agony through your spine that leaves you gasping."
      ]
    },
    crit: {
      beast: [
        "The {name} latches onto your throat; teeth punch through flesh before you rip it free in a spray of blood. CRITICAL WOUND.",
        "The {name} tears a mouthful from your face, hot blood pouring into your eye and down your neck. CRITICAL WOUND.",
        "The {name} clamps down on your wrist and shakes until bone cracks and something inside tears. CRITICAL WOUND.",
        "The {name} hits your knee from the side; ligaments snap and you collapse into the dirt. CRITICAL WOUND.",
        "The {name} rips deep into your side and comes away with a chunk of meat; you can feel warmth pouring out. CRITICAL WOUND.",
        "The {name} drives its teeth into your hand and mangles fingers into useless, shattered shapes. CRITICAL WOUND.",
        "The {name} catches your throat with hooked claws, leaving three parallel, pulsing lines that spill red. CRITICAL WOUND.",
        "The {name} bites clean through part of your ear; blood runs hot down your neck as sound rings and swims. CRITICAL WOUND."
      ],
      humanoid: [
        "The {name}'s weapon crushes into your skull; light explodes behind your eyes as blood runs into your vision. CRITICAL WOUND.",
        "The {name} drives steel deep into your chest; your breath comes shallow and wet. CRITICAL WOUND.",
        "The {name} smashes your knee sideways; bone grinds and you nearly go down under your own weight. CRITICAL WOUND.",
        "The {name}'s blade opens your throat in a wide, searing line; you clamp a hand over it on instinct. CRITICAL WOUND.",
        "The {name} drives a weapon into your gut and twists; white-hot pain floods your body. CRITICAL WOUND.",
        "The {name} smashes the back of your head; you see nothing but smeared shapes and swimming light. CRITICAL WOUND.",
        "The {name}'s strike mangles your forearm; bone shows whitely through shredded flesh. CRITICAL WOUND.",
        "The {name} hooks your jaw with their weapon, nearly tearing it loose; teeth scatter across the ground. CRITICAL WOUND."
      ],
      caster: [
        "The {name}'s spell erupts inside your chest; you feel something tear and burn at the same time. CRITICAL WOUND.",
        "A lance of warped light punches through your shoulder, leaving a smoking, ragged hole. CRITICAL WOUND.",
        "The {name} crushes your lungs with invisible force; each breath is a desperate, shallow scrape. CRITICAL WOUND.",
        "Your skin splits in long, bloody lines as the {name}'s curse digs into your nerves and pulls them apart. CRITICAL WOUND.",
        "The {name}'s hex rots flesh along your side in seconds; skin blackens and sloughs away. CRITICAL WOUND.",
        "A blast of concussive force snaps your head back; you hear the crunch of something giving way in your neck. CRITICAL WOUND.",
        "The {name}'s magic blinds one eye; blood and milky fluid leak down your cheek as your vision shrinks. CRITICAL WOUND.",
        "Fire that burns without heat crawls up your arm, eating flesh to bone before guttering out. CRITICAL WOUND."
      ]
    }
  }
};

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
      "You stand in the cramped heart of Briar's Edge, a frontier village nailed together from weather-beaten timber and old promises. A crooked well sits at the center, its stones slick with moss and the stains of years of use. Smoke drifts from low chimneys, carrying the sour smell of thin stew and overboiled vegetables. Faded posters promising fame and fortune at the 'Dawnspire Below' flap weakly on a message board, their edges curled and greasy from too many hopeful hands.",
      "Beyond the last sagging rooftops to the north, the Shaded Frontier begins in a hard, dark line of trees. Behind you, the village pretends not to watch you leave."
    ].join(" "),
  },

  dark_forest_edge: {
    name: "Forest Edge",
    description: [
      "The road from Briar's Edge dissolves into churned mud and exposed roots as the forest takes over, its trees packed tight like the bars of a cage. The air here is colder, heavy with the stink of wet earth, old leaves, and the faint metallic tang of something that bled and never quite washed away. Branches knit overhead, letting in only thin, pale ribbons of light that barely reach the ground.",
      "Every sound seems too loud—your boots in the dirt, your breath, the creak of leather. Somewhere deeper in, something moves just out of sight, and the path north twists into shadow, toward the place the villagers now call the Dawnspire Below. To the south, the village waits like a memory you can still turn back to."
    ].join(" "),
  },

  dungeon_entrance: {
    name: "Dawnspire – Broken Ring",
    description: [
      "The trees fall away into a raw wound in the earth where the ground has split and slumped, exposing a ring of ancient stone half-swallowed by dirt and roots. Weathered pillars lean at sick angles around a central pit where rough steps spiral downward into a throat of cold, unmoving darkness. The air that seeps up from below smells of stale stone, rust, and something older—like the inside of a sealed tomb finally given a mouth.",
      "Faint scratches and boot-scuffs around the lip of the ring speak of others who came here before you. None of their voices carry back up the stairs."
    ].join(" "),
  },

  // Room 1 – Broken Ring Descent
  broken_ring_descent: {
    name: "Dawnspire – Broken Ring Descent",
    description: [
      "The spiral stairs descend from the surface, the world above shrinking to a memory of pale light and wind. The walls here are slick with seepage, veins of moisture running down stone that glistens with a faint, unhealthy sheen. Tufts of strange, faintly glowing lichen cling to the mortar lines, smearing cold light across your boots as you brush past.",
      "Your footsteps echo in the tight shaft, overlapping in a rhythm that sounds almost like someone else is walking just behind you. The air is colder the deeper you go, pressed flat and stale, as if this place has been holding its breath for a very long time."
    ].join(" "),
  },

  // Room 2 – Cracked Landing
  cracked_landing: {
    name: "Dawnspire – Cracked Landing",
    description: [
      "The stairs spill out onto a cramped stone landing, barely wider than your outstretched arms. Chunks of rubble litter the floor, sharp-edged and fresh, as if the stone itself has been flaking away in slow panic.",
      "Looking back up the spiral, you can still see the suggestion of light far above—a thin, pale smear where the surface must be. Each breath down here tastes of grit and dust, and the occasional shudder of stone overhead drops a rain of powder onto your shoulders."
    ].join(" "),
  },

  // Room 3 – Collapsed Stairwell
  collapsed_stairwell: {
    name: "Dawnspire – Collapsed Stairwell",
    description: [
      "The stairwell here buckles and twists around a mound of fallen stone, the once-smooth descent warped by the violence of some old collapse. Dust hangs in the air in slow, lazy spirals, glowing weakly in the lichen-light.",
      "Above, you can just make out where the stair used to continue—a jagged plug of shattered blocks and packed debris. Below, the stairs continue into a deeper dark, the air colder and somehow hungrier the further down you look."
    ].join(" "),
  },

  // Room 4 – Rat-gnawed Vestibule
  rat_gnawed_vestibule: {
    name: "Dawnspire – Rat-gnawed Vestibule",
    description: [
      "The stair spills into a low, wedge-shaped chamber where the stone has been gnawed and worried at the edges, as if a hundred sets of teeth tried to chew their way out of the walls.",
      "Chewed-open tunnels vein the lower masonry. The remains of an old camp slump against one wall—a rotted bedroll fused to the floor with damp and mold, a snapped spear haft pinned beneath it, and the scattered ghosts of a pack long since torn apart."
    ].join(" "),
  },

  // Room 5 – Gnawed Storeroom
  gnawed_storeroom: {
    name: "Dawnspire – Gnawed Storeroom",
    description: [
      "A low arch of bitten stone opens into what was once a storeroom. Shelves have collapsed into rotten heaps, their timbers chewed through and sagging like broken ribs.",
      "Sacks lie torn open across the floor, spilling long-mummified grain and a carpet of small bones. Every step sets something fragile cracking under your boots."
    ].join(" "),
  },
};

// helper: stairs collapse message
function reportStairsCollapsed() {
  logSystem("Stone and dust fill the stairwell above. Whatever daylight once lived up there is gone.");
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
    "Half-buried in the rubble, your fingers close on something cold and worked. You pry free a small metal badge stamped with a stylized lantern—tarnished, but unmistakably deliberate. A Lantern Knight’s badge, abandoned here and left to watch the dark alone."
  );
  logSystem("You take the Lantern Knight’s Badge.");
}

// ===== Trap death helper (for brutal, sudden trap deaths) =====
function handleTrapDeath(trapKey) {
  let lines;
  switch (trapKey) {
    case "collapsed_stair_rock":
      lines = [
        "Stone shears free above you with no warning. Something the size of your chest slams into your skull; there’s a crack, a flash, and then nothing at all.",
        "The stairwell bucks under your feet as a jagged block drops out of the dark. It hits you full in the face; your neck folds sideways and the world cuts to black mid-breath.",
        "You glance up just in time to see the underside of the falling rock. It meets you like a hammer, driving you bonelessly into the shattered steps.",
        "A coffin-sized stone punches through the ceiling and crushes your shoulder and throat in one grinding impact. The rest of you never gets the chance to understand."
      ];
      break;
    case "gnawed_rats":
      lines = [
        "Your boot grinds down into hidden bones. The pile explodes into motion as a hundred tiny bodies erupt up your legs. By the time you remember to scream, your throat is already full of teeth.",
        "The bone-drift blooms outward in a living tide. Tiny claws and needle teeth find every gap in cloth and flesh at once. You go down under them, swallowed in a single, frantic shriek.",
        "The floor flexes with something beneath the bones. Then they burst upward in a writhing wave that knocks you flat. You choke on fur and hot copper as they eat all the soft parts first.",
        "You stagger as the bones shift—and the room erupts. A squealing storm climbs your body, chewing through tendon and throat before your hands can even close around a weapon."
      ];
      break;
    default:
      lines = [
        "Something in the dark moves, and your story ends faster than your mind can catch up.",
        "There’s no warning—just impact, and then the feeling of the world letting go of you."
      ];
      break;
  }

  logSystem(pickLine(lines));
  logSystem("The Dawnspire doesn’t care how you die. It only cares that you stay.");
  handleReset();
}

// helper: Room 3 loose-stone trap
function runCollapsedStairTrap() {
  // Only trigger once
  if (gameState.flags.collapsedStairTrapDone) return true;

  gameState.flags.collapsedStairTrapDone = true;

  logSystem(
    "Your boot rolls on a loose stone. The narrow stair lurches under you as a chunk of the ceiling breaks free."
  );

  const dmg = roll(1, 3); // small chip damage
  const p = gameState.player;

  if (dmg <= 0) {
    logSystem("Dust and pebbles shower over you, but the worst of it misses.");
    return true;
  }

  p.hp -= dmg;

  if (p.hp <= 0) {
    p.hp = 0;
    updateStatusBar();
    // Custom trap death text instead of generic combat death
    handleTrapDeath("collapsed_stair_rock");
    return false; // you died; caller should stop
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
    "Your step sinks into a drift of bones. The whole pile shivers, then erupts as a churning swarm of half-rotten rats pours over your boots."
  );

  const dmg = roll(1, 3); // minor chip damage
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
    "Picking through the shredded bedroll and the ruins of an old pack, you turn up a half-stale travel ration and a strip of dirty bandage stiff with old blood."
  );
  logSystem("You gain: Travel Ration, Dirty Bandage.");
}

// helper: storeroom loot (Rust-Flecked Buckler)
function maybeGrantStoreroomBuckler() {
  if (gameState.flags.gotStoreroomBuckler) return;
  if (!gameState.flags.gnawedStoreroomTrapDone) return; // only after disturbing the bones

  gameState.flags.gotStoreroomBuckler = true;

  const buckler = {
    id: "rust-buckler",
    name: "Rust-Flecked Buckler",
    type: "shield",
  };

  gameState.inventory.push(buckler);

  logSystem(
    "Kicking aside scattered bones, you spot the curve of metal under a fallen shelf. You drag free a small buckler, its surface pitted with rust and old scratches."
  );
  logSystem(
    "Whatever carried it last died here, but the iron still feels solid in your grip. Against beasts, it might just turn a killing blow into a glancing one."
  );
  logSystem("You gain: Rust-Flecked Buckler.");
}

// helper: start the vestibule multi-rat fight
function startVestibuleFight() {
  gameState.flags.firstVestibuleVisit = true;

  // 50% chance of 2 rats, otherwise 1
  const twoRats = roll(1, 100) <= 50;
  gameState.flags.vestibuleRatsRemaining = twoRats ? 2 : 1;
  gameState.combat.previousLocation = "collapsed_stairwell";

  if (twoRats) {
    logSystem(
      "The scratching in the tunnels builds to a frenzy. Two starved shapes spill out of the holes at once, all teeth and motion."
    );
  } else {
    logSystem(
      "Scratching builds in the walls until a single starved shape spills out of a crack in the stone, claws scrabbling for purchase."
    );
  }

  startCombat("dawnspire_rat");
}

// =========================
// Use / bandage system
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
    logSystem("You wrap the filthy cloth around already-closed wounds. It does more for your courage than your flesh.");
  } else if (inCombat) {
    logSystem(
      "You yank the filthy bandage tight around the worst of the bleeding, teeth clenched. The world narrows to breath, pressure, and the wet thump of your heart. For a heartbeat, nothing gets through."
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

function handleUse(rawArgs, { inCombat = false } = {}) {
  const arg = (rawArgs || "").trim().toLowerCase();
  if (!arg) {
    logSystem("Use what?");
    return;
  }

  // Bandages
  if (arg.includes("bandage")) {
    const used = useBandage(inCombat);
    if (!used) return;

    // In combat, using a bandage is your whole turn and prevents damage this round.
    // We deliberately do NOT call enemyTurn() here.
    return;
  }

  logSystem("You don't have a clear way to use that right now.");
}

function describeLocation() {
  const loc = locations[gameState.location];
  if (!loc) {
    logSystem("You are... nowhere? (Invalid location)");
    return;
  }
  logSystem(`${loc.name}\n${loc.description}`);

  // special: landing loot
  if (gameState.location === "cracked_landing") {
    maybeGrantLanternBadge();
  }

  // special: vestibule loot (only when not currently in combat)
  if (
    gameState.location === "rat_gnawed_vestibule" &&
    !gameState.combat.inCombat
  ) {
    maybeGrantVestibuleLoot();
  }

  // special: storeroom loot (only when not currently in combat)
  if (
    gameState.location === "gnawed_storeroom" &&
    !gameState.combat.inCombat
  ) {
    maybeGrantStoreroomBuckler();
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

  // Group items by id (fallback to name if no id)
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

// Enemy templates
const enemyTemplates = {
  dawnspire_rat: {
    id: "dawnspire_rat",
    name: "Starved Tunnel-Rat",
    type: "beast",
    maxHp: 8,
    atkMin: 1,
    atkMax: 3,
    xpReward: 12,
    description: [
      "A hairless, skeletal rat drags itself into view, its skin stretched thin and shiny over jutting bones. Patches of scabbed flesh flake away as it moves, revealing raw, weeping meat beneath. Its jaw hangs too wide, teeth long and yellowed, clicking together in a feverish rhythm as thin ropes of saliva drip to the stone.",
      "Its milky eyes roll in their sockets, unfocused but hungry, and every ragged breath rattles through a chest that looks one good kick away from collapsing. Whatever scraps of meat it has found down here were never enough."
    ].join(" "),
  },

  // Future: add humanoid / caster enemies here with type: "humanoid" / "caster"
};

// Enemy intent patterns (what the enemy is about to do next)
const enemyIntents = {
  beast: [
    {
      key: "quick",
      damageMult: 1.0,
      blockMult: 0.6,
      tell:
        "The {name} drops low, muscles quivering, ready to snap forward in a fast, flesh-tearing lunge."
    },
    {
      key: "heavy",
      damageMult: 1.8,
      blockMult: 0.3,
      tell:
        "The {name} rears back, whole body coiling as it gathers weight for a bone-cracking slam."
    },
    {
      key: "worry",
      damageMult: 1.3,
      blockMult: 0.4,
      tell:
        "The {name} paces in a tight, jittering circle, teeth chattering, clearly looking for something to latch onto and not let go."
    }
  ],
  // later: add 'humanoid' and 'caster'
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
  // previousLocation should be set by the code that *starts* the fight (e.g., movement)
  gameState.combat.intent = null;

  const intro = [
    "The air tightens, the space around you suddenly too small, too close. Something shifts just beyond the edge of your vision—a scrape of claw on stone, a wet breath pulled through broken teeth.",
    `${enemy.name} drags itself out of the dark, all twitching hunger and bad intent, drawn by the sound of your heartbeat and the sweat on your skin.`,
    "",
    enemy.description,
    "",
    "Steel, teeth, or worse—something here is going to break. Type 'attack' to stand your ground, 'block' to brace, or 'run' if your courage falters."
  ].join("\n");

  logSystem(intro);

  // First intent
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
    "Pain flashes white, then nothing. Your body hits the ground with a hollow thud as everything drains away.",
    "You fall to your knees, fingers twitching uselessly. The world narrows to a pinprick of cruel light before swallowing you whole."
  ];

  logSystem(pickLine(deathDescriptions));
  logSystem("Death claims you brutally in the dark halls of the Dawnspire...");

  // Auto wipe to make testing easier
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

// Shared enemy turn, respects intent and block
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
    const hasBuckler = gameState.inventory.some((i) => i.id === "rust-buckler");
    if (hasBuckler) {
      enemyDmg = Math.max(0, enemyDmg - 1);
    }
  }

  const enemyBucket = enemyCrit
    ? (combatFlavor.enemy.crit[enemyType] || combatFlavor.enemy.crit.beast)
    : (combatFlavor.enemy.normal[enemyType] || combatFlavor.enemy.normal.beast);

  const enemyLine = pickLine(enemyBucket).replace("{name}", enemy.name);

  if (enemyDmg > 0) {
    if (blocking) {
      const blockLines = [
        "You catch most of the impact on raised steel; the rest shudders down your arms and into your bones.",
        "You brace behind your weapon and let the blow skid off your guard, pain flaring but not fatal.",
        "You meet the strike head-on, boots grinding into the stone as you bleed off its strength."
      ];
      logSystem(`${enemyLine} (${enemyDmg} damage makes it through your guard.)`);
      logSystem(pickLine(blockLines));
    } else {
      logSystem(`${enemyLine} (${enemyDmg} damage)`);
    }

    gameState.player.hp -= enemyDmg;

    if (gameState.player.hp <= 0) {
      gameState.player.hp = 0;
      updateStatusBar();
      handlePlayerDeath();
      return;
    }

    updateStatusBar();
    logSystem(
      `Blood slicks your skin. HP: ${gameState.player.hp}/${gameState.player.maxHp}.`
    );
  } else if (blocking) {
    logSystem("You brace and the blow glances off your guard, leaving only numb arms and a ringing in your bones.");
  } else {
    logSystem("The enemy's wild motion fails to find flesh this time.");
  }

  // roll and telegraph the next intent for the upcoming round
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

  const weapon = gameState.inventory.find((i) => i.type === "weapon");
  const weaponAtk = weapon ? weapon.atk : 0;

  const critChance = 20; // 20% crit chance
  const isCrit = roll(1, 100) <= critChance;

  let dmg = roll(1 + weaponAtk, 4 + weaponAtk);
  if (isCrit) {
    dmg = dmg * 2 + 1;
  }

  enemy.hp -= dmg;

  const playerBucket = isCrit
    ? (combatFlavor.player.crit[enemyType] || combatFlavor.player.crit.beast)
    : (combatFlavor.player.normal[enemyType] || combatFlavor.player.normal.beast);

  const playerLine = pickLine(playerBucket).replace("{name}", enemy.name);
  logSystem(`${playerLine} (${dmg} damage)`);

  if (enemy.hp <= 0) {
    const deathLines = [
      `The ${enemy.name} hits the ground in a broken heap, blood pooling out to meet your boots.`,
      `The ${enemy.name} twitches once, then lies open and still among its own remains.`,
      `Whatever held the ${enemy.name} together gives out; it slumps into a ruin of meat and bone.`,
      `The ${enemy.name}'s last breath rattles out in a wet gurgle as its body sags into the dirt.`
    ];
    logSystem(pickLine(deathLines));
    const xp = enemy.xpReward || 0;
    if (xp > 0) gainXp(xp);

    // Special case: multi-rat fight in Rat-gnawed Vestibule
    if (
      gameState.location === "rat_gnawed_vestibule" &&
      gameState.flags &&
      gameState.flags.vestibuleRatsRemaining &&
      gameState.flags.vestibuleRatsRemaining > 1
    ) {
      // One down, at least one left
      gameState.flags.vestibuleRatsRemaining--;

      const newEnemy = createEnemyInstance("dawnspire_rat");
      gameState.combat.enemy = newEnemy;
      gameState.combat.intent = null;

      logSystem(
        "Something else skitters in the gnawed stone. Another starved tunnel-rat claws its way out of a hole, drawn by the blood."
      );

      gameState.combat.intent = chooseEnemyIntent(newEnemy);
      telegraphEnemyIntent(newEnemy, gameState.combat.intent);
      return;
    }

    // Vestibule fight fully cleared
    if (gameState.location === "rat_gnawed_vestibule") {
      gameState.flags.vestibuleCombatDone = true;
    }

    endCombat();
    return;
  }

  // Enemy responds according to its current intent
  enemyTurn(false);
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
    enemyTurn(false);
  }
}

// New: block
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
    logSystem("You're already as patched up as you're going to get. Rest would only waste a ration.");
    return;
  }

  const hadRation = consumeItemByType("ration");
  if (!hadRation) {
    logSystem("You rummage through your pack, but there's nothing left to eat. No ration, no rest.");
    return;
  }

  p.hp = p.maxHp;
  updateStatusBar();

  const restLines = [
    "You find a patch of ground that isn't completely soaked or sharp, chew through a tasteless ration, and force yourself to breathe until the shaking slows. After a while, the pain dulls.",
    "You sit with your back to cold stone, dry crumbs catching in your teeth as you choke down a ration. It's enough to steady your hands and pull your strength back together.",
    "You wrap torn cloth a little tighter, swallow a ration that tastes of dust and salt, and let time drag past in the dark. Eventually, your body remembers how to feel whole.",
    "You eat in silence, every bite a chore. The ration is stale, but it keeps you upright. When you stand again, your wounds have stopped screaming quite so loudly."
  ];

  logSystem(pickLine(restLines));
  logSystem(`Your strength crawls back. HP fully restored: ${p.hp}/${p.maxHp}.`);
}

// =========================
// Movement
// =========================

function handleGo(direction) {
  // no moving while in combat
  if (gameState.combat.inCombat) {
    logSystem("You're a little busy not dying right now. Try 'attack', 'block', or 'run'.");
    return;
  }

  const loc = gameState.location;
  const stairsCollapsed = !!gameState.flags.stairsCollapsed;

  // village <-> forest
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

  // forest -> surface ring
  if (loc === "dark_forest_edge" && direction === "north") {
    const fromLocation = gameState.location;

    gameState.location = "dungeon_entrance";
    logSystem(
      "You follow the path to the quake-torn clearing. The broken stone ring looms ahead as you approach the Dawnspire Below..."
    );
    describeLocation();

    // First encounter at the entrance
    if (!gameState.flags.firstDungeonFightDone) {
      gameState.flags.firstDungeonFightDone = true;
      gameState.combat.previousLocation = fromLocation; // where 'run' will send you
      startCombat("dawnspire_rat");
    }
    return;
  }

  // surface ring -> forest (only if not collapsed)
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

  // surface ring -> Room 1 (Broken Ring Descent)
  if (loc === "dungeon_entrance" && direction === "down") {
    if (stairsCollapsed) {
      reportStairsCollapsed();
      return;
    }
    gameState.location = "broken_ring_descent";
    logSystem("You step onto the worn stone steps and begin the descent into the throat of the Dawnspire.");
    describeLocation();
    return;
  }

  // Room 1 -> surface ring (only if not collapsed)
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

  // Room 1 -> Room 2 (Cracked Landing)
  if (loc === "broken_ring_descent" && direction === "down") {
    gameState.location = "cracked_landing";
    logSystem("You descend further, the walls pressing closer until the stairwell opens into a small, fractured ledge.");
    describeLocation();
    return;
  }

  // Room 2 – Cracked Landing logic
  if (loc === "cracked_landing") {
    // Up: attempt to go back toward Room 1 / surface
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

    // Down/forward: toward Room 3, triggers the quake once
    if (direction === "down" || direction === "forward") {
      const firstTimeLeavingDeeper = !stairsCollapsed;

      gameState.location = "collapsed_stairwell";

      if (firstTimeLeavingDeeper) {
        gameState.flags.stairsCollapsed = true;
        logSystem(
          "As you step off the landing, a deep groan rolls through the stone. The stairwell shudders violently. Above you, something gives way with a crack like breaking bone."
        );
        logSystem(
          "You barely keep your footing as blocks the size of coffins crash down somewhere above, choking the stair in dust and rubble."
        );
        reportStairsCollapsed();
      }

      describeLocation();
      return;
    }
  }

  // Room 3 – Collapsed Stairwell logic
  if (loc === "collapsed_stairwell") {
    if (direction === "up") {
      // Up leads back to the Cracked Landing (2), but the way to the surface is blocked further above.
      gameState.location = "cracked_landing";
      logSystem("You climb back up to the cracked landing, dust sifting down from the ruined stair above.");
      describeLocation();
      return;
    }

    if (direction === "down" || direction === "forward") {
      // First time heading deeper, loose stone trap may hit.
      const alive = runCollapsedStairTrap();
      if (!alive) {
        // Player died in the trap; movement should not continue.
        return;
      }

      gameState.location = "rat_gnawed_vestibule";
      logSystem("Shaking the last of the dust from your shoulders, you push deeper down the warped stair into the gnawed stone ahead.");
      describeLocation();

      // Guaranteed vestibule fight on first visit
      if (!gameState.flags.firstVestibuleVisit) {
        startVestibuleFight();
      }

      return;
    }
  }

  // Room 4 – Rat-gnawed Vestibule logic
  if (loc === "rat_gnawed_vestibule") {
    // Back to Room 3
    if (direction === "west" || direction === "back") {
      gameState.location = "collapsed_stairwell";
      logSystem(
        "You edge back toward the twisted stair, leaving the chewed tunnels behind you for now."
      );
      describeLocation();
      return;
    }

    // East -> Gnawed Storeroom (Room 5)
    if (direction === "east") {
      gameState.location = "gnawed_storeroom";
      logSystem(
        "You push through a low, tooth-scored arch, ducking past hanging splinters of stone into a cramped side chamber."
      );
      const alive = runGnawedStoreroomTrap();
      if (!alive) return;
      describeLocation();
      return;
    }

    // North -> Outer Hall of Lanterns (Room 6 placeholder)
    if (direction === "north") {
      logSystem(
        "You study a tunnel that climbs into a broader hall, faint traces of old lantern brackets jutting from the stone. For now, the path feels unfinished, more idea than place."
      );
      return;
    }
  }

  // Room 5 – Gnawed Storeroom logic
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
      "  go <direction>     - move (e.g., 'go north', 'go down', 'go forward', 'go back')",
      "  name <your name>   - set your name",
      "  attack             - attack the enemy in combat",
      "  block              - brace to blunt the enemy's next attack",
      "  run                - attempt to flee from combat",
      "  rest               - consume a ration to fully restore your HP",
      "  use <item>         - use an item (e.g., 'use bandage')",
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

function handleCombatCommand(cmd, raw, rest) {
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
    default:
      logSystem("In the heat of battle, that command makes no sense. Try 'attack', 'block', 'run', or 'use bandage'.");
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
        logSystem("Go where? (north, south, east, west, up, down, forward, back)");
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
