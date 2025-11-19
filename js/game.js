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
// Simple world + commands
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
    describeLocation();
}

function handleInventory() {
    if (gameState.inventory.length === 0) {
        logSystem("Your inventory is empty.");
        return;
    }
    const lines = gameState.inventory.map((item, i) => `${i + 1}. ${item.name}`);
    logSystem("You are carrying:\n" + lines.join("\n"));
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

function handleGo(direction) {
    const loc = gameState.location;

    if (loc === "village_square" && direction === "north") {
        gameState.location = "dark_forest_edge";
        logSystem("You walk north, leaving the safety of Briar's Edge behind...");
        describeLocation();
        gainXp(10); // simple: reward exploring
        return;
    }

    if (loc === "dark_forest_edge" && direction === "south") {
        gameState.location = "village_square";
        logSystem("You walk back south, returning to the village square.");
        describeLocation();
        return;
    }

    logSystem("You can't go that way.");
}

function handleHelp() {
    logSystem(
        [
            "Available commands:",
            "  help               - show this help",
            "  look               - describe your surroundings",
            "  inventory (or inv) - show your items",
            "  go <direction>     - move (e.g., 'go north')",
            "  name <your name>   - set your name",
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

// =========================
// Intro / story
// =========================

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

// =========================
// Reset / wipe save
// =========================

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

    updateStatusBar();
    showIntro();
    scheduleSave();
}

// =========================
// Simple command parser
// =========================

function handleCommand(raw) {
    const input = raw.trim();
    if (!input) return;

    logCommand(input);

    const [cmd, ...rest] = input.toLowerCase().split(/\s+/);
    const argStr = rest.join(" ");

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
