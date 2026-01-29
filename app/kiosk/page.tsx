'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  loadActiveGame,
  loadGameByRoom,
  loadGameFromServer,
  markClaimed,
  saveGame,
  syncGameToServer,
  type GameStateV1,
  type Assignment,
} from '@/lib/game'
import Navigation from '@/components/Navigation'
import RoomEntry from '@/components/RoomEntry'

const INACTIVITY_TIMEOUT = 45000 // 45 seconds

export default function KioskPage() {
  const [gameState, setGameState] = useState<GameStateV1 | null>(null)
  const [selectedName, setSelectedName] = useState<string>('')
  const [mission, setMission] = useState<Assignment | null>(null)
  const [showPrivacyShield, setShowPrivacyShield] = useState(false)
  const [showHostLink, setShowHostLink] = useState(false)
  const [showRoomEntry, setShowRoomEntry] = useState(false)
  const [hostPinInput, setHostPinInput] = useState('')
  const [hostPinError, setHostPinError] = useState('')
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const state = loadActiveGame()
    if (!state) {
      setShowRoomEntry(true)
    } else {
      setGameState(state)
    }
  }, [])

  // Poll server for updates
  useEffect(() => {
    if (!gameState?.roomNumber) return

    // Poll server every 2 seconds for updates
    const pollInterval = setInterval(async () => {
      try {
        const serverState = await loadGameFromServer(gameState.roomNumber)
        if (serverState) {
          // Merge server state (prioritize server's claimed state)
          const mergedState = {
            ...serverState,
            claimedByName: {
              ...gameState.claimedByName,
              ...serverState.claimedByName, // Server claims override local
            },
          }
          setGameState(mergedState)
          saveGame(mergedState)
        }
      } catch (error) {
        console.error('Error polling server:', error)
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [gameState?.roomNumber])

  const handleHideMission = useCallback(async () => {
    if (!gameState || !selectedName) return

    const player = gameState.players.find(
      (p) => p.nameNormalized === selectedName
    )
    if (!player) return

    // Mark as claimed (now syncs to server)
    const updatedState = await markClaimed(player.nameNormalized)
    if (updatedState) {
      setGameState(updatedState)
    }

    // Clear mission and selection
    setMission(null)
    setSelectedName('')
  }, [gameState, selectedName])

  useEffect(() => {
    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }

    // If mission is visible, start inactivity timer
    if (mission) {
      inactivityTimerRef.current = setTimeout(() => {
        handleHideMission()
      }, INACTIVITY_TIMEOUT)
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current)
      }
    }
  }, [mission, handleHideMission])

  // Prevent back navigation when mission is visible
  useEffect(() => {
    if (mission && typeof window !== 'undefined') {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [mission])

  const handleRevealMission = () => {
    if (!gameState || !selectedName) return

    const player = gameState.players.find(
      (p) => p.nameNormalized === selectedName
    )
    if (!player) return

    const assignment = gameState.assignmentsByName[player.nameNormalized]
    if (assignment) {
      setMission(assignment)
      setShowPrivacyShield(false)
    }
  }

  const handleHostPinCheck = () => {
    if (gameState?.hostPin && hostPinInput === gameState.hostPin) {
      window.location.href = '/host'
    } else {
      setHostPinError('Incorrect PIN')
      setHostPinInput('')
    }
  }

  // Room entry screen
  if (showRoomEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-600 to-blue-800">
        <Navigation />
        <RoomEntry 
          onJoin={() => {
            const state = loadActiveGame()
            setGameState(state)
            setShowRoomEntry(false)
          }}
        />
      </div>
    )
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Navigation />
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-3xl font-bold mb-4">No Active Game</h2>
          <p className="text-xl text-gray-600 mb-6">
            Please join a room or create a game.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setShowRoomEntry(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors"
            >
              Join Room
            </button>
            <Link
              href="/host"
              className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold py-4 px-8 rounded-lg transition-colors"
            >
              Create Game (Host)
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Privacy shield overlay
  if (showPrivacyShield) {
    return (
      <div
        className="min-h-screen bg-black text-white flex items-center justify-center cursor-pointer"
        onClick={() => setShowPrivacyShield(false)}
      >
        <div className="text-center">
          <p className="text-4xl md:text-6xl font-bold mb-4">Privacy Shield</p>
          <p className="text-2xl md:text-3xl">Tap to continue</p>
        </div>
      </div>
    )
  }

  // Mission reveal screen
  if (mission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-red-800 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-red-900/50 rounded-lg p-8 md:p-12 max-w-2xl w-full text-center space-y-8">
          <div className="bg-yellow-400 text-red-900 p-6 rounded-lg mb-8">
            <p className="text-3xl md:text-4xl font-bold">
              ⚠️ Do NOT say it out loud.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-2xl md:text-3xl text-red-200 mb-2">Your Target</p>
              <p className="text-5xl md:text-7xl font-bold">{mission.targetName}</p>
            </div>

            <div>
              <p className="text-2xl md:text-3xl text-red-200 mb-2">Room</p>
              <p className="text-4xl md:text-6xl font-bold">{mission.room}</p>
            </div>

            <div>
              <p className="text-2xl md:text-3xl text-red-200 mb-2">Object</p>
              <p className="text-4xl md:text-6xl font-bold">{mission.object}</p>
            </div>
          </div>

          <button
            onClick={handleHideMission}
            className="w-full bg-white text-red-600 text-3xl md:text-4xl font-bold py-8 px-8 rounded-lg hover:bg-gray-100 transition-colors mt-8"
          >
            I memorized it
          </button>
        </div>

        {/* Return to host link (small, bottom corner) */}
        <button
          onClick={() => setShowHostLink(true)}
          className="absolute bottom-4 left-4 text-white/50 hover:text-white text-sm underline"
        >
          Return to Host
        </button>
      </div>
    )
  }

  // Host PIN dialog
  if (showHostLink) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black/50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Enter Host PIN</h2>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={hostPinInput}
            onChange={(e) => {
              setHostPinInput(e.target.value.replace(/\D/g, ''))
              setHostPinError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && hostPinInput.length === 4) {
                handleHostPinCheck()
              }
            }}
            className="w-full text-3xl text-center p-4 border-2 border-gray-300 rounded-lg mb-4"
            placeholder="0000"
            autoFocus
          />
          {hostPinError && (
            <p className="text-red-600 text-center mb-4">{hostPinError}</p>
          )}
          <div className="flex gap-4">
            <button
              onClick={handleHostPinCheck}
              disabled={hostPinInput.length !== 4}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xl font-bold py-4 px-6 rounded-lg transition-colors"
            >
              Verify
            </button>
            <button
              onClick={() => {
                setShowHostLink(false)
                setHostPinInput('')
                setHostPinError('')
              }}
              className="flex-1 bg-gray-400 hover:bg-gray-500 text-white text-xl font-bold py-4 px-6 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Name selection screen
  const availablePlayers = gameState.players.filter(
    (p) => !gameState.claimedByName[p.nameNormalized]
  )
  const claimedPlayers = gameState.players.filter(
    (p) => gameState.claimedByName[p.nameNormalized]
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 text-white flex flex-col items-center justify-center p-6">
      <Navigation />
      <div className="bg-blue-900/50 rounded-lg p-8 md:p-12 max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl md:text-6xl font-bold mb-8">Choose Your Name</h1>

        {availablePlayers.length === 0 ? (
          <div className="space-y-4">
            <p className="text-2xl md:text-3xl">All players have claimed their missions!</p>
            <p className="text-xl text-blue-200">
              {claimedPlayers.length} / {gameState.players.length} claimed
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <label className="block text-2xl md:text-3xl font-semibold mb-4">
                Select your name:
              </label>
              <select
                value={selectedName}
                onChange={(e) => setSelectedName(e.target.value)}
                className="w-full p-6 text-3xl md:text-4xl text-gray-900 rounded-lg border-4 border-white font-bold"
                size={Math.min(availablePlayers.length, 8)}
              >
                <option value="">-- Choose --</option>
                {availablePlayers.map((player) => (
                  <option key={player.nameNormalized} value={player.nameNormalized}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRevealMission}
              disabled={!selectedName}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white text-4xl md:text-5xl font-bold py-10 px-8 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              Reveal My Mission
            </button>
          </>
        )}

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => setShowPrivacyShield(true)}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xl font-semibold py-4 px-6 rounded-lg transition-colors"
          >
            Privacy Shield
          </button>
          <button
            onClick={() => setShowHostLink(true)}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xl font-semibold py-4 px-6 rounded-lg transition-colors"
          >
            Return to Host
          </button>
        </div>
      </div>
    </div>
  )
}
