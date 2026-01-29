# Secret Assassin Game

A party game web app optimized for single-device kiosk mode (iPad + Chrome). Players take turns using the same device to reveal their secret missions.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Host Setup** (`/host`):
   - Enter player names (minimum 3)
   - Configure rooms and objects (defaults are pre-filled)
   - Optionally set a 4-digit PIN to protect host access from kiosk mode
   - Click "Generate Game"

2. **Kiosk Mode** (`/kiosk`):
   - Players select their name from the dropdown
   - Click "Reveal My Mission" to see their target, room, and object
   - Click "I memorized it" to hide the mission and mark as claimed
   - Use "Privacy Shield" button between players for privacy

3. **Instructions** (`/`):
   - Read-only page with full game rules
   - Link to kiosk mode when a game is active

## Features

- ✅ Single-device kiosk mode (no individual phones needed)
- ✅ Persistent game state in localStorage
- ✅ Privacy shield overlay
- ✅ Inactivity timer (auto-hides mission after 45 seconds)
- ✅ PIN protection for host access
- ✅ Derangement algorithm (no self-targets)
- ✅ Mobile-first, iPad-optimized UI
- ✅ Resilient to page refresh

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- localStorage for persistence

## Notes

- Game state persists in browser localStorage
- Each player can only claim their mission once
- Host can reset the game at any time
- Works best in Chrome on iPad in fullscreen/kiosk mode
