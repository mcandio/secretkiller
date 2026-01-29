// Game state types and logic for Secret Assassin

export type Player = {
  name: string;
  nameNormalized: string;
};

export type Assignment = {
  targetName: string;
  room: string;
  object: string;
};

export type GameStateV1 = {
  version: "v1";
  gameId: string;
  createdAt: number;
  hostPin?: string; // 4 digits, optional
  players: Player[];
  rooms: string[];
  objects: string[];
  assignmentsByName: Record<string, Assignment>; // key=nameNormalized
  claimedByName: Record<string, boolean>;
};

// Storage keys
const ACTIVE_GAME_KEY = "sa_active_game_id_v1";
const GAME_STATE_PREFIX = "sa_game_state_v1:";

/**
 * Normalize a name: trim, lowercase, collapse whitespace
 */
export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a derangement (permutation with no fixed points)
 * Uses Sattolo's algorithm adapted to ensure no self-targets
 */
export function derangement(names: string[]): string[] {
  if (names.length < 3) {
    throw new Error("Derangement requires at least 3 elements");
  }

  const n = names.length;
  const result = [...names];
  
  // Sattolo's algorithm creates a random cycle (no fixed points)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i); // j in [0, i)
    [result[i], result[j]] = [result[j], result[i]];
  }

  // Verify no fixed points (safety check)
  for (let i = 0; i < n; i++) {
    if (result[i] === names[i]) {
      // If we have a fixed point, swap with a random other element
      let swapIdx = Math.floor(Math.random() * n);
      while (swapIdx === i) {
        swapIdx = Math.floor(Math.random() * n);
      }
      [result[i], result[swapIdx]] = [result[swapIdx], result[i]];
    }
  }

  return result;
}

/**
 * Generate a random base36 string of given length
 */
function randomBase36(length: number): string {
  return Math.random().toString(36).substring(2, 2 + length).padEnd(length, "0");
}

/**
 * Load the active game state from localStorage
 */
export function loadActiveGame(): GameStateV1 | null {
  try {
    const activeGameId = localStorage.getItem(ACTIVE_GAME_KEY);
    if (!activeGameId) {
      return null;
    }

    const stateKey = `${GAME_STATE_PREFIX}${activeGameId}`;
    const stateJson = localStorage.getItem(stateKey);
    if (!stateJson) {
      return null;
    }

    return JSON.parse(stateJson) as GameStateV1;
  } catch (error) {
    console.error("Error loading game state:", error);
    return null;
  }
}

/**
 * Save game state to localStorage
 */
export function saveGame(state: GameStateV1): void {
  try {
    const stateKey = `${GAME_STATE_PREFIX}${state.gameId}`;
    localStorage.setItem(stateKey, JSON.stringify(state));
    localStorage.setItem(ACTIVE_GAME_KEY, state.gameId);
  } catch (error) {
    console.error("Error saving game state:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      alert("Storage quota exceeded. Please clear some data and try again.");
    }
  }
}

/**
 * Reset/clear the active game
 */
export function resetGame(): void {
  try {
    const activeGameId = localStorage.getItem(ACTIVE_GAME_KEY);
    if (activeGameId) {
      const stateKey = `${GAME_STATE_PREFIX}${activeGameId}`;
      localStorage.removeItem(stateKey);
    }
    localStorage.removeItem(ACTIVE_GAME_KEY);
  } catch (error) {
    console.error("Error resetting game:", error);
  }
}

/**
 * Mark a player as claimed and persist
 */
export function markClaimed(nameNormalized: string): GameStateV1 | null {
  const state = loadActiveGame();
  if (!state) {
    return null;
  }

  state.claimedByName[nameNormalized] = true;
  saveGame(state);
  return state;
}

/**
 * Generate a new game state
 */
export function generateGame(
  playerNames: string[],
  rooms: string[],
  objects: string[],
  hostPin?: string
): GameStateV1 {
  if (playerNames.length < 3) {
    throw new Error("At least 3 players required");
  }

  // Normalize and deduplicate player names
  const normalizedMap = new Map<string, string>();
  const players: Player[] = [];
  
  for (const name of playerNames) {
    const normalized = normalizeName(name);
    if (!normalizedMap.has(normalized)) {
      normalizedMap.set(normalized, name);
      players.push({
        name: name.trim(),
        nameNormalized: normalized,
      });
    }
  }

  if (players.length < 3) {
    throw new Error("At least 3 unique players required");
  }

  // Create derangement for targets
  const playerNamesOnly = players.map((p) => p.name);
  const targetNames = derangement(playerNamesOnly);

  // Shuffle rooms and objects
  const shuffledRooms = shuffle(rooms.length > 0 ? rooms : ["unknown room"]);
  const shuffledObjects = shuffle(objects.length > 0 ? objects : ["unknown object"]);

  // Assign rooms and objects (cycle if needed)
  const assignmentsByName: Record<string, Assignment> = {};

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const targetName = targetNames[i];
    const room = shuffledRooms[i % shuffledRooms.length];
    const object = shuffledObjects[i % shuffledObjects.length];

    assignmentsByName[player.nameNormalized] = {
      targetName,
      room,
      object,
    };
  }

  const gameId = `${Date.now()}-${randomBase36(6)}`;

  const state: GameStateV1 = {
    version: "v1",
    gameId,
    createdAt: Date.now(),
    hostPin,
    players,
    rooms: shuffledRooms,
    objects: shuffledObjects,
    assignmentsByName,
    claimedByName: {},
  };

  saveGame(state);
  return state;
}
