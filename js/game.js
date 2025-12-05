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

    // Inventory supports stacking & equipment bonuses
    inventory: [
        { id: "rusty-sword", name: "Rusty Sword", type: "weapon", atk: 1 },
        { id: "ration", name: "Travel Ration", type: "ration" },
        { id: "ration", name: "Travel Ration", type: "ration" },
    ],

    equipment: {
        weapon: "rusty-sword", // id of item equipped
        offhand: null,         // "rust-buckler" later
    },

    location: "village_square",

    flags: {
        stairsCollapsed: false,
        collapsedStairTrapDone: false,

        gotLanternBadge: false,
        gotVestibuleLoot: false,
        firstVestibuleVisit: false,
        vestibuleRatsRemaining: 0,
        vestibuleCombatDone: false,

        shrineUsed: false,

        shardPlaced_7: false,
        shardPlaced_10: false,
        shardPlaced_14: false,

        mirrorAngle_9: 0,
        mirrorTrapTriggered_9: false,

        gotBuckler: false,
        gotSpear: false,

        gotShard_5: false,
        gotShard_10: false,
        gotShard_14: false,

        gotProvisionRations: false,
        barracksTrapDone: false,
        gotBarracksLoot: false,

        musterCombatDone: false,
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

// --- Player ID ---
function getOrCreatePlayerId() {
    const key = "venistasia_player_id";
    let id = localStorage.getItem(key);
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : ("P-" + Math.random().toString(36).slice(2));
        localStorage.setItem(key, id);
    }
    return id;
}

// --- RNG helpers ---
function roll(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
    return arr[roll(0, arr.length - 1)];
}

// --- Inventory utils ---
function findItemIndexByType(type) {
    return gameState.inventory.findIndex(i => i.type === type);
}

function consumeItemByType(type) {
    const idx = findItemIndexByType(type);
    if (idx === -1) return false;
    gameState.inventory.splice(idx, 1);
    return true;
}

// --- Equipment bonuses ---
function getBlockBonus() {
    let bonus = 0;

    if (gameState.equipment.offhand === "rust-buckler")
        bonus += 1; // beast-only applied inside combat logic

    if (gameState.equipment.weapon === "old-guard-spear")
        bonus += 1;

    return bonus;
}

// --- Logging ---
let outputEl;
let statusNameEl, statusLevelEl, statusHpEl, statusXpEl;

function logSystem(text) {
    if (!outputEl) return console.log("[SYS]", text);
    const el = document.createElement("div");
    el.className = "output-line system";
    el.textContent = text;
    outputEl.appendChild(el);
    outputEl.scrollTop = outputEl.scrollHeight;
}

function logCommand(text) {
    if (!outputEl) return console.log("> " + text);
    const el = document.createElement("div");
    el.className = "output-line command";
    el.textContent = "> " + text;
    outputEl.appendChild(el);
    outputEl.scrollTop = outputEl.scrollHeight;
}

// --- Status bar ---
function updateStatusBar() {
    const p = gameState.player;
    statusNameEl.textContent = `Name: ${p.name}`;
    statusLevelEl.textContent = `Level: ${p.level}`;
    statusHpEl.textContent   = `HP: ${p.hp}/${p.maxHp}`;
    statusXpEl.textContent   = `XP: ${p.xp}/${p.xpToLevel}`;
}
// ============================================================
// MODULE 3 — WORLD DATA (ALL 17 ROOMS, DETAILS, DIRECTIONS)
// ============================================================

