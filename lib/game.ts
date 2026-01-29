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
  roomNumber: string; // 4-6 digit room code
  createdAt: number;
  hostPin?: string; // 4 digits, optional
  players: Player[];
  rooms: string[];
  objects: string[];
  assignmentsByName: Record<string, Assignment>; // key=nameNormalized
  claimedByName: Record<string, boolean>;
};

export type RoomConfig = {
  roomNumber: string;
  playerNames: string[];
  rooms: string[];
  objects: string[];
  hostPin?: string;
  createdAt: number;
};

// Storage keys
const ACTIVE_GAME_KEY = "sa_active_game_id_v1";
const ACTIVE_ROOM_KEY = "sa_active_room_v1";
const GAME_STATE_PREFIX = "sa_game_state_v1:";
const ROOM_CONFIG_PREFIX = "sa_room_config_v1:";

/**
 * Normalize a name: trim, lowercase, collapse whitespace
 */
export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Seeded random number generator (Linear Congruential Generator)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    // Convert string to numeric seed
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    this.seed = Math.abs(hash) || 1;
  }

  next(): number {
    // LCG parameters (same as used in many programming languages)
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    return this.seed / Math.pow(2, 32);
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * If seed is provided, uses deterministic shuffling
 */
export function shuffle<T>(arr: T[], seed?: string): T[] {
  const result = [...arr];
  const rng = seed ? new SeededRandom(seed) : null;
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng 
      ? Math.floor(rng.next() * (i + 1))
      : Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a derangement (permutation with no fixed points)
 * Uses Sattolo's algorithm adapted to ensure no self-targets
 * If seed is provided, uses deterministic derangement
 */
export function derangement(names: string[], seed?: string): string[] {
  if (names.length < 3) {
    throw new Error("Derangement requires at least 3 elements");
  }

  const n = names.length;
  const result = [...names];
  const rng = seed ? new SeededRandom(seed) : null;
  
  // Sattolo's algorithm creates a random cycle (no fixed points)
  for (let i = n - 1; i > 0; i--) {
    const j = rng
      ? Math.floor(rng.next() * i) // j in [0, i)
      : Math.floor(Math.random() * i);
    [result[i], result[j]] = [result[j], result[i]];
  }

  // Verify no fixed points (safety check)
  for (let i = 0; i < n; i++) {
    if (result[i] === names[i]) {
      // If we have a fixed point, swap with a random other element
      let swapIdx: number;
      if (rng) {
        swapIdx = Math.floor(rng.next() * n);
        while (swapIdx === i) {
          swapIdx = Math.floor(rng.next() * n);
        }
      } else {
        swapIdx = Math.floor(Math.random() * n);
        while (swapIdx === i) {
          swapIdx = Math.floor(Math.random() * n);
        }
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
 * Generate a room number (4-6 digits)
 */
function generateRoomNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000); // 4-digit number
  return num.toString();
}

/**
 * Save room configuration
 */
export function saveRoomConfig(config: RoomConfig): void {
  try {
    const configKey = `${ROOM_CONFIG_PREFIX}${config.roomNumber}`;
    localStorage.setItem(configKey, JSON.stringify(config));
    localStorage.setItem(ACTIVE_ROOM_KEY, config.roomNumber);
  } catch (error) {
    console.error("Error saving room config:", error);
  }
}

/**
 * Load room configuration by room number
 */
export function loadRoomConfig(roomNumber: string): RoomConfig | null {
  try {
    const configKey = `${ROOM_CONFIG_PREFIX}${roomNumber}`;
    const configJson = localStorage.getItem(configKey);
    if (!configJson) {
      return null;
    }
    return JSON.parse(configJson) as RoomConfig;
  } catch (error) {
    console.error("Error loading room config:", error);
    return null;
  }
}

/**
 * Load active room number
 */
export function getActiveRoomNumber(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ROOM_KEY);
  } catch (error) {
    return null;
  }
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
 * Load game state by room number (regenerates deterministically)
 */
export function loadGameByRoom(roomNumber: string): GameStateV1 | null {
  const config = loadRoomConfig(roomNumber);
  if (!config) {
    return null;
  }

  // Regenerate game state deterministically from config
  return generateGameFromConfig(config, roomNumber);
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
    
    // Also clear active room
    const activeRoom = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (activeRoom) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
    }
  } catch (error) {
    console.error("Error resetting game:", error);
  }
}

/**
 * Sync game state to server
 */
export async function syncGameToServer(state: GameStateV1): Promise<boolean> {
  try {
    const response = await fetch(`/api/game/${state.roomNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    
    if (!response.ok) {
      console.error('Failed to sync game to server');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error syncing to server:', error);
    return false;
  }
}

/**
 * Load game state from server
 */
export async function loadGameFromServer(roomNumber: string): Promise<GameStateV1 | null> {
  try {
    const response = await fetch(`/api/game/${roomNumber}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to load game from server');
    }
    
    const state = await response.json() as GameStateV1;
    return state;
  } catch (error) {
    console.error('Error loading from server:', error);
    return null;
  }
}

/**
 * Mark a player as claimed on server
 */
export async function markClaimedOnServer(
  roomNumber: string,
  playerName: string
): Promise<GameStateV1 | null> {
  try {
    const response = await fetch(`/api/game/${roomNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to mark claimed on server');
    }
    
    const result = await response.json();
    return result.state as GameStateV1;
  } catch (error) {
    console.error('Error marking claimed on server:', error);
    return null;
  }
}

/**
 * Mark a player as claimed (local + server)
 */
export async function markClaimed(nameNormalized: string): Promise<GameStateV1 | null> {
  const state = loadActiveGame();
  if (!state) {
    return null;
  }

  // Update local state
  state.claimedByName[nameNormalized] = true;
  saveGame(state);
  
  // Sync to server
  await markClaimedOnServer(state.roomNumber, nameNormalized);
  
  return state;
}

/**
 * Generate game state from room config (deterministic)
 */
function generateGameFromConfig(
  config: RoomConfig,
  roomNumber: string
): GameStateV1 {
  const seed = `room-${roomNumber}`;
  
  // Normalize and deduplicate player names
  const normalizedMap = new Map<string, string>();
  const players: Player[] = [];
  
  for (const name of config.playerNames) {
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

  // Create derangement for targets (deterministic)
  const playerNamesOnly = players.map((p) => p.name);
  const targetNames = derangement(playerNamesOnly, seed);

  // Shuffle rooms and objects (deterministic)
  const shuffledRooms = shuffle(
    config.rooms.length > 0 ? config.rooms : ["unknown room"],
    `${seed}-rooms`
  );
  const shuffledObjects = shuffle(
    config.objects.length > 0 ? config.objects : ["unknown object"],
    `${seed}-objects`
  );

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

  const gameId = `room-${roomNumber}`;

  const state: GameStateV1 = {
    version: "v1",
    gameId,
    roomNumber,
    createdAt: config.createdAt,
    hostPin: config.hostPin,
    players,
    rooms: shuffledRooms,
    objects: shuffledObjects,
    assignmentsByName,
    claimedByName: {}, // Start fresh for each device
  };

  saveGame(state);
  return state;
}

/**
 * Generate a new game state with room number
 */
export function generateGame(
  playerNames: string[],
  rooms: string[],
  objects: string[],
  hostPin?: string,
  roomNumber?: string
): GameStateV1 {
  if (playerNames.length < 3) {
    throw new Error("At least 3 players required");
  }

  // Generate or use provided room number
  const finalRoomNumber = roomNumber || generateRoomNumber();

  // Save room configuration
  const config: RoomConfig = {
    roomNumber: finalRoomNumber,
    playerNames,
    rooms,
    objects,
    hostPin,
    createdAt: Date.now(),
  };
  saveRoomConfig(config);

  // Generate game state deterministically
  return generateGameFromConfig(config, finalRoomNumber);
}
