'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  loadActiveGame,
  resetGame,
  generateGame,
  type GameStateV1,
} from '@/lib/game'

// Default content from rules.content
const DEFAULT_ROOMS = [
  'bedroom',
  "marcelo's office",
  "mariel's office",
  'living room',
  'kitchen',
  'bathroom',
  'hallway',
]

const DEFAULT_OBJECTS = [
  'phone',
  'keys',
  'glass',
  'cup',
  'bottle',
  'napkin',
  'book',
  'shoe',
  'jacket',
  'pillow',
  'remote control',
  'charger',
  'wallet',
  'notebook',
  'pen',
]

export default function HostPage() {
  const [gameState, setGameState] = useState<GameStateV1 | null>(null)
  const [playerNames, setPlayerNames] = useState<string>('')
  const [rooms, setRooms] = useState<string>(DEFAULT_ROOMS.join('\n'))
  const [objects, setObjects] = useState<string>(DEFAULT_OBJECTS.join('\n'))
  const [hostPin, setHostPin] = useState<string>('')
  const [showPinInput, setShowPinInput] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const state = loadActiveGame()
    setGameState(state)
  }, [])

  const handleGenerate = () => {
    setError('')
    
    const names = playerNames
      .split('\n')
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
    
    if (names.length < 3) {
      setError('At least 3 players are required')
      return
    }

    const roomsList = rooms
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
    
    const objectsList = objects
      .split('\n')
      .map((o) => o.trim())
      .filter((o) => o.length > 0)

    try {
      const pin = hostPin.trim().length === 4 ? hostPin.trim() : undefined
      const newState = generateGame(names, roomsList, objectsList, pin)
      setGameState(newState)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate game')
    }
  }

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the game? This cannot be undone.')) {
      resetGame()
      setGameState(null)
      setError('')
    }
  }

  const handleCopyKioskLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/kiosk`
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const handlePinCheck = () => {
    if (gameState?.hostPin && pinInput === gameState.hostPin) {
      setShowPinInput(false)
      setPinInput('')
    } else {
      setError('Incorrect PIN')
      setPinInput('')
    }
  }

  const claimedCount = gameState
    ? Object.values(gameState.claimedByName).filter(Boolean).length
    : 0
  const totalPlayers = gameState?.players.length || 0

  // If there's a PIN and we haven't verified it, show PIN input
  if (gameState?.hostPin && !showPinInput && pinInput === '') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Enter Host PIN</h2>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pinInput.length === 4) {
                handlePinCheck()
              }
            }}
            className="w-full text-3xl text-center p-4 border-2 border-gray-300 rounded-lg mb-4"
            placeholder="0000"
            autoFocus
          />
          <button
            onClick={handlePinCheck}
            disabled={pinInput.length !== 4}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xl font-bold py-4 px-6 rounded-lg transition-colors"
          >
            Verify
          </button>
          {error && <p className="mt-4 text-red-600 text-center">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8 md:p-12 space-y-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold">Host Setup</h1>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 text-lg underline"
          >
            ← Instructions
          </Link>
        </div>

        {gameState ? (
          <div className="space-y-6">
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Game Status</h2>
              <p className="text-xl mb-2">
                Game ID: <span className="font-mono text-sm">{gameState.gameId}</span>
              </p>
              <p className="text-xl mb-4">
                Claimed: <span className="font-bold">{claimedCount} / {totalPlayers}</span>
              </p>
              
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Players:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {gameState.players.map((player) => {
                    const claimed = gameState.claimedByName[player.nameNormalized]
                    return (
                      <div
                        key={player.nameNormalized}
                        className={`p-3 rounded-lg ${
                          claimed ? 'bg-green-200' : 'bg-gray-100'
                        }`}
                      >
                        <span className="font-semibold">{player.name}</span>
                        {claimed && (
                          <span className="ml-2 text-green-700 font-bold">✓ Claimed</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <Link
                href="/kiosk"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center text-2xl font-bold py-6 px-8 rounded-lg transition-colors"
              >
                Kiosk Mode
              </Link>
              <button
                onClick={handleCopyKioskLink}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-center text-xl font-semibold py-6 px-8 rounded-lg transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy Kiosk Link'}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-center text-xl font-semibold py-6 px-8 rounded-lg transition-colors"
              >
                Reset Game
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-xl font-semibold mb-2">
                Player Names (one per line, minimum 3)
              </label>
              <textarea
                value={playerNames}
                onChange={(e) => setPlayerNames(e.target.value)}
                placeholder="Alice&#10;Bob&#10;Charlie&#10;..."
                className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg min-h-[200px]"
              />
            </div>

            <div>
              <label className="block text-xl font-semibold mb-2">
                Rooms (one per line)
              </label>
              <textarea
                value={rooms}
                onChange={(e) => setRooms(e.target.value)}
                placeholder="bedroom&#10;kitchen&#10;..."
                className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg min-h-[150px]"
              />
            </div>

            <div>
              <label className="block text-xl font-semibold mb-2">
                Objects (one per line)
              </label>
              <textarea
                value={objects}
                onChange={(e) => setObjects(e.target.value)}
                placeholder="phone&#10;keys&#10;..."
                className="w-full p-4 border-2 border-gray-300 rounded-lg text-lg min-h-[150px]"
              />
            </div>

            <div>
              <label className="block text-xl font-semibold mb-2">
                Host PIN (optional, 4 digits - protects host access from kiosk)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={hostPin}
                onChange={(e) => setHostPin(e.target.value.replace(/\D/g, ''))}
                className="w-full p-4 border-2 border-gray-300 rounded-lg text-xl text-center"
                placeholder="0000 (optional)"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <p className="text-red-700 font-semibold">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-3xl font-bold py-8 px-8 rounded-lg transition-colors"
            >
              Generate Game
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