const locations = {
    // ------------------------------------------------------------------
    // OUTSIDE WORLD
    // ------------------------------------------------------------------

    village_square: {
        name: "Briar's Edge, Village Square",
        description: [
            "You stand in the cramped heart of Briar's Edge, a frontier village held together by splinters, rope, and desperation. Smoke drifts from chimneys, carrying the thin smell of boiled roots and old cabbage.",
            "Posters promising glory inside the 'Dawnspire Below' flap on a warped notice board, their edges greasy with fingerprints. North lies the Shaded Frontier — a wall of trees waiting to swallow you."
        ].join(" "),
        exits: ["north"],
    },

    dark_forest_edge: {
        name: "Forest Edge",
        description: [
            "The dirt road frays into mud and tangled roots as the forest tightens around you. The air grows colder, heavier, dragging with it scents of rot, iron, and wet leaves.",
            "Every step feels watched. To the north: the scar in the earth known as the Dawnspire. To the south: the last safety Briar’s Edge can pretend to offer."
        ].join(" "),
        exits: ["north", "south"],
    },

    dungeon_entrance: {
        name: "Dawnspire – Broken Ring",
        description: [
            "A ring of shattered stone encircles a gaping hole in the ground. Leaning pillars tilt like gravemarkers around a spiral stair that winds into breathless dark.",
            "Scrapes in the dust show where others descended. None show return."
        ].join(" "),
        exits: ["south", "down"],
    },

    // ------------------------------------------------------------------
    // FLOOR 1 – ROOM 1
    // ------------------------------------------------------------------

    broken_ring_descent: {
        name: "Broken Ring Descent",
        description: [
            "The spiral stair narrows sharply, slick with cold seepage. Strange veins of pale green lichen pulse faintly in the cracks, throwing warped shadows.",
            "Footsteps echo strangely — always one more than you make."
        ].join(" "),
        exits: ["up", "down"],
    },

    // ------------------------------------------------------------------
    // ROOM 2 – Cracked Landing
    // ------------------------------------------------------------------

    cracked_landing: {
        name: "Cracked Landing",
        description: [
            "A claustrophobic landing where fractured stone juts from walls and floor. Dust showers drift from above with every groan of ancient stone.",
            "A faint memory of daylight lingers up the shaft behind you… for now."
        ].join(" "),
        exits: ["up", "down"],
    },

    // ------------------------------------------------------------------
    // ROOM 3 – Collapsed Stairwell
    // ------------------------------------------------------------------

    collapsed_stairwell: {
        name: "Collapsed Stairwell",
        description: [
            "The stair twists around a throat of rubble where the upper descent has collapsed completely. Dust spirals in the stale air like ash caught mid-fall.",
            "The stone ahead slopes downward again — narrower, meaner, hungrier."
        ].join(" "),
        exits: ["up", "down"],
    },

    // ------------------------------------------------------------------
    // ROOM 4 – Rat-Gnawed Vestibule
    // ------------------------------------------------------------------

    rat_gnawed_vestibule: {
        name: "Rat-Gnawed Vestibule",
        description: [
            "A wedge-shaped chamber chewed bare by countless teeth. Bedroll scraps fuse to the floor in moldy tatters, beside a snapped spear haft and a few dark stains that never dried clean.",
            "Thin tunnels web the walls — whatever dug them is probably still near."
        ].join(" "),
        exits: ["west", "east", "north"],
    },

    // ------------------------------------------------------------------
    // ROOM 5 – Gnawed Storeroom
    // ------------------------------------------------------------------

    gnawed_storeroom: {
        name: "Gnawed Storeroom",
        description: [
            "Collapsed shelves lean drunkenly against the walls. Torn sacks spill rotten grain into heaps crawling with tiny pale insects.",
            "Bones — small and large — scatter the floor in chaotic piles. Something rifled through this place long after it should have been forgotten."
        ].join(" "),
        exits: ["west"],
    },

    // ------------------------------------------------------------------
    // ROOM 6 – Outer Hall of Lanterns
    // ------------------------------------------------------------------

    outer_lantern_hall: {
        name: "Outer Hall of Lanterns",
        description: [
            "A long corridor lined with broken sconces and cracked stone lanterns. Indentations in the walls suggest places where warm crystal light once burned.",
            "Now only dust and silence remain — but the layout whispers of patterns, alignments, something once meant to be illuminated."
        ].join(" "),
        exits: ["south", "east", "north"],
    },

    // ------------------------------------------------------------------
    // ROOM 7 – Flicker Node
    // ------------------------------------------------------------------

    flicker_node: {
        name: "Flicker Node",
        description: [
            "A small chamber where a fractured mirror panel leans precariously in its frame. A single lantern fixture sits inset into the wall — untouched by time.",
            "Carved beneath it: “Light must travel.”"
        ].join(" "),
        exits: ["west", "north"],
    },

    // ------------------------------------------------------------------
    // ROOM 8 – Door of Failed Light
    // ------------------------------------------------------------------

    failed_light_door: {
        name: "Door of Failed Light",
        description: [
            "A heavy stone door stands sealed, carved with a fractured sunburst. Three dull crystal sockets crown the frame, dead and waiting.",
            "Etched beneath the dust: “Lanterns failed. Stones fell. Light must bend to pass.”"
        ].join(" "),
        exits: ["south"],
    },

    // ------------------------------------------------------------------
    // ROOM 9 – Mirror Gallery
    // ------------------------------------------------------------------

    mirror_gallery: {
        name: "Mirror Gallery",
        description: [
            "A tight hall lined with tarnished mirror panels, their surfaces cracked into branching veins. Some look adjustable — rotated on rusted pivots.",
            "Faint scratches on the floor trace paths of reflected light."
        ].join(" "),
        exits: ["south", "east"],
    },

    // ------------------------------------------------------------------
    // ROOM 10 – Shard Niche
    // ------------------------------------------------------------------

    shard_niche: {
        name: "Shard Niche",
        description: [
            "A circular alcove containing a stone pedestal. Resting atop it is a lantern fixture — intact — and a shard of prismatic crystal pulsing faintly.",
            "Dust patterns on the floor suggest beams once converged here."
        ].join(" "),
        exits: ["west", "north"],
    },

    // ------------------------------------------------------------------
    // ROOM 11 – Fallen Guard Post
    // ------------------------------------------------------------------

    fallen_guard_post: {
        name: "Fallen Guard Post",
        description: [
            "An overturned table, shattered spears, and a cracked warning bell hang in stale air. Scraped drag-marks vanish under a collapsed beam.",
            "A soldier once stood watch here — poorly, by the look of it."
        ].join(" "),
        exits: ["south", "east"],
    },

    // ------------------------------------------------------------------
    // ROOM 12 – Broken Barracks
    // ------------------------------------------------------------------

    broken_barracks: {
        name: "Broken Barracks",
        description: [
            "Rotting bunks sag into a floor split by a narrow fissure. Blankets lie fossilized in grime. A few skeletal remains curl against footlockers long since pried open.",
            "The air tastes of old dust and something stranger — secrets left to ferment in the dark."
        ].join(" "),
        exits: ["west", "north"],
    },

    // ------------------------------------------------------------------
    // ROOM 13 – Lantern Muster Hall
    // ------------------------------------------------------------------

    lantern_muster_hall: {
        name: "Lantern Muster Hall",
        description: [
            "A wide hall choked with tattered banners depicting lantern-bearing warriors. A cracked stone floor-map dominates the center, showing three concentric rings descending deeper.",
            "Time has scraped away names and symbols — but intent remains etched in the silence."
        ].join(" "),
        exits: ["south", "east", "north"],
    },

    // ------------------------------------------------------------------
    // ROOM 14 – Armory of Dust
    // ------------------------------------------------------------------

    armory_of_dust: {
        name: "Armory of Dust",
        description: [
            "Weapon racks crumbled into piles of reddish flakes. A few serviceable relics remain — preserved by luck or forgotten craft.",
            "A collapsed rack against the far wall looks… suspiciously hollow."
        ].join(" "),
        exits: ["west"],
        secret: ["east"], // Hidden Shrine
    },

    // ------------------------------------------------------------------
    // ROOM 15 – Watch Balcony
    // ------------------------------------------------------------------

    watch_balcony: {
        name: "Watch Balcony",
        description: [
            "A narrow overlook juts above a yawning black chasm. You can sense water somewhere far below — dripping, echoing like slow footsteps.",
            "Carved into the parapet: “They will climb after us. We must break the way back.”"
        ].join(" "),
        exits: ["south", "east"],
    },

    // ------------------------------------------------------------------
    // ROOM 16 – Hidden Shrine to the Flame
    // ------------------------------------------------------------------

    hidden_shrine: {
        name: "Hidden Shrine to the Flame",
        description: [
            "A secret circular chamber. At its center stands an untouched Lantern Knight statue, hands cupped as if waiting to cradle fire.",
            "The silence here is deeper — reverent — a pocket of memory preserved from whatever consumed the rest of the Dawnspire."
        ].join(" "),
        exits: ["west"],
    },

    // ------------------------------------------------------------------
    // ROOM 17 – Stale Provision Cellar
    // ------------------------------------------------------------------

    provision_cellar: {
        name: "Stale Provision Cellar",
        description: [
            "A cool chamber of broken barrels and mold-soft sacks. Most food here spoiled decades ago, reduced to pale mulch and drifting spores.",
            "But not everything has rotted — some wax-sealed packets remain intact on a toppled crate."
        ].join(" "),
        exits: ["south"],
    },
};
// ============================================================
// MODULE 4 — MOVEMENT, TRAPS, SHRINE, PUZZLES, COMBAT HANDLERS
// ============================================================

// ----------------------------
// Utility: basic logging
// ----------------------------
function sys(msg) {
    logSystem(msg);
}
function you(msg) {
    logSystem(msg);
}

// ============================================================
// ROOM ENTRY — Auto-events, Traps, Loot, Light Puzzle Updating
// ============================================================

function enterRoom(id) {
    gameState.location = id;
    const loc = locations[id];

    sys(`${loc.name}\n${loc.description}`);

    // Run room-specific logic
    handleRoomTriggers(id);

    // Show exits
    if (loc.exits) {
        sys("Exits: " + loc.exits.join(", "));
    }

    scheduleSave();
}

// ============================================================
// Room-specific triggers
// ============================================================

function handleRoomTriggers(id) {
    switch (id) {

        // -------------------------
        // CRACKED LANDING — free badge
        // -------------------------
        case "cracked_landing":
            if (!gameState.flags.lanternBadge) {
                gameState.flags.lanternBadge = true;
                gameState.inventory.push({
                    id: "lantern-badge",
                    name: "Lantern Knight’s Badge",
                    type: "key"
                });
                sys("Half-buried in rubble, you pull free an old Lantern Knight’s Badge.");
            }
            break;

        // -------------------------
        // COLLAPSED STAIRWELL — falling stone trap
        // -------------------------
        case "collapsed_stairwell":
            if (!gameState.flags.stairTrapDone) {
                runFallingStoneTrap();
            }
            break;

        // -------------------------
        // VESTIBULE — multi-rat fight (1–2)
        // -------------------------
        case "rat_gnawed_vestibule":
            if (!gameState.flags.vestibuleCleared) {
                startVestibuleFight();
            } else {
                maybeVestibuleLoot();
            }
            break;

        // -------------------------
        // GNAWED STOREROOM — rat trap + buckler + shard
        // -------------------------
        case "gnawed_storeroom":
            if (!gameState.flags.storeroomTrapDone) {
                runRatPileTrap();
            } else {
                maybeStoreroomLoot();
            }
            break;

        // -------------------------
        // FLICKER NODE — beam source
        // -------------------------
        case "flicker_node":
            if (!gameState.flags.flickerLoot) {
                gameState.flags.flickerLoot = true;
                const c = roll(2, 5);
                for (let i = 0; i < c; i++) {
                    gameState.inventory.push({ id: "coin", type: "coin", name: "Dawnspire Coin" });
                }
                sys(`You find ${c} tarnished Dawnspire Coins near the lantern base.`);
            }

            if (gameState.flags.flickerShardAligned) {
                sys("A thin beam of crystal light threads north toward the mirror hall.");
            }
            break;

        // -------------------------
        // MIRROR GALLERY — show beam routing state
        // -------------------------
        case "mirror_gallery":
            describeMirrorState();
            break;

        // -------------------------
        // SHARD NICHE — auto-shard + split beam
        // -------------------------
        case "shard_niche":
            maybeTakeNicheShard();
            describeShardNicheState();
            break;

        // -------------------------
        // FALLEN GUARD POST — spear + bell logic
        // -------------------------
        case "fallen_guard_post":
            maybeGuardSpear();
            break;

        // -------------------------
        // BROKEN BARRACKS — undead fight
        // -------------------------
        case "broken_barracks":
            if (!gameState.flags.barracksCleared) {
                startBarracksFight();
            }
            break;

        // -------------------------
        // LANTERN MUSTER HALL — elite undead
        // -------------------------
        case "lantern_muster_hall":
            if (!gameState.flags.musterLore) {
                gameState.flags.musterLore = true;
                sys("A cracked floor-map shows three descending rings: 'THREE RINGS BELOW — AND MORE BENEATH THAT.'");
            }
            if (!gameState.flags.musterCleared) {
                startLanternBearerFight();
            }
            break;

        // -------------------------
        // ARMORY OF DUST — rust trap + iron sword
        // -------------------------
        case "armory_of_dust":
            runArmoryTrap();
            break;

        // -------------------------
        // HIDDEN SHRINE — blessing hints
        // -------------------------
        case "hidden_shrine":
            describeShrineState();
            break;

        // -------------------------
        // PROVISION CELLAR — free food
        // -------------------------
        case "provision_cellar":
            maybeProvisionCellarLoot();
            break;
    }
}

// ============================================================
// TRAPS
// ============================================================

// -------------------------
// Collapsed Stairwell trap
// -------------------------
function runFallingStoneTrap() {
    gameState.flags.stairTrapDone = true;

    sys("Stone grinds overhead. A block shears loose and plummets.");

    let dmg = roll(1, 3);
    gameState.player.hp -= dmg;

    if (gameState.player.hp <= 0) {
        gameState.player.hp = 0;
        updateStatusBar();
        sys("The impact crushes the breath from your body.");
        return handlePlayerDeath();
    }

    updateStatusBar();
    sys(`The block glances off your shoulder. (${dmg} damage)`);
}

// -------------------------
// Storeroom — rat pile trap
// -------------------------
function runRatPileTrap() {
    gameState.flags.storeroomTrapDone = true;

    sys("The bone pile erupts into a frenzy of teeth.");

    let dmg = roll(1, 3);
    gameState.player.hp -= dmg;

    if (gameState.player.hp <= 0) {
        gameState.player.hp = 0;
        updateStatusBar();
        sys("The swarm tears you apart in seconds.");
        return handlePlayerDeath();
    }

    updateStatusBar();
    sys(`You kick free of gnawing bodies. (${dmg} damage)`);
}

// -------------------------
// Armory rust-burst trap
// -------------------------
function runArmoryTrap() {
    if (gameState.flags.armoryTrapDone) return;

    gameState.flags.armoryTrapDone = true;

    sys("A pristine blade catches your eye — too pristine. You grasp it.");
    sys("The metal collapses into choking rust, exploding across your face!");

    let dmg = roll(1, 3);
    gameState.player.hp -= dmg;

    if (gameState.player.hp <= 0) {
        gameState.player.hp = 0;
        updateStatusBar();
        sys("Your lungs seize as you collapse.");
        return handlePlayerDeath();
    }

    updateStatusBar();
    sys(`You stagger, choking on rust. (${dmg} damage)`);

    // Now loot
    giveArmoryLoot();
}

// ============================================================
// LOOT HANDLERS
// ============================================================

// -------------------------
// Vestibule — loot after clearing
// -------------------------
function maybeVestibuleLoot() {
    if (gameState.flags.vestibuleLoot) return;
    if (!gameState.flags.vestibuleCleared) return;

    gameState.flags.vestibuleLoot = true;

    gameState.inventory.push(
        { id: "ration", name: "Travel Ration", type: "ration" },
        { id: "dirty-bandage", name: "Dirty Bandage", type: "consumable", heal: 4 }
    );

    sys("You find a stale ration and a dirty bandage among shredded bedroll remains.");
}

// -------------------------
// Storeroom — buckler + shard
// -------------------------
function maybeStoreroomLoot() {
    if (gameState.flags.storeroomLoot) return;

    gameState.flags.storeroomLoot = true;

    // Buckler
    gameState.inventory.push({
        id: "rust-buckler",
        name: "Rust-Flecked Buckler",
        type: "shield"
    });

    // First shard
    gameState.inventory.push({
        id: "lantern-shard-1",
        name: "Lantern Shard (First Fragment)",
        type: "key"
    });

    sys("Under the bones you find a rust-flecked buckler and a prismatic shard.");

    // Auto-equip shield if empty
    ensureEquipment();
    if (!gameState.player.equipment.shieldId) {
        gameState.player.equipment.shieldId = "rust-buckler";
        sys("You strap the buckler to your arm.");
    }
}

// -------------------------
// Guard Post — spear
// -------------------------
function maybeGuardSpear() {
    if (gameState.flags.guardSpear) return;

    gameState.flags.guardSpear = true;

    const spear = {
        id: "old-guard-spear",
        name: "Old Guard Spear",
        type: "weapon",
        atk: 1
    };

    gameState.inventory.push(spear);
    sys("You find an old guard spear with enough edge left to matter.");

    // Auto-equip if better
    ensureEquipment();
    const current = getEquippedWeapon();
    if (!current || (current.atk || 0) < spear.atk) {
        gameState.player.equipment.weaponId = "old-guard-spear";
        sys("You take up the spear — longer reach, safer distance.");
    }
}

// -------------------------
// Shard Niche — free shard
// -------------------------
function maybeTakeNicheShard() {
    if (gameState.flags.nicheShard) return;

    gameState.flags.nicheShard = true;

    gameState.inventory.push({
        id: "lantern-shard-2",
        name: "Lantern Shard (Second Fragment)",
        type: "key"
    });

    sys("You take the prismatic shard resting on the pedestal.");
}

// -------------------------
// Armory — iron sword + shard + coins
// -------------------------
function giveArmoryLoot() {
    if (gameState.flags.armoryLoot) return;
    gameState.flags.armoryLoot = true;

    const iron = { id: "iron-sword", name: "Serviceable Iron Sword", type: "weapon", atk: 2 };
    const shard = { id: "lantern-shard-3", name: "Lantern Shard (Third Fragment)", type: "key" };

    gameState.inventory.push(iron, shard);

    const c = roll(1, 3);
    for (let i = 0; i < c; i++) {
        gameState.inventory.push({ id: "coin", name: "Dawnspire Coin", type: "coin" });
    }

    sys("You recover a sturdy iron sword, a prismatic shard, and a few coins.");

    // Auto-equip if better
    const current = getEquippedWeapon();
    if (!current || (current.atk || 0) < iron.atk) {
        gameState.player.equipment.weaponId = "iron-sword";
        sys("You equip the iron sword — balanced, reliable, deadly.");
    }
}

// -------------------------
// Provision Cellar loot
// -------------------------
function maybeProvisionCellarLoot() {
    if (gameState.flags.cellarLoot) return;

    gameState.flags.cellarLoot = true;

    const count = roll(1, 3);
    for (let i = 0; i < count; i++) {
        gameState.inventory.push({ id: "ration", name: "Travel Ration", type: "ration" });
    }

    sys(`You salvage ${count} intact wax-sealed rations.`);
}

// ============================================================
// COMBAT TRIGGERS
// ============================================================

function startVestibuleFight() {
    const two = roll(1, 100) <= 50;
    gameState.flags.vestibuleRats = two ? 2 : 1;

    sys(two ?
        "Two starved tunnel-rats spill out of the gnawed tunnels!" :
        "A single starved tunnel-rat lunges from the darkness!"
    );

    startCombat("dawnspire_rat");
}

function startBarracksFight() {
    const two = roll(1, 100) <= 50;
    gameState.flags.barracksLeft = two ? 2 : 1;

    sys(two ?
        "Two desiccated soldiers rise from ruined bunks!" :
        "A desiccated soldier pulls itself upright with a rasp of bone!"
    );

    startCombat("desiccated_soldier");
}

function startLanternBearerFight() {
    sys("A Hollow Lantern-Bearer steps forward, lantern burning with pale hatred.");
    startCombat("hollow_lantern_bearer");
}

// ============================================================
// SHRINE SYSTEM
// ============================================================

function describeShrineState() {
    if (!playerHasShard()) {
        sys("The Knight statue extends an empty hand, waiting for something sharp and prismatic.");
        return;
    }

    if (!gameState.flags.shrineBlessing) {
        sys("The crystal flame leans toward your shards. Perhaps 'use shard'?");
    } else if (gameState.flags.shrineBlessingActive) {
        sys("Warmth coils in your chest — a single lethal blow will not kill you.");
    } else {
        sys("The shrine flame flickers low. Its gift has already been spent.");
    }
}

function playerHasShard() {
    return gameState.inventory.some(i => i && i.id && i.id.includes("lantern-shard"));
}

function useShardAtShrine() {
    if (!playerHasShard()) {
        sys("The shard vanishes from your fingers — because you don’t have one.");
        return;
    }

    if (gameState.location !== "hidden_shrine") {
        sys("You hold the shard out. Nothing here responds.");
        return;
    }

    if (gameState.flags.shrineBlessing) {
        sys("The shrine has already given what it can.");
        return;
    }

    gameState.flags.shrineBlessing = true;
    gameState.flags.shrineBlessingActive = true;

    const before = gameState.player.hp;
    gameState.player.hp = Math.min(before + 5, gameState.player.maxHp);
    updateStatusBar();

    sys("The shard sinks into the Knight’s palm. Light blooms. Warmth fills your lungs.");
    sys("The blessing settles in your bones — the next killing blow will leave you at 1 HP.");
}

// ============================================================
// MIRROR / LIGHT PUZZLE
// ============================================================

function describeMirrorState() {
    if (!gameState.flags.flickerShardAligned) {
        sys("The mirrors show only dust and fractured reflections — no beam reaches them yet.");
        return;
    }

    if (gameState.flags.mirrorToNiche) {
        sys("Mirrors angle east, carrying the light toward the Shard Niche.");
    } else if (gameState.flags.mirrorToDoor) {
        sys("Mirrors angle south, sending light toward the Door of Failed Light.");
    } else {
        sys("The beam flickers chaotically across cracked mirrors.");
    }
}

function handleAdjustMirrors(target) {
    if (gameState.location !== "mirror_gallery") {
        sys("Nothing here responds to mirror adjustments.");
        return;
    }

    if (!gameState.flags.flickerShardAligned) {
        sys("Without a source beam from the Flicker Node, the mirrors stay dull.");
        return;
    }

    const r = roll(1, 100);
    if (r <= 30) {
        // flash trap
        const dmg = roll(1, 3);
        gameState.player.hp -= dmg;

        if (gameState.player.hp <= 0) {
            gameState.player.hp = 0;
            updateStatusBar();
            sys("Light reflects into your eyes with lethal force.");
            return handlePlayerDeath();
        }

        updateStatusBar();
        sys(`A mirror slips — blinding flash! (${dmg} damage)`);
        return;
    }

    if (target.includes("east")) {
        gameState.flags.mirrorToNiche = true;
        gameState.flags.mirrorToDoor = false;
        sys("You angle mirrors east — the beam now travels toward the Niche.");
        return;
    }

    if (target.includes("door") || target.includes("south")) {
        gameState.flags.mirrorToDoor = true;
        gameState.flags.mirrorToNiche = false;
        sys("Mirrors tilt south, sending light toward the great door.");
        return;
    }

    sys("You shift mirrors, but the beam scatters uselessly.");
}

// -------------------------
// Shard Niche — split beam status
// -------------------------
function describeShardNicheState() {
    const incoming =
        gameState.flags.flickerShardAligned &&
        gameState.flags.mirrorToNiche;

    const shardSeated = gameState.flags.nicheShardSeated;

    if (incoming && shardSeated) {
        sys("Light hits the shard and splits — one beam feeds the mirrors, another dives toward the Door of Failed Light.");
    } else if (incoming && !shardSeated) {
        sys("Light grazes the empty socket — seating a shard would focus it.");
    } else if (!incoming && shardSeated) {
        sys("The shard waits, fractures ready to split light when it arrives.");
    } else {
        sys("Everything here is still and dark.");
    }
}

// ============================================================
// DOOR OF FAILED LIGHT — beam checking
// ============================================================

function tryOpenFailedLightDoor() {
    const litCount =
        (gameState.flags.flickerShardAligned ? 1 : 0) +
        (gameState.flags.mirrorToDoor ? 1 : 0) +
        (gameState.flags.nicheShardSeated ? 1 : 0);

    if (litCount < 3) {
        sys("The stone remains sealed. The sockets glow faintly at best.");
        return;
    }

    sys("All three sockets blaze. The fractured sunburst pulses—");
    sys("But the mechanism deeper within is incomplete. This path is not yet implemented.");
}

// ============================================================
// ADDITIONS TO USE COMMAND
// ============================================================

function extendedUseSystem(arg, inCombat) {
    // Shrine usage
    if ((arg.includes("shard") || arg.includes("crystal")) &&
        gameState.location === "hidden_shrine") {
        return useShardAtShrine();
    }

    // Flicker Node — align source beam
    if ((arg.includes("shard") || arg.includes("crystal")) &&
        gameState.location === "flicker_node") {
        gameState.flags.flickerShardAligned = true;
        sys("The shard locks into the lantern — a thin beam leaps north into the dark.");
        return;
    }

    // Shard Niche — seat shard for splitting
    if ((arg.includes("shard") || arg.includes("crystal")) &&
        gameState.location === "shard_niche") {
        gameState.flags.nicheShardSeated = true;
        sys("You set the shard into the socket. Its fractures are ready to split incoming light.");
        return;
    }

    // Fallback to main handler
    return handleUse(arg, { inCombat });
}

// ============================================================
// HOOK MOVEMENT INTO NEW ROOM SYSTEM
// ============================================================

function goDirection(dir) {
    const loc = locations[gameState.location];

    if (!loc.exits.includes(dir)) {
        sys("You can't go that way.");
        return;
    }

    // -------------------------
    // Custom transitions
    // -------------------------
    if (gameState.location === "village_square" && dir === "north") {
        return enterRoom("dark_forest_edge");
    }
    if (gameState.location === "dark_forest_edge" && dir === "south") {
        return enterRoom("village_square");
    }
    if (gameState.location === "dark_forest_edge" && dir === "north") {
        return enterRoom("dungeon_entrance");
    }

    // Many transitions follow exact room numbering
    const transitions = {
        "dungeon_entrance": { down: "broken_ring_descent", south: "dark_forest_edge" },
        "broken_ring_descent": { up: "dungeon_entrance", down: "cracked_landing" },
        "cracked_landing": { up: "broken_ring_descent", down: "collapsed_stairwell" },
        "collapsed_stairwell": { up: "cracked_landing", down: "rat_gnawed_vestibule" },
        "rat_gnawed_vestibule": {
            west: "collapsed_stairwell",
            east: "gnawed_storeroom",
            north: "outer_lantern_hall"
        },
        "gnawed_storeroom": { west: "rat_gnawed_vestibule" },
        "outer_lantern_hall": {
            south: "rat_gnawed_vestibule",
            east: "flicker_node",
            north: "failed_light_door"
        },
        "flicker_node": {
            west: "outer_lantern_hall",
            north: "mirror_gallery"
        },
        "failed_light_door": {
            south: "outer_lantern_hall"
        },
        "mirror_gallery": {
            south: "flicker_node",
            east: "shard_niche"
        },
        "shard_niche": {
            west: "mirror_gallery",
            north: "fallen_guard_post"
        },
        "fallen_guard_post": {
            south: "shard_niche",
            east: "broken_barracks"
        },
        "broken_barracks": {
            west: "fallen_guard_post",
            north: "lantern_muster_hall"
        },
        "lantern_muster_hall": {
            south: "broken_barracks",
            east: "armory_of_dust",
            north: "watch_balcony"
        },
        "armory_of_dust": {
            west: "lantern_muster_hall",
            east: "hidden_shrine"
        },
        "hidden_shrine": {
            west: "armory_of_dust"
        },
        "watch_balcony": {
            south: "lantern_muster_hall",
            east: "provision_cellar"
        },
        "provision_cellar": {
            south: "watch_balcony"
        }
    };

    const t = transitions[gameState.location];
    if (t && t[dir]) {
        return enterRoom(t[dir]);
    }

    sys("You can't go that way.");
}
// ============================================================
// MODULE 5 — COMBAT SYSTEM (Core + Waves + Gear Block Bonuses)
// ============================================================

// Expected from earlier modules:
// - gameState (with gameState.player, gameState.inventory, gameState.flags, gameState.combat)
// - roll(min,max)
// - pickLine(arr) (optional; we’ll fallback safely)
// - ensureEquipment(), getEquippedWeapon()
// - updateStatusBar(), logSystem()
// - scheduleSave()
// - handleReset() or handlePlayerDeath() (we define handlePlayerDeath here)
// ============================================================

function pick(arr) {
  if (!arr || !arr.length) return "";
  if (typeof pickLine === "function") return pickLine(arr);
  return arr[roll(0, arr.length - 1)];
}

function ensureCombatState() {
  if (!gameState.combat) {
    gameState.combat = { inCombat: false, enemy: null, intent: null, previousLocation: null };
  }
}

function isShieldEquipped(id) {
  ensureEquipment();
  return gameState.player?.equipment?.shieldId === id;
}

function isWeaponEquipped(id) {
  const w = getEquippedWeapon();
  return !!w && w.id === id;
}

// ============================================================
// Enemy Templates
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
    description:
      "A hairless, skeletal rat drags itself into view—skin tight over bone, teeth clicking like wet stones.",
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
      "The corpse wears the ragged remains of a garrison tabard. It moves with duty’s last reflex—slow, deliberate, wrong.",
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
      "Rotten plate armor hangs on a frame of dried sinew. A cracked lantern burns in its fist—cold light that hates you personally.",
  },
};

// ============================================================
// Combat Flavor
// ============================================================

const combatFlavor = {
  player: {
    normal: {
      beast: [
        "You slash into the {name}, fur and flesh tearing.",
        "Steel bites. The {name} recoils, hissing through broken teeth.",
      ],
      humanoid: [
        "You smash your weapon into the {name}'s ribs.",
        "Your strike drives into dead meat and old armor.",
      ],
    },
    crit: {
      beast: [
        "Your blade finds the throat. CRITICAL HIT.",
        "You split bone and skull. CRITICAL HIT.",
      ],
      humanoid: [
        "You cave in the {name}'s skull. CRITICAL HIT.",
        "Your strike punches through weak seams. CRITICAL HIT.",
      ],
    },
  },
  enemy: {
    normal: {
      beast: [
        "The {name} snaps down on you.",
        "The {name} rakes claws across your side.",
      ],
      humanoid: [
        "The {name}'s weapon crunches into you.",
        "The {name} drags rusted steel across your skin.",
      ],
    },
    crit: {
      beast: [
        "The {name} sinks teeth deep. CRITICAL WOUND.",
        "The {name} tears into you like you're meat. CRITICAL WOUND.",
      ],
      humanoid: [
        "Steel drives in. CRITICAL WOUND.",
        "A brutal blow lands clean. CRITICAL WOUND.",
      ],
    },
  },
};

// ============================================================
// Enemy Intents (telegraphed “wind-up”)
// ============================================================

const enemyIntents = {
  beast: [
    {
      key: "quick",
      damageMult: 1.0,
      blockMult: 0.6,
      tell: "The {name} drops low, ready to spring.",
    },
    {
      key: "heavy",
      damageMult: 1.8,
      blockMult: 0.3,
      tell: "The {name} coils for a bone-cracking slam.",
    },
    {
      key: "worry",
      damageMult: 1.3,
      blockMult: 0.4,
      tell: "The {name} circles, searching for a bite it can keep.",
    },
  ],
  humanoid: [
    {
      key: "cut",
      damageMult: 1.2,
      blockMult: 0.5,
      tell: "The {name} raises its weapon in a stiff, killing arc.",
    },
    {
      key: "thrust",
      damageMult: 1.5,
      blockMult: 0.4,
      tell: "The {name} lines up a straight thrust.",
    },
    {
      key: "flail",
      damageMult: 1.0,
      blockMult: 0.6,
      tell: "The {name} jerks into a wild, sweeping attack.",
    },
  ],
};

function chooseEnemyIntent(enemy) {
  const type = enemy?.type || "beast";
  const pool = enemyIntents[type] || enemyIntents.beast;
  return pool[roll(0, pool.length - 1)];
}

function telegraphEnemyIntent(enemy, intent) {
  if (!enemy || !intent) return;
  logSystem(intent.tell.replace("{name}", enemy.name));
}

// ============================================================
// Combat lifecycle
// ============================================================

function createEnemyInstance(enemyId) {
  const t = enemyTemplates[enemyId];
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    type: t.type || "beast",
    maxHp: t.maxHp,
    hp: t.maxHp,
    atkMin: t.atkMin,
    atkMax: t.atkMax,
    xpReward: t.xpReward || 0,
    isUndead: !!t.isUndead,
    description: t.description || "",
  };
}

function startCombat(enemyId) {
  ensureCombatState();
  const enemy = createEnemyInstance(enemyId);
  if (!enemy) {
    logSystem("Something should be here, but isn't. (Missing enemy data.)");
    return;
  }

  gameState.combat.inCombat = true;
  gameState.combat.enemy = enemy;
  gameState.combat.intent = null;

  logSystem(
    [
      "The air tightens. The room suddenly feels too small.",
      `${enemy.name} steps out of the dark.`,
      "",
      enemy.description,
      "",
      "Commands: attack, block, run (or use bandage if you have it).",
    ].join("\n")
  );

  gameState.combat.intent = chooseEnemyIntent(enemy);
  telegraphEnemyIntent(enemy, gameState.combat.intent);

  scheduleSave();
}

function endCombat() {
  ensureCombatState();
  gameState.combat.inCombat = false;
  gameState.combat.enemy = null;
  gameState.combat.intent = null;
  gameState.combat.previousLocation = null;
  scheduleSave();
}

// ============================================================
// Death + XP + Leveling
// ============================================================

function handlePlayerDeath() {
  logSystem(
    pick([
      "Your legs buckle. The world tilts. Blood warms the stone beneath you.",
      "You collapse, breath rattling once—then not at all.",
    ])
  );
  logSystem("Death claims you in the Dawnspire…");
  if (typeof handleReset === "function") handleReset();
}

function gainXp(amount) {
  const p = gameState.player;
  p.xp += amount;
  logSystem(`You gain ${amount} XP.`);

  while (p.xp >= p.xpToLevel) {
    p.xp -= p.xpToLevel;
    p.level += 1;

    // Your existing rule: +5 max HP per level
    p.maxHp += 5;
    p.hp = p.maxHp;

    p.xpToLevel = Math.round(p.xpToLevel * 1.3);
    logSystem(`*** LEVEL UP: ${p.level}. Max HP is now ${p.maxHp}. ***`);
  }

  updateStatusBar();
}

// ============================================================
// Enemy Turn (damage, blocking, gear bonuses)
// ============================================================

function enemyTurn({ blocking = false } = {}) {
  ensureCombatState();
  const enemy = gameState.combat.enemy;
  if (!enemy) return;

  let intent = gameState.combat.intent;
  if (!intent) {
    intent = chooseEnemyIntent(enemy);
    gameState.combat.intent = intent;
  }

  const enemyType = enemy.type || "beast";

  // Crit
  const enemyCritChance = 15;
  const enemyCrit = roll(1, 100) <= enemyCritChance;

  // Base damage + intent multiplier
  let dmg = roll(enemy.atkMin, enemy.atkMax);
  dmg = Math.max(1, Math.round(dmg * (intent.damageMult || 1)));

  if (enemyCrit) dmg *= 2;

  // Blocking reduces damage multiplicatively
  if (blocking) {
    const blockMult = intent.blockMult != null ? intent.blockMult : 0.4;
    dmg = Math.floor(dmg * blockMult);

    // ===== Mechanical block bonuses (your requested rules) =====
    // Buckler: extra -1 vs beasts when blocking
    if (enemyType === "beast" && isShieldEquipped("rust-buckler")) {
      dmg = Math.max(0, dmg - 1);
    }

    // Spear: extra -1 vs all when blocking
    if (isWeaponEquipped("old-guard-spear")) {
      dmg = Math.max(0, dmg - 1);
    }
  }

  const bucket = enemyCrit
    ? (combatFlavor.enemy.crit[enemyType] || combatFlavor.enemy.crit.beast)
    : (combatFlavor.enemy.normal[enemyType] || combatFlavor.enemy.normal.beast);

  const line = pick(bucket).replace("{name}", enemy.name);

  if (dmg > 0) {
    logSystem(blocking ? `${line} (${dmg} damage gets through your guard.)` : `${line} (${dmg} damage)`);
    gameState.player.hp -= dmg;

    if (gameState.player.hp <= 0) {
      // Shrine blessing: first lethal blow -> set to 1 HP
      if (gameState.flags?.shrineBlessingActive) {
        gameState.flags.shrineBlessingActive = false;
        gameState.player.hp = 1;
        updateStatusBar();
        logSystem(
          "Everything goes white-hot for a heartbeat. When it snaps back, you’re still standing—barely. The shrine’s blessing gutters out."
        );
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

  // Telegraph next intent
  gameState.combat.intent = chooseEnemyIntent(enemy);
  telegraphEnemyIntent(enemy, gameState.combat.intent);

  scheduleSave();
}

// ============================================================
// Player Actions: Attack / Block / Run
// ============================================================

function handleAttack() {
  ensureCombatState();
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing here to attack.");
    return;
  }

  const enemy = gameState.combat.enemy;
  const enemyType = enemy.type || "beast";

  const weapon = getEquippedWeapon();
  const weaponAtk = weapon ? weapon.atk || 0 : 0;

  const critChance = 20;
  const isCrit = roll(1, 100) <= critChance;

  let dmg = roll(1 + weaponAtk, 4 + weaponAtk);
  if (isCrit) dmg = dmg * 2 + 1;

  enemy.hp -= dmg;

  const bucket = isCrit
    ? (combatFlavor.player.crit[enemyType] || combatFlavor.player.crit.beast)
    : (combatFlavor.player.normal[enemyType] || combatFlavor.player.normal.beast);

  logSystem(`${pick(bucket).replace("{name}", enemy.name)} (${dmg} damage)`);

  // Enemy defeated
  if (enemy.hp <= 0) {
    logSystem(pick([`The ${enemy.name} collapses in a heap.`, `The ${enemy.name} falls still.`]));
    const xp = enemy.xpReward || 0;
    if (xp > 0) gainXp(xp);

    // Handle wave fights by room
    if (handleWaveContinuation()) return;

    // Mark room clears
    markRoomCombatCleared();

    endCombat();
    return;
  }

  // Enemy responds
  enemyTurn({ blocking: false });
}

function handleBlock() {
  ensureCombatState();
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("You raise your guard against nothing.");
    return;
  }

  logSystem("You brace, muscles locked, waiting for impact.");
  enemyTurn({ blocking: true });
}

function handleRun() {
  ensureCombatState();
  if (!gameState.combat.inCombat || !gameState.combat.enemy) {
    logSystem("There is nothing to run from.");
    return;
  }

  const success = roll(1, 100) <= 60;
  if (success) {
    const prev = gameState.combat.previousLocation;
    logSystem("You bolt from the fight, scrambling away!");
    endCombat();

    if (prev) {
      // If Module 4 uses enterRoom(), use it; otherwise direct set + look
      if (typeof enterRoom === "function") enterRoom(prev);
      else gameState.location = prev;
    }
    return;
  }

  logSystem("You try to flee, but it cuts you off!");
  enemyTurn({ blocking: false });
}

// ============================================================
// Waves + Clear Flags (Vestibule rats, Barracks soldiers)
// ============================================================

function handleWaveContinuation() {
  const loc = gameState.location;

  // Vestibule rats: gameState.flags.vestibuleRats
  if (loc === "rat_gnawed_vestibule" && gameState.flags?.vestibuleRats > 1) {
    gameState.flags.vestibuleRats -= 1;

    const next = createEnemyInstance("dawnspire_rat");
    gameState.combat.enemy = next;
    gameState.combat.intent = chooseEnemyIntent(next);

    logSystem("More skittering—another tunnel-rat claws its way out, drawn by the blood.");
    telegraphEnemyIntent(next, gameState.combat.intent);
    return true;
  }

  // Barracks soldiers: gameState.flags.barracksLeft
  if (loc === "broken_barracks" && gameState.flags?.barracksLeft > 1) {
    gameState.flags.barracksLeft -= 1;

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

  if (loc === "rat_gnawed_vestibule") {
    gameState.flags.vestibuleCleared = true;
  }
  if (loc === "broken_barracks") {
    gameState.flags.barracksCleared = true;
  }
  if (loc === "lantern_muster_hall") {
    gameState.flags.musterCleared = true;
  }
}

// ============================================================
// Combat Router (for your command parser)
// ============================================================

function handleCombatCommand(cmd, rawLine) {
  const c = (cmd || "").toLowerCase();

  if (c === "attack") return handleAttack();
  if (c === "block") return handleBlock();
  if (c === "run") return handleRun();

  // let your existing system handle "use bandage", etc.
  if (c === "use") {
    const arg = (rawLine || "").slice(4).trim();
    if (typeof extendedUseSystem === "function") return extendedUseSystem(arg, true);
    if (typeof handleUse === "function") return handleUse(arg, { inCombat: true });
    logSystem("You fumble for an item, but nothing happens.");
    return;
  }

  logSystem("That makes no sense in a fight. Try: attack, block, run, use <item>.");
}
// ============================================================
// MODULE 6 — COMMAND PARSER + NON-COMBAT COMMAND HANDLERS
// ============================================================
// Expects from other modules:
// - gameState
// - logSystem(), logCommand(), updateStatusBar(), scheduleSave()
// - describeLocation() OR enterRoom(id)
// - goDirection(dir) OR handleGo(dir)  (movement module)
// - handleSearch(), handleUse(arg, {inCombat}), handleEquip(arg), handleAdjust(arg), handleRing(arg,{inCombat})
// - handleRest(), handleReset(), startCombat()
// - handleCombatCommand(cmd, rawLine) (from Module 5)
// ============================================================

// --- Small helpers ---
function normalizeDir(d) {
  const x = (d || "").toLowerCase();
  if (x === "n") return "north";
  if (x === "s") return "south";
  if (x === "e") return "east";
  if (x === "w") return "west";
  if (x === "u") return "up";
  if (x === "d") return "down";
  if (x === "f") return "forward";
  if (x === "b") return "back";
  return x;
}

function safeDescribe() {
  if (typeof describeLocation === "function") return describeLocation();
  if (typeof enterRoom === "function") return enterRoom(gameState.location);
  logSystem("You look around, but the world refuses to describe itself. (Missing describe function)");
}

// ============================================================
// Help / Name
// ============================================================

function handleHelp() {
  logSystem(
    [
      "Available commands:",
      "  help               - show this help",
      "  look               - describe your surroundings (or current foe)",
      "  inventory (inv)    - list items",
      "  go <direction>     - move (north,south,east,west,up,down,forward,back)",
      "  name <your name>   - set your name",
      "  attack             - attack (combat only)",
      "  block              - block (combat only)",
      "  run                - attempt to flee (combat only)",
      "  rest               - consume a ration to fully restore HP",
      "  use <item>         - use an item (bandage, draught, shard, journal, etc.)",
      "  equip <item>       - equip a weapon or shield (e.g., spear, buckler, sword)",
      "  adjust <target>    - adjust mechanisms (e.g., 'adjust mirrors east')",
      "  ring <thing>       - ring something where it exists (e.g., 'ring bell')",
      "  search             - search the area",
      "  reset              - wipe progress and restart",
    ].join("\n")
  );
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
}

// ============================================================
// Look / Inventory
// ============================================================

function handleLook() {
  // In combat: show enemy status
  if (gameState.combat?.inCombat && gameState.combat.enemy) {
    const e = gameState.combat.enemy;
    logSystem(`${e.name}\n${e.description}\n\nIt has ${e.hp}/${e.maxHp} HP remaining.`);
    return;
  }
  safeDescribe();
}

function handleInventory() {
  const inv = gameState.inventory || [];
  if (!inv.length) {
    logSystem("Your inventory is empty.");
    return;
  }

  // Group by id so duplicates show as (xN)
  const grouped = new Map();
  for (const item of inv) {
    const key = item.id || item.name;
    if (!grouped.has(key)) grouped.set(key, { item, count: 0 });
    grouped.get(key).count++;
  }

  let index = 1;
  const lines = [];
  for (const { item, count } of grouped.values()) {
    const label = count > 1 ? `${item.name} (${count})` : item.name;
    lines.push(`${index}. ${label}`);
    index++;
  }

  logSystem("You are carrying:\n" + lines.join("\n"));
}

// ============================================================
// Movement wrapper (calls your movement module)
// ============================================================

function handleGoWrapper(dirRaw) {
  const dir = normalizeDir(dirRaw);

  if (!dir) {
    logSystem("Go where? (north, south, east, west, up, down, forward, back)");
    return;
  }

  // Must not move during combat
  if (gameState.combat?.inCombat) {
    logSystem("You're a little busy not dying right now. Try 'attack', 'block', or 'run'.");
    return;
  }

  // Support either handleGo() or goDirection()
  if (typeof handleGo === "function") return handleGo(dir);
  if (typeof goDirection === "function") return goDirection(dir);

  logSystem("You try to move, but your legs don’t know how. (Missing movement handler)");
}

// ============================================================
// Search / Use / Equip / Adjust / Ring / Rest / Reset wrappers
// ============================================================

function handleSearchWrapper() {
  if (typeof handleSearch === "function") return handleSearch();
  logSystem("You search aimlessly. (Missing handleSearch)");
}

function handleUseWrapper(argStr) {
  if (typeof handleUse === "function") return handleUse(argStr, { inCombat: false });
  logSystem("You try to use something, but nothing happens. (Missing handleUse)");
}

function handleEquipWrapper(argStr) {
  if (typeof handleEquip === "function") return handleEquip(argStr);
  logSystem("You fumble with your gear. (Missing handleEquip)");
}

function handleAdjustWrapper(argStr) {
  if (typeof handleAdjust === "function") return handleAdjust(argStr);
  logSystem("Nothing here seems adjustable. (Missing handleAdjust)");
}

function handleRingWrapper(argStr) {
  if (typeof handleRing === "function") return handleRing(argStr, { inCombat: false });
  logSystem("You ring nothing but the air. (Missing handleRing)");
}

function handleRestWrapper() {
  if (typeof handleRest === "function") return handleRest();
  logSystem("You try to rest, but the game doesn't know what that means. (Missing handleRest)");
}

function handleResetWrapper() {
  if (typeof handleReset === "function") return handleReset();
  logSystem("Reset isn't wired up. (Missing handleReset)");
}

// ============================================================
// Main dispatcher
// ============================================================

function handleCommand(rawLine) {
  const input = (rawLine || "").trim();
  if (!input) return;

  // Echo command to UI
  if (typeof logCommand === "function") logCommand(input);
  else logSystem(`> ${input}`);

  const lower = input.toLowerCase();
  const [cmd, ...rest] = lower.split(/\s+/);
  const argStr = rest.join(" ");
  const rawArgStr = input.split(/\s+/).slice(1).join(" "); // preserves case

  // Combat routing
  if (gameState.combat?.inCombat) {
    if (typeof handleCombatCommand === "function") {
      handleCombatCommand(cmd, input);
      scheduleSave?.();
      return;
    }
    logSystem("Combat is active, but combat commands aren't wired. (Missing handleCombatCommand)");
    return;
  }

  // Exploration routing
  switch (cmd) {
    case "help":
      handleHelp();
      break;

    case "look":
    case "l":
      handleLook();
      break;

    case "inventory":
    case "inv":
    case "i":
      handleInventory();
      break;

    case "go":
    case "move":
      if (!rest.length) {
        logSystem("Go where? (north, south, east, west, up, down, forward, back)");
      } else {
        handleGoWrapper(rest[0]);
      }
      break;

    // Convenience: allow "north" as shorthand for "go north"
    case "north":
    case "south":
    case "east":
    case "west":
    case "up":
    case "down":
    case "forward":
    case "back":
      handleGoWrapper(cmd);
      break;

    case "name":
      handleName(rawArgStr);
      break;

    case "attack":
      logSystem("There's nothing here to attack.");
      break;

    case "block":
      logSystem("You raise your guard. Nothing is close enough to hit you. Yet.");
      break;

    case "run":
      logSystem("There's nothing to run from.");
      break;

    case "rest":
      handleRestWrapper();
      break;

    case "use":
      handleUseWrapper(rawArgStr);
      break;

    case "equip":
      handleEquipWrapper(rawArgStr);
      break;

    case "adjust":
      handleAdjustWrapper(rawArgStr);
      break;

    case "ring":
      handleRingWrapper(rawArgStr);
      break;

    case "search":
      handleSearchWrapper();
      break;

    case "reset":
      handleResetWrapper();
      break;

    default:
      logSystem("You mumble, unsure what that means. (Type 'help' for commands.)");
      break;
  }

  scheduleSave?.();
}

// ============================================================
// Hook to DOM (if you want Module 1 init to call this)
// ============================================================
// Example usage elsewhere:
// formEl.addEventListener("submit", (e) => {
//   e.preventDefault();
//   const value = inputEl.value;
//   inputEl.value = "";
//   handleCommand(value);
// });
// ============================================================
// MODULE 7 — ROOM 17 (Stale Provision Cellar) + WORLD PATCHES
// - Adds location + exits text + travel dialogue everywhere
// - Adds loot: 2x Travel Ration (waxed packets)
// - Hooks it into movement from Room 12 (Broken Barracks) by default
// - Implements Shrine change: immediate heal = +5 current HP (capped), and ALSO raises maxHP by +5 so level-2 goes 25->30
//   (This matches “adds 5 to 25” and still “adds to current hp”)
// ============================================================

// ---------------------------
// 7A) Add Room 17 location
// ---------------------------
// Make sure `locations` exists (from your world module)
locations.stale_provision_cellar = {
  name: "Dawnspire – Stale Provision Cellar",
  description: [
    "A cool, damp chamber full of ruined barrels and moldy sacks.",
    "The air tastes like old grain turned sour and cellar-mold that never dries."
  ].join(" "),
};

// ---------------------------
// 7B) Add exits text for Room 17
// ---------------------------
// Make sure `exitsByLocation` exists
exitsByLocation.stale_provision_cellar =
  "Obvious exits: north/back – back to the broken barracks.";

// ---------------------------
// 7C) Room 17 loot (2 rations) — first time only
// ---------------------------
function maybeGrantProvisionCellarLoot() {
  if (gameState.flags.provisionCellarLootTaken) return;
  gameState.flags.provisionCellarLootTaken = true;

  const ration = { id: "ration", name: "Travel Ration", type: "ration" };
  gameState.inventory.push(ration, ration);

  logSystem(
    "Under a split barrel hoop you find two waxed packets that somehow resisted the damp. They smell stale, but edible."
  );
  logSystem("You gain: Travel Ration (2).");
}

// ---------------------------
// 7D) Auto-room hooks for Room 17
// Call this from describeLocation() when in stale_provision_cellar
// ---------------------------
function room17OnEnter() {
  if (!gameState.combat.inCombat) {
    maybeGrantProvisionCellarLoot();
  }
}

// Patch your describeLocation() to include Room 17 behavior.
// Add this near your other room-specific blocks:
const __oldDescribeLocation7 = describeLocation;
describeLocation = function patchedDescribeLocation7() {
  __oldDescribeLocation7();

  if (gameState.location === "stale_provision_cellar") {
    room17OnEnter();
  }
};

// ---------------------------
// 7E) Movement integration option
// Connect Room 12 <-> Room 17
// Default: From Broken Barracks go SOUTH to 17, and from 17 go NORTH/BACK to 12.
// If you want it connected to 13 instead, swap the references.
// ---------------------------

// Wrap/patch handleGo with extra cases without rewriting your whole movement module.
const __oldHandleGo7 = handleGo;
handleGo = function patchedHandleGo7(directionRaw) {
  const direction = (directionRaw || "").toLowerCase();

  // Room 12 -> Room 17
  if (gameState.location === "broken_barracks") {
    if (direction === "south") {
      gameState.location = "stale_provision_cellar";
      logSystem(
        "You pick your way down into a cooler, wetter side chamber where the air tastes of spoiled grain."
      );
      describeLocation();
      return;
    }
  }

  // Room 17 -> Room 12
  if (gameState.location === "stale_provision_cellar") {
    if (direction === "north" || direction === "back") {
      gameState.location = "broken_barracks";
      logSystem("You leave the damp cellar behind and return to the broken barracks.");
      describeLocation();
      return;
    }
  }

  // Fall back to your existing movement logic
  return __oldHandleGo7(directionRaw);
};

// Also update the exits text for Room 12 to include the new option.
// If you already have exitsByLocation.broken_barracks, replace it:
exitsByLocation.broken_barracks =
  "Obvious exits: west/back – to the fallen guard post; north – into the Lantern Muster Hall; south – down into a cool provision cellar.";

// ---------------------------
// 7F) Ensure EVERY location prints direction dialogue
// You already do printExitsForLocation(gameState.location) at end of describeLocation().
// This module just ensures Room 17 has it.
// ---------------------------

// ---------------------------
// 7G) Shrine change: +5 Max HP AND +5 current HP, capped
// This matches: level 2 maxHP 25 -> 30, and current HP also rises by up to +5.
// ---------------------------

function grantShrineBlessingAndCharm() {
  if (gameState.flags.shrineBlessingGranted) return;

  gameState.flags.shrineBlessingGranted = true;
  gameState.flags.shrineBlessingActive = true;

  // Loot: Flame-Touched Charm (once)
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

  // --- NEW: Raise max HP by +5 (permanent) ---
  const oldMax = p.maxHp;
  p.maxHp = (p.maxHp || 0) + 5;

  // --- NEW: Heal +5 current HP immediately (capped by new max) ---
  const beforeHp = p.hp;
  p.hp = Math.min(p.maxHp, (p.hp || 0) + 5);

  updateStatusBar();

  logSystem(
    "Light floods up through the statue’s arm, into the crystal flame, and then out through the chamber. For a heartbeat, you feel as though you’re standing in noon sunlight instead of buried stone."
  );
  logSystem(
    "The warmth pools behind your ribs and settles there, a thin burning thread that refuses to go out."
  );

  // Report changes
  if (p.maxHp > oldMax) {
    logSystem(`Your body feels tougher, like the flame welded new strength into your bones. (+5 Max HP, now ${p.maxHp})`);
  }
  const healed = p.hp - beforeHp;
  if (healed > 0) {
    logSystem(`Your wounds tighten and sting closed under the heat. (+${healed} HP, now ${p.hp}/${p.maxHp})`);
  }

  logSystem(
    "You carry a quiet certainty now: the first blow that should kill you in battle will leave you hanging on at the edge instead."
  );
}
